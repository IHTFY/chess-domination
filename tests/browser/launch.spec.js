import { test, expect } from '@playwright/test';

// Playwright can't open a page as an installed app, so the head script's display-mode query answers yes.
const installed = () => {
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = query => query.includes('display-mode') ? { matches: true, media: query } : matchMedia(query);
};

// Slow every animation and the head script's fallback tenfold, so a step surely lands during the exit
// even on a loaded machine.
const slow = () => {
  const setTimeout = window.setTimeout;
  window.setTimeout = (callback, delay, ...args) => setTimeout(callback, delay * 10, ...args);
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    const animation = animate.call(this, keyframes, options);
    animation.playbackRate = 0.1;
    return animation;
  };
};

test('a browser tab never shows the launch screen', async ({ page }) => {
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.documentElement.classList.contains('launching')) window.launched = true;
    }).observe(document.documentElement, { attributes: true });
  });
  await page.goto('/');
  await expect(page.locator('#board')).toBeVisible();
  expect(await page.evaluate(() => window.launched)).toBeUndefined();
  await expect(page.locator('#launch')).toBeHidden();
});

test('an installed launch plays once, and a key during it only skips it', async ({ page }) => {
  await page.addInitScript(installed);
  await page.addInitScript(slow);
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('launch-grid')?.getAnimations().length > 0);
  const sound = await page.locator('#soundSwitch').getAttribute('aria-pressed');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(page.locator('#launch')).toHaveCount(0, { timeout: 5000 });
  expect(await page.evaluate(() => document.documentElement.classList.contains('launching'))).toBe(false);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await expect(page.locator('#soundSwitch')).toHaveAttribute('aria-pressed', sound);

  await page.reload();
  await expect(page.locator('#board')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.classList.contains('launching'))).toBe(false);
});

test('a tap during an installed launch only skips it', async ({ page }) => {
  await page.addInitScript(installed);
  await page.addInitScript(slow);
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('launch-grid')?.getAnimations().length > 0);
  const sound = await page.locator('#soundSwitch').getAttribute('aria-pressed');
  const { x, y, width, height } = await page.locator('#soundSwitch').boundingBox();
  await page.mouse.click(x + width / 2, y + height / 2);
  await expect(page.locator('#launch')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('#soundSwitch')).toHaveAttribute('aria-pressed', sound);
  expect(await page.evaluate(() => document.documentElement.inert)).toBe(false);
  // Every animation was finished or canceled, so no square is left hidden.
  expect(await page.evaluate(() => document.getElementById('board').shadowRoot.querySelector('[data-square="a1"]').getAnimations().length)).toBe(0);
});

test('the exit waits under Chrome\'s fading launch screen until 350 ms after the first contentful paint', async ({ page }) => {
  await page.addInitScript(installed);
  await page.addInitScript(() => {
    // The game is ready first, and the page reports its contentful paint only when the exit asks for it,
    // so an exit that didn't hold would start at once. Its plain first paint came earlier.
    window.PerformanceObserver = class {
      static supportedEntryTypes = ['paint'];
      constructor(callback) { this.callback = callback; }
      observe() {
        window.painted = performance.now();
        const entries = [{ name: 'first-paint', startTime: window.painted - 200 }, { name: 'first-contentful-paint', startTime: window.painted }];
        queueMicrotask(() => this.callback({ getEntriesByName: name => entries.filter(entry => entry.name === name) }));
      }
      disconnect() {}
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.id === 'launch-grid') window.exitStarted ??= performance.now();
      return animate.call(this, keyframes, options);
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => window.exitStarted);
  const { started, painted } = await page.evaluate(() => ({ started: window.exitStarted, painted: window.painted }));
  expect(started).toBeGreaterThanOrEqual(painted + 350);
});

test('a paint report that never comes shows the game after a second without the exit', async ({ page }) => {
  await page.addInitScript(installed);
  await page.addInitScript(() => {
    // Timers run threefold, so the one-second limit (3 s here) and the watchdog (6.9 s) are far apart
    // even on a loaded machine.
    const setTimeout = window.setTimeout;
    window.setTimeout = (callback, delay, ...args) => setTimeout(callback, delay * 3, ...args);
    window.PerformanceObserver = class {
      static supportedEntryTypes = ['paint'];
      observe() {}
      disconnect() {}
    };
    let exit;
    Object.defineProperty(window, 'launchExit', {
      get: () => exit,
      set: fn => { exit = (...args) => { window.exitCalled = performance.now(); return fn(...args); }; },
    });
    new MutationObserver(() => {
      if (window.exitCalled && !document.getElementById('launch')) window.shown ??= performance.now();
    }).observe(document, { childList: true, subtree: true });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.id === 'launch-grid') window.exitPlayed = true;
      return animate.call(this, keyframes, options);
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => window.shown, null, { timeout: 10000 });
  const { shown, called, played, inert } = await page.evaluate(() => ({
    shown: window.shown, called: window.exitCalled, played: window.exitPlayed, inert: document.documentElement.inert,
  }));
  expect(shown).toBeGreaterThanOrEqual(called + 3000);
  expect(shown).toBeLessThan(called + 6900);
  expect(played).toBeUndefined();
  expect(inert).toBe(false);
});

test('a tap while the launch screen holds ends it without playing the exit', async ({ page }) => {
  await page.addInitScript(installed);
  await page.addInitScript(slow);
  await page.addInitScript(() => {
    // Without paint timing the copy holds a full 300 ms, slowed here to 3 s.
    Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', { value: [] });
    let exit;
    Object.defineProperty(window, 'launchExit', {
      get: () => exit,
      set: fn => { exit = (...args) => { window.exitCalled = true; return fn(...args); }; },
    });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.id === 'launch-grid') window.exitPlayed = true;
      return animate.call(this, keyframes, options);
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => window.exitCalled);
  const sound = await page.locator('#soundSwitch').getAttribute('aria-pressed');
  const { x, y, width, height } = await page.locator('#soundSwitch').boundingBox();
  await page.mouse.click(x + width / 2, y + height / 2);
  await expect(page.locator('#launch')).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator('#soundSwitch')).toHaveAttribute('aria-pressed', sound);
  expect(await page.evaluate(() => window.exitPlayed)).toBeUndefined();
  expect(await page.evaluate(() => document.documentElement.inert)).toBe(false);
});

for (const phase of ['holds', 'plays']) {
  test(`a touch while the launch ${phase} reaches nothing behind it`, async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript(installed);
    await page.addInitScript(slow);
    // Registered before the page's own listeners, so it sees a click even if the guard eats it.
    await page.addInitScript(() => addEventListener('click', () => { window.clicks = (window.clicks ?? 0) + 1; }, true));
    if (phase === 'holds') await page.addInitScript(() => {
      Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', { value: [] });
      let exit;
      Object.defineProperty(window, 'launchExit', {
        get: () => exit,
        set: fn => { exit = (...args) => { window.exitCalled = true; return fn(...args); }; },
      });
    });
    await page.goto('/');
    if (phase === 'holds') await page.waitForFunction(() => window.exitCalled);
    else await page.waitForFunction(() => document.getElementById('launch-grid')?.getAnimations().length > 0);
    const sound = await page.locator('#soundSwitch').getAttribute('aria-pressed');
    const { x, y, width, height } = await page.locator('#soundSwitch').boundingBox();
    await page.touchscreen.tap(x + width / 2, y + height / 2);
    await expect(page.locator('#launch')).toHaveCount(0, { timeout: 5000 });
    // A click that would reach the switch comes right after the tap.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    await expect(page.locator('#soundSwitch')).toHaveAttribute('aria-pressed', sound);
    // The canceled touch made no click at all.
    expect(await page.evaluate(() => window.clicks)).toBeUndefined();
    await page.touchscreen.tap(x + width / 2, y + height / 2);
    await expect(page.locator('#soundSwitch')).not.toHaveAttribute('aria-pressed', sound);
    await context.close();
  });
}

// Slows only the animations, so the guard's one second after a release runs at its real length.
const slowAnimations = () => {
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    const animation = animate.call(this, keyframes, options);
    animation.playbackRate = 0.1;
    return animation;
  };
};

test('a mouse press held past the launch loses its click, and the next click works', async ({ page }) => {
  await page.addInitScript(installed);
  await page.addInitScript(slowAnimations);
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('launch-grid')?.getAnimations().length > 0);
  const sound = await page.locator('#soundSwitch').getAttribute('aria-pressed');
  const { x, y, width, height } = await page.locator('#soundSwitch').boundingBox();
  await page.mouse.move(x + width / 2, y + height / 2);
  await page.mouse.down();
  await expect(page.locator('#launch')).toHaveCount(0, { timeout: 5000 });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1200)));
  await page.mouse.up();
  await expect(page.locator('#soundSwitch')).toHaveAttribute('aria-pressed', sound);
  await page.mouse.click(x + width / 2, y + height / 2);
  await expect(page.locator('#soundSwitch')).not.toHaveAttribute('aria-pressed', sound);
});

test('a keyboard click right after a skipping press goes through', async ({ page }) => {
  await page.addInitScript(installed);
  await page.addInitScript(slow);
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('launch-grid')?.getAnimations().length > 0);
  const sound = await page.locator('#soundSwitch').getAttribute('aria-pressed');
  // A press whose click never comes, so the guard is still waiting when the key arrives.
  await page.mouse.move(5, 5);
  await page.mouse.down();
  await expect(page.locator('#launch')).toHaveCount(0, { timeout: 5000 });
  await page.locator('#soundSwitch').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#soundSwitch')).not.toHaveAttribute('aria-pressed', sound);
  await page.mouse.up();
});

test('where clicks carry no pointer id, another pointer\'s click after a skipping press goes through', async ({ page }) => {
  await page.addInitScript(installed);
  await page.addInitScript(slow);
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('launch-grid')?.getAnimations().length > 0);
  const sound = await page.locator('#soundSwitch').getAttribute('aria-pressed');
  // Older Safari: a mouse press skips and lifts without a click, then a finger taps the switch.
  await page.evaluate(() => {
    const send = (target, type, init) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, isPrimary: true, button: 0, ...init }));
    const mouse = { pointerId: 1, pointerType: 'mouse' };
    send(document.getElementById('launch'), 'pointerdown', mouse);
    send(document, 'pointerup', mouse);
  });
  await expect(page.locator('#launch')).toHaveCount(0, { timeout: 5000 });
  await page.evaluate(() => {
    const target = document.getElementById('soundSwitch');
    const finger = { bubbles: true, isPrimary: true, button: 0, pointerId: 2, pointerType: 'touch' };
    target.dispatchEvent(new PointerEvent('pointerdown', finger));
    target.dispatchEvent(new PointerEvent('pointerup', finger));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
  await expect(page.locator('#soundSwitch')).not.toHaveAttribute('aria-pressed', sound);
});

test('a key that skips the launch still counts as the first input, which starts the ad beside the board', async ({ page }) => {
  await page.route('https://ihtfy.com/ads/v1.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.ihtfyAds = { show(box) { (window.__shown ??= []).push(box.dataset.adSize); } };',
  }));
  await page.setViewportSize({ width: 1920, height: 850 });
  await page.addInitScript(installed);
  await page.addInitScript(slow);
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('launch-grid')?.getAnimations().length > 0);
  await page.keyboard.press('Shift');
  await expect(page.locator('#launch')).toHaveCount(0, { timeout: 5000 });
  await expect.poll(() => page.evaluate(() => window.__shown), { timeout: 10000 }).toEqual(['300x600']);
});

test('a layout change during the launch aims the icon at the moved board', async ({ page }) => {
  await page.addInitScript(installed);
  await page.addInitScript(slow);
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('launch-grid')?.getAnimations().length > 0);
  // Chrome's window grows like this on a cold start, as its splash leaves.
  const { width, height } = page.viewportSize();
  await page.setViewportSize({ width, height: height + 120 });
  const aim = () => page.evaluate(() => {
    const center = rect => [rect.left + rect.width / 2, rect.top + rect.height / 2];
    const [x0, y0] = center(document.getElementById('launch-icon').getBoundingClientRect());
    const [x, y] = center(document.getElementById('board').shadowRoot.querySelector('[data-square="d4"]').getBoundingClientRect());
    const flight = document.getElementById('launch-grid').getAnimations().find(a => a.effect.getKeyframes()[1].transform !== undefined);
    const [, dx, dy] = flight.effect.getKeyframes()[1].transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    return [Math.abs(dx - (x - x0)), Math.abs(dy - (y - y0))];
  });
  await expect.poll(aim).toEqual([expect.closeTo(0, 0), expect.closeTo(0, 0)]);
  await expect(page.locator('#launch')).toHaveCount(1);
});

test('under reduced motion the launch screen fades out and the game takes input', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(installed);
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    window.launchAnimations = [];
    Element.prototype.animate = function (keyframes, options) {
      window.launchAnimations.push([this.id, Object.keys(keyframes)]);
      return animate.call(this, keyframes, options);
    };
  });
  await page.goto('/');
  await expect(page.locator('#launch')).toHaveCount(0, { timeout: 5000 });
  expect(await page.evaluate(() => window.launchAnimations)).toEqual([['launch', ['opacity']]]);
  await page.locator('#dominationBtn').click();
  await expect(page.locator('#dominationBtn')).toHaveAttribute('aria-pressed', 'true');
});

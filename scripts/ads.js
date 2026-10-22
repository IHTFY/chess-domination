// The ad in the solved dialog comes from the shared IHTFY loader, which
// ihtfy.com serves for all the games (its source is in the IHTFY/com.ihtfy
// repo). Nothing ad-related loads before the first solved board: the loader
// arrives then, and AdSense after it at browser idle.
const LOADER = 'https://ihtfy.com/ads/v1.js';

// The shared 300×250 display unit for the games' result screens.
export const AD_SLOT = '6470163205';

let loader = null;

/** Fills `box` with an ad for the game over named `key`; offline or on failure it stays empty. */
export function showAd(box, key) {
  if (!navigator.onLine) return;
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = LOADER;
    script.addEventListener('load', resolve);
    script.addEventListener('error', () => {
      script.remove();
      loader = null;
      reject(new Error('The ad loader did not load'));
    });
    document.head.appendChild(script);
  });
  loader.then(
    () => box.isConnected && window.ihtfyAds.show(box, key),
    () => {},
  );
}

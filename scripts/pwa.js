// Registers the service worker and offers updates without interrupting play.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

function promptForUpdate(worker) {
  const toast = M.toast({
    html: '<span>New version available</span><button class="btn-flat toast-action" type="button">Update</button>',
    displayLength: 600000,
  });
  toast.el.querySelector('button').addEventListener('click', () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
}

async function init() {
  if (!('serviceWorker' in navigator)) return;
  let controlled = Boolean(navigator.serviceWorker.controller);

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first claim on a fresh install needs no reload; only an update does.
    if (!controlled) {
      controlled = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  const reg = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });

  const watch = worker => worker?.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) promptForUpdate(worker);
  });
  if (reg.waiting && navigator.serviceWorker.controller) promptForUpdate(reg.waiting);
  watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));

  const check = () => reg.update().catch(() => {});
  setInterval(check, UPDATE_CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

init().catch(err => console.error('Service worker not registered.', err));

(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch(() => {
      // The portal remains fully usable when service workers are unavailable.
    });
  });
})();

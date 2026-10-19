(() => {
  "use strict";

  let enabled = false;
  let activeVideo = null;
  let completed = false;
  let currentPath = location.pathname;
  let previousTime = 0;

  function nextShort() {
    if (!enabled || completed || !location.pathname.startsWith("/shorts/")) return;
    const button = document.querySelector(
      "#navigation-button-down button, ytd-shorts #navigation-button-down, " +
      "ytd-shorts button[aria-label='Next video'], ytd-shorts button[aria-label='Следующее видео']"
    );
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
    completed = true;
    button.click();
  }

  function onTimeUpdate() {
    const video = activeVideo;
    if (!video || !enabled) return;
    // YouTube usually loops Shorts, so an ended event alone is insufficient.
    // Detect the wrap as well, without skipping the final seconds of a clip.
    if (!video.seeking && Number.isFinite(video.duration) && video.duration > 0 &&
        previousTime >= video.duration - 0.5 && video.currentTime < 0.5 &&
        previousTime > video.currentTime) nextShort();
    previousTime = video.currentTime;
  }

  function detach() {
    if (activeVideo) {
      activeVideo.removeEventListener("ended", nextShort);
      activeVideo.removeEventListener("timeupdate", onTimeUpdate);
    }
    activeVideo = null;
    previousTime = 0;
  }

  function refresh() {
    if (currentPath !== location.pathname) {
      currentPath = location.pathname;
      completed = false;
      detach();
    }
    if (!enabled || !currentPath.startsWith("/shorts/")) {
      detach();
      return;
    }
    const renderer = document.querySelector("ytd-reel-video-renderer[is-active]");
    const video = renderer?.querySelector("video") || Array.from(
      document.querySelectorAll("ytd-shorts video")
    ).find(candidate => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 &&
        rect.left < innerWidth && rect.right > 0 && !candidate.paused;
    });
    if (video === activeVideo) return;
    detach();
    if (!video) return;
    activeVideo = video;
    completed = false;
    previousTime = video.currentTime;
    video.addEventListener("ended", nextShort);
    video.addEventListener("timeupdate", onTimeUpdate);
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      completed = false;
      refresh();
    }
  });
  browser.storage.local.get({enabled: true}).then(settings => {
    enabled = settings.enabled;
    refresh();
  }).catch(console.error);
  // Polling also handles YouTube's client-side navigation and recycled players.
  setInterval(refresh, 300);
})();

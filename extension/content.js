(() => {
  "use strict";

  let enabled = false;
  let activeVideo = null;
  let completed = false;
  let currentPath = location.pathname;
  let previousTime = 0;
  let pendingSince = 0;

  function nextShort() {
    if (!enabled || completed || !location.pathname.startsWith("/shorts/")) return;
    // Query the inner button first: clicking YouTube's wrapper need not
    // invoke the actual navigation handler.
    const selectors = [
      "#navigation-button-down button",
      "#shorts-navigation-button-down button",
      "yt-shorts-navigation-button-view-model button[aria-label*='Next']",
      "ytd-shorts button[aria-label='Next video']",
      "ytd-shorts button[aria-label='Следующее видео']",
      "button[aria-label='Next video']",
      "button[aria-label='Следующее видео']"
    ];
    const button = selectors.map(selector => document.querySelector(selector)).find(
      candidate => candidate && !candidate.disabled &&
        candidate.getAttribute("aria-disabled") !== "true" &&
        candidate.getClientRects().length > 0
    );
    if (button) {
      completed = true;
      pendingSince = Date.now();
      button.click();
      return;
    }
    // Some YouTube layouts hide the navigation arrows. Scrolling the next
    // renderer into view uses the same Shorts feed as manual scrolling.
    const renderer = activeVideo?.closest("ytd-reel-video-renderer");
    const next = renderer?.nextElementSibling;
    if (next?.matches("ytd-reel-video-renderer")) {
      completed = true;
      pendingSince = Date.now();
      next.scrollIntoView({behavior: "instant", block: "start"});
    }
  }

  function onTimeUpdate() {
    const video = activeVideo;
    if (!video || !enabled || video.paused) return;
    // YouTube usually loops Shorts, so an ended event alone is insufficient.
    // Detect the wrap as well, without skipping the final seconds of a clip.
    if (Number.isFinite(video.duration) && video.duration > 0 &&
        previousTime >= video.duration - 0.75 && video.currentTime < 0.75 &&
        previousTime > video.currentTime) nextShort();
    if (!video.seeking) previousTime = video.currentTime;
  }

  function detach() {
    if (activeVideo) {
      activeVideo.removeEventListener("ended", nextShort);
      activeVideo.removeEventListener("timeupdate", onTimeUpdate);
      activeVideo.removeEventListener("seeked", onTimeUpdate);
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
    if (completed && Date.now() - pendingSince > 1800) completed = false;
    // YouTube may mount the player outside ytd-shorts, and may leave an old
    // renderer marked active during navigation. Choose the visible player.
    const videos = Array.from(document.querySelectorAll("video")).filter(candidate => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 &&
        rect.left < innerWidth && rect.right > 0;
    });
    const video = videos.find(candidate => !candidate.paused) || videos.find(
      candidate => candidate.closest("ytd-reel-video-renderer[is-active]")
    ) || videos[0];
    if (video === activeVideo) {
      if (video?.ended) nextShort();
      return;
    }
    detach();
    if (!video) return;
    activeVideo = video;
    completed = false;
    previousTime = video.currentTime;
    video.addEventListener("ended", nextShort);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onTimeUpdate);
    if (video.ended) nextShort();
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

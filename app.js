/**
 * Lawin Canvas — Foundation (LC001)
 *
 * Flow:
 *  1. Show the branded welcome screen. Camera/AR stays OFF.
 *  2. User taps "Begin AR Experience" -> welcome hides, eagle sound
 *     plays, and MindAR starts.
 *  3. When LC001 is found -> its video plays and stays anchored to it.
 *  4. When tracking is briefly lost -> keep the video playing for 6s.
 *     If the target returns within that window, playback continues.
 *     Otherwise the video pauses.
 *
 * The target/AR structure is intentionally kept compatible with the
 * existing working LC001 build. The welcome screen is UI-only and does
 * not alter the MindAR target, video asset, or compiled targets.mind.
 */

const LOST_GRACE_MS = 6000;

const PAINTINGS = [
  { id: "LC001", targetIndex: 0, videoElId: "video-LC001" },
];

document.addEventListener("DOMContentLoaded", () => {
  enableDebugConsoleIfRequested();

  const welcomeScreen = document.querySelector("#welcome-screen");
  const startBtn = document.querySelector("#start-btn");
  const sceneEl = document.querySelector("#ar-scene");
  const scanMessage = document.querySelector("#scan-message");

  if (!welcomeScreen || !startBtn || !sceneEl) {
    console.error("[LawinCanvas] Required welcome/scene elements not found.");
    return;
  }

  const setScanVisible = (visible) => {
    if (!scanMessage) return;
    scanMessage.classList.toggle("is-visible", visible);
  };

  const startAR = () => {
    const mindarSystem = sceneEl.systems["mindar-image-system"];

    if (!mindarSystem) {
      console.warn("[LawinCanvas] MindAR is still loading; waiting for scene.");
      startBtn.disabled = true;
      sceneEl.addEventListener("loaded", () => {
        startBtn.disabled = false;
        startAR();
      }, { once: true });
      return;
    }

    startBtn.disabled = true;
    welcomeScreen.style.display = "none";
    setScanVisible(true);

    // Play from the button interaction so mobile browser audio policies
    // can accept the user's gesture.
    const eagleSound = new Audio("assets/audio/eagle-sound.mp3");
    eagleSound.preload = "auto";
    eagleSound.play().catch((err) => {
      console.warn("[LawinCanvas] Eagle sound playback failed:", err);
    });

    try {
      mindarSystem.start();
    } catch (err) {
      console.error("[LawinCanvas] MindAR start failed:", err);
      welcomeScreen.style.display = "flex";
      setScanVisible(false);
      startBtn.disabled = false;
      startBtn.textContent = "TRY AGAIN";
    }
  };

  // Keep one click handler so a camera/permission error can be retried.
  startBtn.addEventListener("click", startAR);

  sceneEl.addEventListener("arReady", () => {
    console.log("[LawinCanvas] AR ready.");
    setScanVisible(true);
  });

  sceneEl.addEventListener("arError", (event) => {
    console.error("[LawinCanvas] MindAR error:", event);
    setScanVisible(false);
    welcomeScreen.style.display = "flex";
    startBtn.disabled = false;
    startBtn.textContent = "TRY AGAIN";
  });

  PAINTINGS.forEach((painting) => {
    setupPaintingTracking(painting, setScanVisible);
  });
});

/**
 * Wire targetFound/targetLost handling for one painting.
 * Each painting has its own independent grace-period timer.
 */
function setupPaintingTracking(painting, setScanVisible) {
  const targetEl = document.querySelector(`#target-${painting.targetIndex}`);
  const videoEl = document.querySelector(`#${painting.videoElId}`);

  if (!targetEl) {
    console.error(
      `[LawinCanvas] Target entity not found for ${painting.id} ` +
      `(targetIndex ${painting.targetIndex}).`
    );
    return;
  }

  if (!videoEl) {
    console.error(
      `[LawinCanvas] Video element #${painting.videoElId} not found for ${painting.id}.`
    );
    return;
  }

  let lostGraceTimer = null;

  targetEl.addEventListener("targetFound", () => {
    console.log(`[LawinCanvas] ${painting.id} found.`);
    setScanVisible(false);

    if (lostGraceTimer) {
      clearTimeout(lostGraceTimer);
      lostGraceTimer = null;
      console.log(`[LawinCanvas] ${painting.id} returned during grace period.`);
      return;
    }

    videoEl.currentTime = 0;
    videoEl.play()
      .then(() => console.log(`[LawinCanvas] ${painting.id} video playing.`))
      .catch((err) => {
        console.error(
          `[LawinCanvas] ${painting.id} video play failed:`,
          err
        );
      });
  });

  targetEl.addEventListener("targetLost", () => {
    console.log(
      `[LawinCanvas] ${painting.id} lost. Starting ${LOST_GRACE_MS / 1000}s grace period.`
    );

    setScanVisible(true);

    if (lostGraceTimer) {
      clearTimeout(lostGraceTimer);
    }

    lostGraceTimer = setTimeout(() => {
      lostGraceTimer = null;
      videoEl.pause();
      console.log(
        `[LawinCanvas] ${painting.id} grace period elapsed. Video paused.`
      );
    }, LOST_GRACE_MS);
  });
}

/**
 * Temporary troubleshooting aid: add ?debug=1 to the URL to load Eruda.
 */
function enableDebugConsoleIfRequested() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") !== "1") return;

  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/eruda";
  script.onload = () => {
    if (window.eruda) {
      window.eruda.init();
      console.log("[LawinCanvas] Debug console enabled.");
    }
  };
  document.body.appendChild(script);
}

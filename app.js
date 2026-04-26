/**
 * Dunhuang Cave Mural Candle Explorer
 * Uses MediaPipe Gesture Recognizer or touch to reveal murals with a candle-light effect.
 */
const APP_VERSION = 'v0.8.9';
const MEDIAPIPE_VERSION = '0.10.34';

document.addEventListener('DOMContentLoaded', () => {

  // ---------------------------------------------------------------------------
  // Mural data
  // ---------------------------------------------------------------------------
  const MURALS = [
    { src: 'image/cave17.png', title: 'cave17', type: 'image' },
    { src: 'image/cave112.png', title: 'cave112', type: 'image' },
    { src: 'image/cave3.png', title: 'cave3', type: 'image' },
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let candleX = -100, candleY = -100; // off-screen initially
  let candleActive = false;
  let lightsOn = false;
  let currentMural = 0;
  let touchMode = false;
  let firstResult = true; // flag to hide loading screen on first MediaPipe result
  let zoomLevel = 1.0; // zoom level for mural (1.0 = 100%, 3.0 = 300%)
  let smoothedCandleX = null, smoothedCandleY = null;

  // Distance-based zoom state
  let zoomBaseline = null;
  let zoomBaselineLevel = 1.0;

  // Pan state (for auto-pan at edges)
  let currentPanX = 0, currentPanY = 0;

  const BASE_RADIUS = 180; // candle light radius in px
  const MIN_ZOOM = 1.0;
  const MAX_ZOOM = 3.0;
  const AUTO_PAN_SPEED = 3; // pixels per inference frame
  const EDGE_THRESHOLD = 55; // pixels from edge to trigger auto-pan
  const INFERENCE_INTERVAL_MS = 55; // ~18fps keeps UI smooth on phones
  const MODEL_LOAD_TIMEOUT_MS = 10000;
  const CAMERA_START_TIMEOUT_MS = 12000;
  const STARTUP_FALLBACK_MS = 14000;
  const HAND_MISSING_GRACE_MS = 180;
  const POSITION_SMOOTH_FACTOR = 0.28;
  const ZOOM_DEADBAND = 0.08;
  const ZOOM_SENSITIVITY = 1.25;
  const ZOOM_CHANGE_EPSILON = 0.012;
  const CANDLE_HOLD_GESTURE = 'Closed_Fist';
  const CANDLE_HOLD_MIN_SCORE = 0.55;
  const FIST_MODEL_ASSIST_MIN_SCORE = 0.42;
  const FINGER_CURL_MIN_SCORE = 0.48;
  const FIST_CURL_MIN_AVERAGE = 0.54;
  const FIST_MIN_CURLED_FINGERS = 3;
  const FIST_HOLD_STABLE_FRAMES = 2;
  const FIST_RELEASE_GRACE_FRAMES = 3;

  // The candle graphic sits BELOW the light circle.
  // candleX/Y = center of the light halo (= where the flame is)
  // The candle body starts at the BOTTOM EDGE of the halo and extends downward.

  // ---------------------------------------------------------------------------
  // Canvas setup
  // ---------------------------------------------------------------------------
  const overlayCanvas = document.getElementById('overlay-canvas');
  const ctx = overlayCanvas.getContext('2d');

  function resizeCanvas() {
    overlayCanvas.width = window.innerWidth;
    overlayCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ---------------------------------------------------------------------------
  // MediaPipe Gesture Recognizer init
  // ---------------------------------------------------------------------------
  let gestureRecognizer;
  let lastVideoTime = -1;
  let lastInferenceTime = 0;
  let consecutiveInferenceErrors = 0;
  let fallbackEnabled = false;
  let detectionStarted = false;
  let cameraInitStarted = false;
  let startupFallbackTimer = null;
  let activeCameraStream = null;
  let lastHandSeenAt = 0;

  let fistHoldFrames = 0;
  let fistReleaseFrames = 0;

  let touchZoomStartDistance = null;
  let touchZoomStartLevel = 1.0;
  let lastCandleVisualActive = null;

  function syncCandleVisualState() {
    const candleVisualActive = candleActive && !lightsOn;
    if (lastCandleVisualActive === candleVisualActive) return;
    lastCandleVisualActive = candleVisualActive;
    document.body.classList.toggle('candle-active', candleVisualActive);
  }

  function withTimeout(promise, timeoutMs, label) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
  }

  async function initGestureRecognizer() {
    const { GestureRecognizer, FilesetResolver } = await import(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`
    );

    const vision = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
    );

    async function createRecognizer(delegate) {
      return GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45
      });
    }

    try {
      gestureRecognizer = await createRecognizer("GPU");
    } catch (gpuError) {
      console.warn('GPU gesture delegate unavailable, retrying with CPU:', gpuError);
      gestureRecognizer = await createRecognizer("CPU");
    }
  }

  // ---------------------------------------------------------------------------
  // Hand distance calculation (proxy for depth/zoom)
  // ---------------------------------------------------------------------------
  function calculateHandSize(landmarks) {
    // Blend palm length and palm width so zoom is less affected by finger pose.
    const wrist = landmarks[0];
    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const pinkyMcp = landmarks[17];
    const palmLength = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y);
    const palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
    return Math.max(0.0001, palmLength * 0.65 + palmWidth * 0.35);
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function angleBetween(a, b, c) {
    const abx = a.x - b.x;
    const aby = a.y - b.y;
    const cbx = c.x - b.x;
    const cby = c.y - b.y;
    const dot = abx * cbx + aby * cby;
    const abLength = Math.hypot(abx, aby);
    const cbLength = Math.hypot(cbx, cby);
    if (abLength === 0 || cbLength === 0) return 180;
    const cosine = Math.max(-1, Math.min(1, dot / (abLength * cbLength)));
    return Math.acos(cosine) * 180 / Math.PI;
  }

  function getFingerCurlScore(landmarks, finger) {
    const wrist = landmarks[0];
    const palmCenter = landmarks[9];
    const palmSize = calculateHandSize(landmarks);
    const mcp = landmarks[finger.mcp];
    const pip = landmarks[finger.pip];
    const tip = landmarks[finger.tip];

    const pipAngle = angleBetween(mcp, pip, tip);
    const angleCurl = clamp01((166 - pipAngle) / 58);
    const tipNearPalm = 1 - clamp01((distance(tip, palmCenter) / palmSize - 0.42) / 0.82);
    const tipNotExtended = 1 - clamp01((distance(tip, wrist) / Math.max(0.0001, distance(mcp, wrist)) - 1.22) / 0.78);

    return clamp01(angleCurl * 0.48 + tipNearPalm * 0.34 + tipNotExtended * 0.18);
  }

  function getFistLandmarkSignal(landmarks) {
    const fingers = [
      { name: 'index', mcp: 5, pip: 6, tip: 8 },
      { name: 'middle', mcp: 9, pip: 10, tip: 12 },
      { name: 'ring', mcp: 13, pip: 14, tip: 16 },
      { name: 'pinky', mcp: 17, pip: 18, tip: 20 },
    ];
    const curlScores = fingers.map((finger) => getFingerCurlScore(landmarks, finger));
    const curledCount = curlScores.filter((score) => score >= FINGER_CURL_MIN_SCORE).length;
    const averageCurl = curlScores.reduce((sum, score) => sum + score, 0) / curlScores.length;

    return {
      isFistLike: curledCount >= FIST_MIN_CURLED_FINGERS && averageCurl >= FIST_CURL_MIN_AVERAGE,
      curledCount,
      averageCurl,
    };
  }

  function getCandleHoldSignal(gesture, landmarks) {
    const gestureName = gesture?.categoryName;
    const gestureScore = gesture?.score ?? 0;
    const modelStrong = gestureName === CANDLE_HOLD_GESTURE && gestureScore >= CANDLE_HOLD_MIN_SCORE;
    const modelAssist = gestureName === CANDLE_HOLD_GESTURE && gestureScore >= FIST_MODEL_ASSIST_MIN_SCORE;
    const landmarkSignal = getFistLandmarkSignal(landmarks);
    const rawHold = modelStrong || (landmarkSignal.isFistLike && gestureName !== 'Open_Palm') || (modelAssist && landmarkSignal.curledCount >= 2);

    if (rawHold) {
      fistHoldFrames += 1;
      fistReleaseFrames = 0;
    } else {
      fistReleaseFrames += 1;
      if (fistReleaseFrames > FIST_RELEASE_GRACE_FRAMES) {
        fistHoldFrames = 0;
      }
    }

    return {
      isHolding: fistHoldFrames >= FIST_HOLD_STABLE_FRAMES && fistReleaseFrames <= FIST_RELEASE_GRACE_FRAMES,
      gestureName,
      gestureScore,
      ...landmarkSignal,
    };
  }

  // Smoothed hand size (exponential moving average to reduce jitter)
  let smoothedHandSize = null;
  const SMOOTH_FACTOR = 0.15;

  function resetHandTrackingState(clearHeldGesture = false) {
    candleActive = false;
    zoomBaseline = null;
    smoothedHandSize = null;
    smoothedCandleX = null;
    smoothedCandleY = null;
    fistReleaseFrames = 0;
    fistHoldFrames = 0;
  }

  function setLightsOn(nextLightsOn) {
    lightsOn = nextLightsOn;
    document.body.classList.toggle('lights-on', lightsOn);
    const label = document.querySelector('#light-btn .label');
    if (label) label.textContent = lightsOn ? 'Light Off' : 'Light On';
  }

  function updateCandlePosition(rawX, rawY) {
    const clampedX = Math.max(0, Math.min(overlayCanvas.width, rawX));
    const clampedY = Math.max(0, Math.min(overlayCanvas.height, rawY));

    if (smoothedCandleX === null || smoothedCandleY === null) {
      smoothedCandleX = clampedX;
      smoothedCandleY = clampedY;
    } else {
      smoothedCandleX += (clampedX - smoothedCandleX) * POSITION_SMOOTH_FACTOR;
      smoothedCandleY += (clampedY - smoothedCandleY) * POSITION_SMOOTH_FACTOR;
    }

    candleX = smoothedCandleX;
    candleY = smoothedCandleY;
  }

  // ---------------------------------------------------------------------------
  // Auto-pan when hand is at screen edge (only when zoomed)
  // ---------------------------------------------------------------------------
  function autoPanIfAtEdge(handX, handY) {
    let vx = 0, vy = 0;

    if (handX < EDGE_THRESHOLD) vx = AUTO_PAN_SPEED * ((EDGE_THRESHOLD - handX) / EDGE_THRESHOLD);
    else if (handX > overlayCanvas.width - EDGE_THRESHOLD) {
      vx = -AUTO_PAN_SPEED * ((handX - (overlayCanvas.width - EDGE_THRESHOLD)) / EDGE_THRESHOLD);
    }

    if (handY < EDGE_THRESHOLD) vy = AUTO_PAN_SPEED * ((EDGE_THRESHOLD - handY) / EDGE_THRESHOLD);
    else if (handY > overlayCanvas.height - EDGE_THRESHOLD) {
      vy = -AUTO_PAN_SPEED * ((handY - (overlayCanvas.height - EDGE_THRESHOLD)) / EDGE_THRESHOLD);
    }

    if (vx !== 0 || vy !== 0) {
      currentPanX += vx;
      currentPanY += vy;
      applyPan(currentPanX, currentPanY);
    }
  }

  // ---------------------------------------------------------------------------
  // Gesture results handler (simplified)
  // ---------------------------------------------------------------------------
  function onGestureResults(result) {
    // Hide loading screen on first result
    if (firstResult) {
      firstResult = false;
      document.getElementById('loading-screen').classList.add('fade-out');
    }

    const landmarks = result.landmarks?.[0];
    const gesture = result.gestures?.[0]?.[0] ?? null;

    if (!landmarks) {
      if (Date.now() - lastHandSeenAt > HAND_MISSING_GRACE_MS) {
        resetHandTrackingState(true);
      }
      return;
    }

    lastHandSeenAt = Date.now();

    const holdSignal = getCandleHoldSignal(gesture, landmarks);
    const isHoldingCandle = holdSignal.isHolding;

    if (!isHoldingCandle) {
      candleActive = false;
      zoomBaseline = null;
      smoothedHandSize = null;
      smoothedCandleX = null;
      smoothedCandleY = null;
      return;
    }

    // Relaxed grip / closed fist = hold the candle, move it, and control zoom.
    const palm = landmarks[9];
    updateCandlePosition((1 - palm.x) * overlayCanvas.width, palm.y * overlayCanvas.height);
    candleActive = true;

    const hint = document.getElementById('hint');
    if (hint) hint.classList.add('hidden');

    // Continuous zoom based on hand size in frame
    const rawHandSize = calculateHandSize(landmarks);
    if (smoothedHandSize === null) {
      smoothedHandSize = rawHandSize;
    } else {
      smoothedHandSize = smoothedHandSize * (1 - SMOOTH_FACTOR) + rawHandSize * SMOOTH_FACTOR;
    }

    if (!zoomBaseline) {
      zoomBaseline = smoothedHandSize;
      zoomBaselineLevel = zoomLevel;
    }

    const zoomDelta = (smoothedHandSize / zoomBaseline) - 1;
    if (Math.abs(zoomDelta) < ZOOM_DEADBAND) {
      zoomBaseline = zoomBaseline * 0.98 + smoothedHandSize * 0.02;
      zoomBaselineLevel = zoomLevel;
    } else {
      const effectiveDelta = Math.sign(zoomDelta) * (Math.abs(zoomDelta) - ZOOM_DEADBAND);
      applyZoom(zoomBaselineLevel * (1 + effectiveDelta * ZOOM_SENSITIVITY));
    }

    // Auto-pan when hand at screen edge and zoomed
    if (zoomLevel > 1.0) {
      autoPanIfAtEdge(candleX, candleY);
    }
  }

  // ---------------------------------------------------------------------------
  // Camera init — falls back to touch mode on failure
  // ---------------------------------------------------------------------------
  async function initCamera() {
    if (cameraInitStarted) return;
    cameraInitStarted = true;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API unavailable');
      }

      const video = document.getElementById('camera-video');

      const [stream] = await Promise.all([
        withTimeout(navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user'
          }
        }), CAMERA_START_TIMEOUT_MS, 'Camera start'),
        withTimeout(initGestureRecognizer(), MODEL_LOAD_TIMEOUT_MS, 'Gesture model load')
      ]);

      if (fallbackEnabled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      activeCameraStream = stream;
      video.srcObject = stream;
      await video.play();
      detectionStarted = true;

      document.getElementById('mode-badge').classList.remove('hidden');
      document.getElementById('mode-text').textContent = 'Hand Mode';
      setTimeout(() => {
        if (!touchMode) document.getElementById('mode-badge').classList.add('hidden');
      }, 1800);

      // Process frames
      function processFrame(now) {
        if (fallbackEnabled) return;

        if (
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.currentTime !== lastVideoTime &&
          now - lastInferenceTime >= INFERENCE_INTERVAL_MS
        ) {
          lastVideoTime = video.currentTime;
          lastInferenceTime = now;

          try {
            const result = gestureRecognizer.recognizeForVideo(video, performance.now());
            consecutiveInferenceErrors = 0;
            onGestureResults(result);
          } catch (inferenceError) {
            consecutiveInferenceErrors += 1;
            console.warn('Gesture inference failed:', inferenceError);
            if (consecutiveInferenceErrors >= 10) enableTouchMode();
          }
        }
        requestAnimationFrame(processFrame);
      }
      requestAnimationFrame(processFrame);

    } catch (e) {
      console.warn('Camera unavailable, switching to touch mode:', e);
      enableTouchMode();
    }
  }

  // ---------------------------------------------------------------------------
  // Touch / mouse fallback
  // ---------------------------------------------------------------------------
  function enableTouchMode() {
    if (fallbackEnabled) return;
    fallbackEnabled = true;
    touchMode = true;
    resetHandTrackingState(true);
    clearTimeout(startupFallbackTimer);

    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach((track) => track.stop());
      activeCameraStream = null;
    }

    // Show mode badge and update hint for touch mode
    document.getElementById('mode-badge').classList.remove('hidden');
    document.getElementById('mode-text').textContent = 'Touch Mode';
    const hint = document.getElementById('hint');
    if (hint) {
      hint.querySelector('p').textContent = 'Touch and drag to light the candle';
      const hintSub = hint.querySelector('.hint-sub');
      if (hintSub) hintSub.textContent = 'Two fingers = zoom · Button = lights · Dots = murals';
    }

    // Hide loading screen immediately
    document.getElementById('loading-screen').classList.add('fade-out');

    // Enable pointer events on canvas so touch/mouse events fire
    overlayCanvas.style.pointerEvents = 'auto';

    overlayCanvas.addEventListener('touchstart', handleTouch, { passive: false });
    overlayCanvas.addEventListener('touchmove', handleTouch, { passive: false });
    overlayCanvas.addEventListener('touchend', () => {
      candleActive = false;
      touchZoomStartDistance = null;
    });
    overlayCanvas.addEventListener('touchcancel', () => {
      candleActive = false;
      touchZoomStartDistance = null;
    });

    // Mouse support for desktop testing
    overlayCanvas.addEventListener('mousedown', (e) => { candleActive = true; handleMouse(e); });
    overlayCanvas.addEventListener('mousemove', (e) => { if (candleActive) handleMouse(e); });
    overlayCanvas.addEventListener('mouseup', () => { candleActive = false; });
    overlayCanvas.addEventListener('mouseleave', () => { candleActive = false; });
    overlayCanvas.addEventListener('wheel', handleWheel, { passive: false });
  }

  function handleTouch(e) {
    e.preventDefault();

    if (e.touches.length >= 2) {
      const first = e.touches[0];
      const second = e.touches[1];
      const midpointX = (first.clientX + second.clientX) / 2;
      const midpointY = (first.clientY + second.clientY) / 2;
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);

      updateCandlePosition(midpointX, midpointY);
      candleActive = true;

      if (touchZoomStartDistance === null) {
        touchZoomStartDistance = distance;
        touchZoomStartLevel = zoomLevel;
      } else if (touchZoomStartDistance > 0) {
        applyZoom(touchZoomStartLevel * (distance / touchZoomStartDistance));
      }
      return;
    }

    touchZoomStartDistance = null;
    const touch = e.touches[0];
    if (touch) {
      updateCandlePosition(touch.clientX, touch.clientY);
      candleActive = true;
    }
  }

  function handleMouse(e) {
    updateCandlePosition(e.clientX, e.clientY);
  }

  function handleWheel(e) {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    applyZoom(zoomLevel + direction * 0.08);
  }

  // ---------------------------------------------------------------------------
  // Draw candle graphic
  // baseX/baseY = candle base position (follows hand gesture, completely fixed)
  // flameY      = flame position = baseY - CANDLE_HEIGHT (top of candle)
  // breathe     = smooth sine for flame-only animation
  // The candle body NEVER moves except when the hand moves.
  // ---------------------------------------------------------------------------
  function drawCandle(ctx, baseX, baseY, flameY, breathe) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    const bodyW = 6;
    const bodyH = flameY - baseY + 10;
    const stemH = 8;
    const baseW = 12;
    const baseEH = 4;

    // ── Candle body (ghostly, semi-transparent) ──────────────────
    const bodyGrad = ctx.createLinearGradient(baseX - bodyW, 0, baseX + bodyW, 0);
    bodyGrad.addColorStop(0,   'rgba(200,175,130,0.3)');
    bodyGrad.addColorStop(0.4, 'rgba(245,225,180,0.4)');
    bodyGrad.addColorStop(1,   'rgba(170,145,100,0.3)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(baseX - bodyW, flameY + 8, bodyW * 2, -bodyH, 3);
    ctx.fill();

    // ── Stem ──────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(175,150,95,0.3)';
    ctx.fillRect(baseX - 3, baseY - stemH, 6, stemH);

    // ── Base plate ────────────────────────────────────────────────
    const bGrad = ctx.createLinearGradient(baseX - baseW, 0, baseX + baseW, 0);
    bGrad.addColorStop(0,   'rgba(155,125,70,0.35)');
    bGrad.addColorStop(0.5, 'rgba(210,180,110,0.45)');
    bGrad.addColorStop(1,   'rgba(140,110,60,0.35)');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.ellipse(baseX, baseY, baseW, baseEH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Flame — only the flame sways, body is still ───────────────
    const flameSway = breathe * 3;
    const fx = baseX + flameSway;
    const fy = flameY;

    // Soft glow around flame
    const glowR = ctx.createRadialGradient(fx, fy, 0, fx, fy, 18);
    glowR.addColorStop(0, 'rgba(255,210,70,0.5)');
    glowR.addColorStop(1, 'rgba(255,140,20,0)');
    ctx.fillStyle = glowR;
    ctx.beginPath();
    ctx.arc(fx, fy, 18, 0, Math.PI * 2);
    ctx.fill();

    // Outer flame (orange)
    ctx.beginPath();
    ctx.moveTo(fx, fy - 14);
    ctx.bezierCurveTo(fx + 8,  fy - 4, fx + 6,  fy + 5, fx, fy + 7);
    ctx.bezierCurveTo(fx - 6,  fy + 5, fx - 8,  fy - 4, fx, fy - 14);
    ctx.fillStyle = 'rgba(255, 128, 12, 0.95)';
    ctx.fill();

    // Inner core (yellow)
    ctx.beginPath();
    ctx.moveTo(fx, fy - 9);
    ctx.bezierCurveTo(fx + 4, fy - 1, fx + 3, fy + 4, fx, fy + 6);
    ctx.bezierCurveTo(fx - 3, fy + 4, fx - 4, fy - 1, fx, fy - 9);
    ctx.fillStyle = 'rgba(255, 248, 140, 0.98)';
    ctx.fill();

    // White hot tip
    ctx.beginPath();
    ctx.arc(fx, fy - 1, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 230, 1)';
    ctx.fill();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Render loop — dark overlay with candle-light cutout
  // ---------------------------------------------------------------------------
  function render() {
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;

    if (lightsOn) {
      // Lights on: clear overlay so mural is fully visible
      ctx.clearRect(0, 0, w, h);
      syncCandleVisualState();
      requestAnimationFrame(render);
      return;
    }

    // MUST clear first — otherwise dark overlay accumulates every frame
    ctx.clearRect(0, 0, w, h);

    // Fill dark overlay. Keep the unlit state close to cave darkness; the
    // candle cutout is responsible for revealing mural detail.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, w, h);
    syncCandleVisualState();

    if (candleActive) {
      // Smooth breathing glow — only affects light radius, NOT candle position
      const t = Date.now() / 1000;
      const breathe = Math.sin(t * 2.3) * 0.05 + Math.sin(t * 3.7) * 0.03;
      const flickerRadius = BASE_RADIUS * (1 + breathe);

      // Candle structure:
      //   candleX/Y = where the user's hand is = BASE of the candle
      //   flameY    = candleY - CANDLE_HEIGHT (flame sits at candle top)
      //   Light halo center = flameY (light radiates from the flame upward)
      const CANDLE_HEIGHT = 80; // px from base to flame tip
      const flameY = candleY - CANDLE_HEIGHT;

      // ── Light halo centered on the FLAME (top of candle) ─────────
      ctx.globalCompositeOperation = 'destination-out';
      const gradient = ctx.createRadialGradient(candleX, flameY, 0, candleX, flameY, flickerRadius);
      gradient.addColorStop(0,    'rgba(0,0,0,1)');
      gradient.addColorStop(0.55, 'rgba(0,0,0,1)');
      gradient.addColorStop(0.78, 'rgba(0,0,0,0.78)');
      gradient.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(candleX, flameY, flickerRadius, 0, Math.PI * 2);
      ctx.fill();

      // ── Warm amber tint ────────────────────────────────────────────
      ctx.globalCompositeOperation = 'source-over';
      const warmGlow = ctx.createRadialGradient(candleX, flameY, 0, candleX, flameY, flickerRadius * 0.92);
      warmGlow.addColorStop(0, 'rgba(255, 190, 78, 0.18)');
      warmGlow.addColorStop(0.5, 'rgba(255, 160, 40, 0.08)');
      warmGlow.addColorStop(1, 'rgba(255, 160, 40, 0)');
      ctx.fillStyle = warmGlow;
      ctx.fillRect(0, 0, w, h);

      // ── Draw candle: body at candleX/Y, flame at flameY ───────────
      // breathe only animates the flame flicker, candle body is completely static
      drawCandle(ctx, candleX, candleY, flameY, breathe);
    }

    requestAnimationFrame(render);
  }

  // ---------------------------------------------------------------------------
  // Zoom and pan control
  // ---------------------------------------------------------------------------
  function applyZoom(newZoom, showIndicator = true) {
    const nextZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    const didChange = Math.abs(nextZoomLevel - zoomLevel) >= ZOOM_CHANGE_EPSILON;
    zoomLevel = nextZoomLevel;

    // Reset pan when zooming back to 100%
    if (zoomLevel <= 1.0) {
      currentPanX = 0;
      currentPanY = 0;
    }

    applyTransform();
    if (showIndicator && didChange) showZoomIndicator();
  }

  function applyPan(x, y) {
    const maxPanX = (overlayCanvas.width * (zoomLevel - 1)) / (2 * zoomLevel);
    const maxPanY = (overlayCanvas.height * (zoomLevel - 1)) / (2 * zoomLevel);

    currentPanX = Math.max(-maxPanX, Math.min(maxPanX, x));
    currentPanY = Math.max(-maxPanY, Math.min(maxPanY, y));

    applyTransform();
  }

  function applyTransform() {
    const muralContainer = document.getElementById('mural-container');
    const tx = currentPanX / zoomLevel;
    const ty = currentPanY / zoomLevel;
    muralContainer.style.transform = `scale(${zoomLevel}) translate(${tx}px, ${ty}px)`;
  }

  function showZoomIndicator() {
    const indicator = document.getElementById('zoom-indicator');
    if (!indicator) return;

    indicator.textContent = `${Math.round(zoomLevel * 100)}%`;
    indicator.classList.remove('hidden');

    // Hide after 1.5 seconds
    clearTimeout(showZoomIndicator.timeout);
    showZoomIndicator.timeout = setTimeout(() => {
      indicator.classList.add('hidden');
    }, 1500);
  }

  // ---------------------------------------------------------------------------
  // Light toggle
  // ---------------------------------------------------------------------------
  document.getElementById('light-btn').addEventListener('click', () => {
    setLightsOn(!lightsOn);
  });

  // ---------------------------------------------------------------------------
  // Mural switching
  // ---------------------------------------------------------------------------
  function switchMural(index) {
    if (index === currentMural) return;
    currentMural = index;

    // Reset zoom, pan, and baseline
    zoomLevel = 1.0;
    currentPanX = 0;
    currentPanY = 0;
    zoomBaseline = null;
    smoothedHandSize = null;
    applyTransform();

    const mural = MURALS[index];
    const video = document.getElementById('mural-video');
    const img = document.getElementById('mural-img');

    // Fade out both
    video.classList.add('fade');
    img.classList.add('fade');

    setTimeout(() => {
      if (mural.type === 'video') {
        video.src = mural.src;
        video.style.display = '';
        img.style.display = 'none';
        video.play().then(() => video.classList.remove('fade')).catch(() => video.classList.remove('fade'));
      } else {
        img.src = mural.src;
        img.style.display = '';
        video.style.display = 'none';
        video.pause();
        img.onload = () => img.classList.remove('fade');
      }
      document.getElementById('mural-title').textContent = mural.title;
    }, 300);

    // Update active dot
    document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === index));
  }

  // Wire up dot buttons
  document.querySelectorAll('.dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = parseInt(dot.dataset.index, 10);
      switchMural(index);
    });
  });

  // ---------------------------------------------------------------------------
  // Preload all mural images
  // ---------------------------------------------------------------------------
  MURALS.forEach((m) => {
    const img = new Image();
    img.src = m.src;
  });

  // ---------------------------------------------------------------------------
  // Kick everything off
  // ---------------------------------------------------------------------------
  const versionBadge = document.getElementById('version-badge');
  if (versionBadge) versionBadge.textContent = APP_VERSION;

  render();

  function startExperience() {
    const loadingContent = document.querySelector('.loading-content');
    const loadingHint = document.querySelector('.loading-hint');
    if (loadingContent) loadingContent.classList.add('is-loading');
    if (loadingHint) loadingHint.textContent = 'Loading hand detection model...';

    // Safety timeout: switch to touch mode if startup hangs before the first result.
    clearTimeout(startupFallbackTimer);
    startupFallbackTimer = setTimeout(() => {
      if (!detectionStarted && !fallbackEnabled) {
        console.warn('Gesture startup timeout — switching to touch mode');
        enableTouchMode();
      }
    }, STARTUP_FALLBACK_MS);

    initCamera();
  }

  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', startExperience);
  } else {
    startExperience();
  }

}); // end DOMContentLoaded

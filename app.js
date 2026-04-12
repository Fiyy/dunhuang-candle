/**
 * Dunhuang Cave Mural Candle Explorer
 * Uses MediaPipe Hands (fist gesture) or touch to reveal murals with a candle-light effect.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ---------------------------------------------------------------------------
  // Mural data
  // ---------------------------------------------------------------------------
  const MURALS = [
    { src: 'murals/mural1.mp4', title: 'Buddha and Bodhisattvas', type: 'video' },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Mogao_Cave_217.jpg', title: 'Cave 217 — Pure Land', type: 'image' },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/8/80/Mogao_Cave_156_battle.jpg', title: 'Cave 156 — Battle Scene', type: 'image' },
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

  const BASE_RADIUS = 130; // candle light radius in px

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
  // Helper: Euclidean distance between two landmarks (normalized coords)
  // ---------------------------------------------------------------------------
  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // ---------------------------------------------------------------------------
  // MediaPipe Hands init
  // ---------------------------------------------------------------------------
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults(onHandResults);

  // ---------------------------------------------------------------------------
  // Fist detection + hand results handler
  // ---------------------------------------------------------------------------
  function onHandResults(results) {
    // Hide loading screen on the very first result
    if (firstResult) {
      firstResult = false;
      document.getElementById('loading-screen').classList.add('fade-out');
    }

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      candleActive = false;
      return;
    }

    const landmarks = results.multiHandLandmarks[0];

    // Landmark indices
    const WRIST = 0;
    // Finger MCPs and TIPs
    const FINGERS = [
      { mcp: 5,  tip: 8  }, // index
      { mcp: 9,  tip: 12 }, // middle
      { mcp: 13, tip: 16 }, // ring
      { mcp: 17, tip: 20 }, // pinky
    ];

    // Count fingers where tip is closer to wrist than mcp is (i.e. curled)
    let curledCount = 0;
    for (const finger of FINGERS) {
      const tipDist = dist(landmarks[finger.tip], landmarks[WRIST]);
      const mcpDist = dist(landmarks[finger.mcp], landmarks[WRIST]);
      if (tipDist < mcpDist) curledCount++;
    }

    const isFist = curledCount >= 3;

    if (isFist) {
      // Use middle finger MCP (landmark 9) as palm center
      const palm = landmarks[9];
      // Mirror X for front-facing camera
      candleX = (1 - palm.x) * overlayCanvas.width;
      candleY = palm.y * overlayCanvas.height;
      candleActive = true;
      // Hide the hint after first successful gesture
      const hint = document.getElementById('hint');
      if (hint) hint.classList.add('hidden');
    } else {
      candleActive = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Camera init — falls back to touch mode on failure
  // ---------------------------------------------------------------------------
  async function initCamera() {
    try {
      const video = document.getElementById('camera-video');
      const camera = new Camera(video, {
        onFrame: async () => {
          await hands.send({ image: video });
        },
        width: 640,
        height: 480,
        facingMode: 'user'
      });
      await camera.start();
      // Loading screen is hidden on first onResults call
    } catch (e) {
      console.warn('Camera unavailable, switching to touch mode:', e);
      enableTouchMode();
    }
  }

  // ---------------------------------------------------------------------------
  // Touch / mouse fallback
  // ---------------------------------------------------------------------------
  function enableTouchMode() {
    touchMode = true;

    // Show mode badge and update hint for touch mode
    document.getElementById('mode-badge').classList.remove('hidden');
    document.getElementById('mode-text').textContent = 'Touch Mode';
    const hint = document.getElementById('hint');
    if (hint) hint.querySelector('p').textContent = 'Touch and drag to light the candle';

    // Hide loading screen immediately
    document.getElementById('loading-screen').classList.add('fade-out');

    // Enable pointer events on canvas so touch/mouse events fire
    overlayCanvas.style.pointerEvents = 'auto';

    overlayCanvas.addEventListener('touchstart', handleTouch, { passive: false });
    overlayCanvas.addEventListener('touchmove', handleTouch, { passive: false });
    overlayCanvas.addEventListener('touchend', () => { candleActive = false; });

    // Mouse support for desktop testing
    overlayCanvas.addEventListener('mousedown', (e) => { candleActive = true; handleMouse(e); });
    overlayCanvas.addEventListener('mousemove', (e) => { if (candleActive) handleMouse(e); });
    overlayCanvas.addEventListener('mouseup', () => { candleActive = false; });
  }

  function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      candleX = touch.clientX;
      candleY = touch.clientY;
      candleActive = true;
    }
  }

  function handleMouse(e) {
    candleX = e.clientX;
    candleY = e.clientY;
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

    const bodyW = 11;
    const bodyH = flameY - baseY + 10; // spans from base up to just below flame
    const stemH = 8;
    const baseW = 19;
    const baseEH = 5; // base ellipse height

    // ── Candle body (completely static — no flickerR involved) ─────
    const bodyGrad = ctx.createLinearGradient(baseX - bodyW, 0, baseX + bodyW, 0);
    bodyGrad.addColorStop(0,   'rgba(200,175,130,0.8)');
    bodyGrad.addColorStop(0.4, 'rgba(245,225,180,0.95)');
    bodyGrad.addColorStop(1,   'rgba(170,145,100,0.8)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(baseX - bodyW, flameY + 8, bodyW * 2, -bodyH, 3);
    ctx.fill();

    // ── Stem ──────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(175,150,95,0.8)';
    ctx.fillRect(baseX - 4, baseY - stemH, 8, stemH);

    // ── Base plate ────────────────────────────────────────────────
    const bGrad = ctx.createLinearGradient(baseX - baseW, 0, baseX + baseW, 0);
    bGrad.addColorStop(0,   'rgba(155,125,70,0.9)');
    bGrad.addColorStop(0.5, 'rgba(210,180,110,1)');
    bGrad.addColorStop(1,   'rgba(140,110,60,0.9)');
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
      requestAnimationFrame(render);
      return;
    }

    // MUST clear first — otherwise dark overlay accumulates every frame
    ctx.clearRect(0, 0, w, h);

    // Fill dark overlay — low opacity so dimmed mural is visible underneath
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, w, h);

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
      gradient.addColorStop(0.45, 'rgba(0,0,0,0.95)');
      gradient.addColorStop(0.75, 'rgba(0,0,0,0.6)');
      gradient.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(candleX, flameY, flickerRadius, 0, Math.PI * 2);
      ctx.fill();

      // ── Warm amber tint ────────────────────────────────────────────
      ctx.globalCompositeOperation = 'source-over';
      const warmGlow = ctx.createRadialGradient(candleX, flameY, 0, candleX, flameY, flickerRadius * 0.8);
      warmGlow.addColorStop(0, 'rgba(255, 160, 40, 0.12)');
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
  // Light toggle
  // ---------------------------------------------------------------------------
  document.getElementById('light-btn').addEventListener('click', () => {
    lightsOn = !lightsOn;
    document.body.classList.toggle('lights-on', lightsOn);
    const label = document.querySelector('#light-btn .label');
    label.textContent = lightsOn ? 'Light Off' : 'Light On';
  });

  // ---------------------------------------------------------------------------
  // Mural switching
  // ---------------------------------------------------------------------------
  function switchMural(index) {
    if (index === currentMural) return;
    currentMural = index;

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
  render();

  // Safety timeout: hide loading screen after 5s even if MediaPipe fails
  setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && !loadingScreen.classList.contains('fade-out')) {
      loadingScreen.classList.add('fade-out');
      console.warn('Loading screen timeout — MediaPipe may have failed to load');
    }
  }, 5000);

  initCamera();

}); // end DOMContentLoaded

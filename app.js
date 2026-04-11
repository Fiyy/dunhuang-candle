/**
 * Dunhuang Cave Mural Candle Explorer
 * Uses MediaPipe Hands (fist gesture) or touch to reveal murals with a candle-light effect.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ---------------------------------------------------------------------------
  // Mural data
  // ---------------------------------------------------------------------------
  const MURALS = [
    { src: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Buddha_and_Bodhisattvas_Dunhuang_Mogao_Caves.png', title: 'Buddha and Bodhisattvas' },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Mogao_Cave_217.jpg', title: 'Cave 217 — Pure Land' },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/8/80/Mogao_Cave_156_battle.jpg', title: 'Cave 156 — Battle Scene' },
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

  const BASE_RADIUS = 100; // candle light radius in px

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

    // Fill dark overlay
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.93)';
    ctx.fillRect(0, 0, w, h);

    if (candleActive) {
      // Subtle flicker: jitter radius and position slightly each frame
      const flickerRadius = BASE_RADIUS + (Math.random() - 0.5) * BASE_RADIUS * 0.1;
      const flickerX = candleX + (Math.random() - 0.5) * 4;
      const flickerY = candleY + (Math.random() - 0.5) * 4;

      // Cut a transparent hole through the dark overlay using destination-out
      ctx.globalCompositeOperation = 'destination-out';
      const gradient = ctx.createRadialGradient(flickerX, flickerY, 0, flickerX, flickerY, flickerRadius);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(0.5, 'rgba(0,0,0,0.9)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(flickerX, flickerY, flickerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Warm amber glow overlay on top of the revealed area
      ctx.globalCompositeOperation = 'source-over';
      const warmGlow = ctx.createRadialGradient(flickerX, flickerY, 0, flickerX, flickerY, flickerRadius * 0.7);
      warmGlow.addColorStop(0, 'rgba(255, 170, 50, 0.07)');
      warmGlow.addColorStop(1, 'rgba(255, 170, 50, 0)');
      ctx.fillStyle = warmGlow;
      ctx.fillRect(0, 0, w, h);
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

    const img = document.getElementById('mural-img');
    img.classList.add('fade');

    setTimeout(() => {
      img.src = MURALS[index].src;
      img.onload = () => img.classList.remove('fade');
      document.getElementById('mural-title').textContent = MURALS[index].title;
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
  initCamera();

}); // end DOMContentLoaded

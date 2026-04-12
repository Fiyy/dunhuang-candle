"""
Generate a 2.5D parallax animation video from a static mural image.
Memory-efficient: writes frames directly to video, no list storage.
"""
import cv2
import numpy as np
import imageio
import os

# ── Config ──────────────────────────────────────────────────────
INPUT  = '/tmp/mural_src.png'
OUTPUT = '/root/code/dunhuang-candle/murals/mural1.mp4'
FPS    = 20
DURATION = 6       # seconds per cycle
LOOPS  = 2         # repeat cycles
TOTAL_FRAMES = FPS * DURATION
MAX_SHIFT_X = 18
MAX_SHIFT_Y = 10
# Smaller output to save memory
OUT_W, OUT_H = 480, 640

# ── Load and prepare ────────────────────────────────────────────
img_raw = cv2.imread(INPUT, cv2.IMREAD_COLOR)
PAD = 40
img = cv2.resize(img_raw, (OUT_W + PAD*2, OUT_H + PAD*2), interpolation=cv2.INTER_LINEAR)
h, w = img.shape[:2]

# ── Pseudo depth map ────────────────────────────────────────────
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
gray = cv2.GaussianBlur(gray, (31, 31), 0)
vert = np.linspace(0.0, 1.0, h, dtype=np.float32).reshape(-1, 1)
vert = np.broadcast_to(vert, (h, w)).copy()
depth = 0.6 * gray + 0.4 * vert
depth = (depth - depth.min()) / (depth.max() - depth.min() + 1e-6)
depth = cv2.GaussianBlur(depth, (61, 61), 0)

# Pre-compute base grid (float32)
base_y, base_x = np.mgrid[0:h, 0:w].astype(np.float32)
inv_depth = (1.0 - depth).astype(np.float32)

# ── Write video frame by frame ──────────────────────────────────
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
writer = imageio.get_writer(OUTPUT, fps=FPS, codec='libx264',
                            quality=7, pixelformat='yuv420p')

total = TOTAL_FRAMES * LOOPS
print(f'Generating {total} frames ({LOOPS}x{DURATION}s @ {FPS}fps)...')

for frame_i in range(total):
    t = (frame_i % TOTAL_FRAMES) / TOTAL_FRAMES
    px = np.sin(2 * np.pi * t)
    py = np.sin(2 * np.pi * t + 0.7)

    map_x = (base_x + inv_depth * np.float32(MAX_SHIFT_X * px)).astype(np.float32)
    map_y = (base_y + inv_depth * np.float32(MAX_SHIFT_Y * py)).astype(np.float32)

    warped = cv2.remap(img, map_x, map_y,
                       interpolation=cv2.INTER_LINEAR,
                       borderMode=cv2.BORDER_REFLECT_101)
    cropped = warped[PAD:PAD+OUT_H, PAD:PAD+OUT_W]
    writer.append_data(cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB))

    if (frame_i + 1) % FPS == 0:
        print(f'  {frame_i+1}/{total}')

writer.close()
fsize = os.path.getsize(OUTPUT) / 1024
print(f'Done! {OUTPUT} ({fsize:.0f}KB, {LOOPS*DURATION}s)')

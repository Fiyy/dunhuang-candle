"""
Split mural foreground into horizontal bands (top/mid/bottom)
for independent parallax animation. Works better for dense murals
where figures overlap and can't be separated by contour detection.
"""
import cv2
import numpy as np
from PIL import Image
from rembg import remove
import imageio
import os

INPUT = '/tmp/mural_src.png'
OUT_DIR = '/root/code/dunhuang-candle/murals/layers'
VIDEO_OUT = '/root/code/dunhuang-candle/murals/mural1_layered.mp4'
OUT_W, OUT_H = 480, 640
FPS = 20
DURATION = 8
TOTAL = FPS * DURATION

os.makedirs(OUT_DIR, exist_ok=True)

# ── Load ────────────────────────────────────────────────────────
print('Loading...')
pil_img = Image.open(INPUT).convert('RGBA').resize((OUT_W, OUT_H), Image.LANCZOS)
fg_pil = remove(pil_img)
fg_np = np.array(fg_pil)
alpha = fg_np[:, :, 3]

bg_np = np.array(pil_img.convert('RGB'))
mask_inp = (alpha > 128).astype(np.uint8) * 255
bg = cv2.inpaint(bg_np, mask_inp, inpaintRadius=15, flags=cv2.INPAINT_TELEA)
cv2.imwrite(os.path.join(OUT_DIR, 'background.png'), cv2.cvtColor(bg, cv2.COLOR_RGB2BGR))

# ── Split foreground into 4 horizontal bands ────────────────────
print('Splitting into bands...')
band_h = OUT_H // 4
bands = []
for i in range(4):
    y0 = i * band_h
    y1 = (i + 1) * band_h if i < 3 else OUT_H

    # Create soft-edge mask for this band
    band_mask = np.zeros((OUT_H, OUT_W), dtype=np.float32)
    # Hard region
    band_mask[y0:y1, :] = 1.0
    # Feather edges (30px gradient)
    feather = 30
    for y in range(max(0, y0 - feather), y0):
        band_mask[y, :] = (y - (y0 - feather)) / feather
    for y in range(y1, min(OUT_H, y1 + feather)):
        band_mask[y, :] = 1.0 - (y - y1) / feather

    # Apply to foreground alpha
    band_rgba = fg_np.copy()
    band_rgba[:, :, 3] = (band_rgba[:, :, 3].astype(np.float32) * band_mask).astype(np.uint8)

    area = np.count_nonzero(band_rgba[:, :, 3] > 10)
    if area < 200:
        continue

    M = cv2.moments(band_mask * (alpha > 10).astype(np.float32))
    cx = int(M['m10'] / max(M['m00'], 1))
    cy = int(M['m01'] / max(M['m00'], 1))

    bands.append({'rgba': band_rgba, 'center': (cx, cy), 'depth': i / 3.0})
    Image.fromarray(band_rgba, 'RGBA').save(os.path.join(OUT_DIR, f'band_{i}.png'))

print(f'  Created {len(bands)} bands')

# ── Generate animation: each band moves independently ───────────
print(f'Generating animation ({TOTAL} frames)...')
writer = imageio.get_writer(VIDEO_OUT, fps=FPS, codec='libx264',
                            quality=7, pixelformat='yuv420p')

# Also add background parallax (slow drift)
bg_pad = 30
bg_large = cv2.resize(bg, (OUT_W + bg_pad*2, OUT_H + bg_pad*2))

for fi in range(TOTAL):
    t = fi / TOTAL

    # Background: very slow drift
    bg_dx = int(np.sin(2 * np.pi * t) * bg_pad * 0.5)
    bg_dy = int(np.sin(2 * np.pi * t * 0.7) * bg_pad * 0.3)
    canvas = bg_large[bg_pad+bg_dy:bg_pad+bg_dy+OUT_H, bg_pad+bg_dx:bg_pad+bg_dx+OUT_W].copy()

    # Composite each band with independent motion
    for idx, band in enumerate(bands):
        depth = band['depth']  # 0=top(far), 1=bottom(close)
        phase = idx * 0.5

        # Deeper layers move more (parallax)
        amplitude_x = 2 + depth * 5
        amplitude_y = 1 + depth * 3
        speed_x = 1.0 + depth * 0.3
        speed_y = 0.6 + depth * 0.2

        dx = np.sin(2 * np.pi * t * speed_x + phase) * amplitude_x
        dy = np.sin(2 * np.pi * t * speed_y + phase) * amplitude_y
        scale = 1.0 + np.sin(2 * np.pi * t * 0.3 + phase) * (0.005 + depth * 0.01)

        cx, cy = band['center']
        M = cv2.getRotationMatrix2D((cx, cy), 0, scale)
        M[0, 2] += dx
        M[1, 2] += dy

        band_t = cv2.warpAffine(band['rgba'], M, (OUT_W, OUT_H),
                                flags=cv2.INTER_LINEAR,
                                borderMode=cv2.BORDER_CONSTANT,
                                borderValue=(0, 0, 0, 0))

        a = band_t[:, :, 3].astype(np.float32) / 255.0
        for c in range(3):
            canvas[:, :, c] = (canvas[:, :, c] * (1 - a) + band_t[:, :, c] * a).astype(np.uint8)

    writer.append_data(canvas)
    if (fi + 1) % FPS == 0:
        print(f'  {fi+1}/{TOTAL}')

writer.close()
print(f'Done! {VIDEO_OUT} ({os.path.getsize(VIDEO_OUT)/1024:.0f}KB, {DURATION}s)')

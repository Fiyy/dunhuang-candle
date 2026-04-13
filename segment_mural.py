"""
Segment mural into layers: background + individual foreground figures.
Uses rembg for foreground extraction, then connected components to split figures.
Outputs: layered PNGs + a parallax animation video with independent motion.
"""
import cv2
import numpy as np
from PIL import Image
from rembg import remove
import os

INPUT = '/tmp/mural_src.png'
OUT_DIR = '/root/code/dunhuang-candle/murals/layers'
VIDEO_OUT = '/root/code/dunhuang-candle/murals/mural1_layered.mp4'
OUT_W, OUT_H = 480, 640
FPS = 20
DURATION = 8
TOTAL_FRAMES = FPS * DURATION

os.makedirs(OUT_DIR, exist_ok=True)

# ── Step 1: Load and resize ─────────────────────────────────────
print('Loading image...')
pil_img = Image.open(INPUT).convert('RGBA')
pil_img = pil_img.resize((OUT_W, OUT_H), Image.LANCZOS)

# ── Step 2: Extract foreground mask with rembg ──────────────────
print('Extracting foreground with AI (rembg)...')
fg_pil = remove(pil_img)  # returns RGBA with transparent background
fg_np = np.array(fg_pil)
alpha = fg_np[:, :, 3]  # foreground mask

# Save foreground
fg_pil.save(os.path.join(OUT_DIR, 'foreground.png'))
print(f'  Foreground extracted, non-zero pixels: {np.count_nonzero(alpha)}')

# ── Step 3: Create background (inpaint where foreground was) ────
print('Creating background layer...')
bg_np = np.array(pil_img.convert('RGB'))
# Simple inpaint: fill foreground area with surrounding colors
mask_inpaint = (alpha > 128).astype(np.uint8) * 255
bg_inpainted = cv2.inpaint(bg_np, mask_inpaint, inpaintRadius=15, flags=cv2.INPAINT_TELEA)
cv2.imwrite(os.path.join(OUT_DIR, 'background.png'), cv2.cvtColor(bg_inpainted, cv2.COLOR_RGB2BGR))
print('  Background inpainted')

# ── Step 4: Split foreground into individual figures ───────────
print('Splitting foreground into individual figures...')
# Use connected components to find separate blobs
alpha_bin = (alpha > 128).astype(np.uint8)
# Morphology to close small gaps
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
alpha_closed = cv2.morphologyEx(alpha_bin, cv2.MORPH_CLOSE, kernel)

num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(alpha_closed, connectivity=8)

# Filter out small components (noise)
MIN_AREA = 500
figures = []
for i in range(1, num_labels):  # skip 0 = background
    area = stats[i, cv2.CC_STAT_AREA]
    if area < MIN_AREA:
        continue

    # Extract this figure's mask
    fig_mask = (labels == i).astype(np.uint8) * 255
    # Extract RGBA for this figure
    fig_rgba = fg_np.copy()
    fig_rgba[:, :, 3] = np.minimum(fig_rgba[:, :, 3], fig_mask)

    # Get bounding box
    x, y, w, h = stats[i, cv2.CC_STAT_LEFT], stats[i, cv2.CC_STAT_TOP], stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
    cx, cy = centroids[i]

    figures.append({
        'id': i,
        'mask': fig_mask,
        'rgba': fig_rgba,
        'bbox': (x, y, w, h),
        'center': (int(cx), int(cy)),
        'area': area
    })

    # Save individual figure
    fig_pil = Image.fromarray(fig_rgba, 'RGBA')
    fig_pil.save(os.path.join(OUT_DIR, f'figure_{i:02d}.png'))

print(f'  Found {len(figures)} figures')

# ── Step 5: Generate layered animation video ───────────────────
print(f'Generating layered animation ({TOTAL_FRAMES} frames)...')
import imageio

writer = imageio.get_writer(VIDEO_OUT, fps=FPS, codec='libx264',
                            quality=7, pixelformat='yuv420p')

for frame_i in range(TOTAL_FRAMES):
    t = frame_i / TOTAL_FRAMES

    # Start with background
    canvas = bg_inpainted.copy()

    # Composite each figure with independent motion
    for idx, fig in enumerate(figures):
        # Each figure gets unique motion based on its position
        phase_offset = idx * 0.3 + fig['center'][1] / OUT_H  # vertical position affects phase

        # Gentle sway + breathing
        dx = np.sin(2 * np.pi * t + phase_offset) * 3
        dy = np.sin(2 * np.pi * t * 0.7 + phase_offset) * 2
        scale = 1.0 + np.sin(2 * np.pi * t * 0.5 + phase_offset) * 0.01  # subtle breathing

        # Apply transform
        cx, cy = fig['center']
        M = cv2.getRotationMatrix2D((cx, cy), 0, scale)
        M[0, 2] += dx
        M[1, 2] += dy

        fig_transformed = cv2.warpAffine(fig['rgba'], M, (OUT_W, OUT_H),
                                         flags=cv2.INTER_LINEAR,
                                         borderMode=cv2.BORDER_CONSTANT,
                                         borderValue=(0, 0, 0, 0))

        # Alpha blend onto canvas
        alpha_f = fig_transformed[:, :, 3].astype(np.float32) / 255.0
        for c in range(3):
            canvas[:, :, c] = (canvas[:, :, c] * (1 - alpha_f) +
                               fig_transformed[:, :, c] * alpha_f).astype(np.uint8)

    writer.append_data(canvas)

    if (frame_i + 1) % FPS == 0:
        print(f'  {frame_i+1}/{TOTAL_FRAMES}')

writer.close()
fsize = os.path.getsize(VIDEO_OUT) / 1024
print(f'Done! {VIDEO_OUT} ({fsize:.0f}KB, {DURATION}s)')
print(f'Layers saved to {OUT_DIR}/')


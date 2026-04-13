"""
Advanced mural segmentation: split foreground into multiple figures
using watershed algorithm + color clustering.
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

# ── Load and extract foreground ─────────────────────────────────
print('Loading and extracting foreground...')
pil_img = Image.open(INPUT).convert('RGBA')
pil_img = pil_img.resize((OUT_W, OUT_H), Image.LANCZOS)
fg_pil = remove(pil_img)
fg_np = np.array(fg_pil)
alpha = fg_np[:, :, 3]

fg_pil.save(os.path.join(OUT_DIR, 'foreground.png'))

# Background
bg_np = np.array(pil_img.convert('RGB'))
mask_inpaint = (alpha > 128).astype(np.uint8) * 255
bg_inpainted = cv2.inpaint(bg_np, mask_inpaint, inpaintRadius=15, flags=cv2.INPAINT_TELEA)
cv2.imwrite(os.path.join(OUT_DIR, 'background.png'), cv2.cvtColor(bg_inpainted, cv2.COLOR_RGB2BGR))

# ── Advanced segmentation: Watershed on foreground ──────────────
print('Splitting foreground with watershed...')
alpha_bin = (alpha > 128).astype(np.uint8)

# Distance transform to find "sure foreground" peaks
dist = cv2.distanceTransform(alpha_bin, cv2.DIST_L2, 5)
# Find local maxima (peaks = centers of figures)
_, sure_fg = cv2.threshold(dist, 0.3 * dist.max(), 255, 0)
sure_fg = sure_fg.astype(np.uint8)

# Find "sure background" (dilate foreground)
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
sure_bg = cv2.dilate(alpha_bin, kernel, iterations=3)

# Unknown region
unknown = cv2.subtract(sure_bg, sure_fg)

# Marker labeling
_, markers = cv2.connectedComponents(sure_fg)
markers = markers + 1  # background = 1
markers[unknown == 255] = 0  # unknown = 0

# Watershed (needs 3-channel image)
fg_bgr = cv2.cvtColor(fg_np[:, :, :3], cv2.COLOR_RGB2BGR)
markers = cv2.watershed(fg_bgr, markers)

# Extract each segment
figures = []
unique_labels = np.unique(markers)
unique_labels = unique_labels[(unique_labels > 1)]  # skip background(1) and boundary(-1)

print(f'  Watershed found {len(unique_labels)} regions')

for label in unique_labels:
    fig_mask = (markers == label).astype(np.uint8) * 255

    # Filter small regions
    area = np.count_nonzero(fig_mask)
    if area < 800:
        continue

    # Extract RGBA
    fig_rgba = fg_np.copy()
    fig_rgba[:, :, 3] = np.minimum(fig_rgba[:, :, 3], fig_mask)

    # Get properties
    M = cv2.moments(fig_mask)
    if M['m00'] == 0:
        continue
    cx = int(M['m10'] / M['m00'])
    cy = int(M['m01'] / M['m00'])

    figures.append({
        'id': len(figures) + 1,
        'rgba': fig_rgba,
        'center': (cx, cy),
        'area': area
    })

    fig_pil = Image.fromarray(fig_rgba, 'RGBA')
    fig_pil.save(os.path.join(OUT_DIR, f'figure_{len(figures):02d}.png'))

print(f'  Extracted {len(figures)} figures')

# ── Generate animation ──────────────────────────────────────────
print(f'Generating animation ({TOTAL_FRAMES} frames)...')
import imageio

writer = imageio.get_writer(VIDEO_OUT, fps=FPS, codec='libx264',
                            quality=7, pixelformat='yuv420p')

for frame_i in range(TOTAL_FRAMES):
    t = frame_i / TOTAL_FRAMES
    canvas = bg_inpainted.copy()

    for idx, fig in enumerate(figures):
        phase = idx * 0.4 + fig['center'][1] / OUT_H
        dx = np.sin(2 * np.pi * t + phase) * 4
        dy = np.sin(2 * np.pi * t * 0.6 + phase) * 2.5
        scale = 1.0 + np.sin(2 * np.pi * t * 0.4 + phase) * 0.015

        cx, cy = fig['center']
        M = cv2.getRotationMatrix2D((cx, cy), 0, scale)
        M[0, 2] += dx
        M[1, 2] += dy

        fig_t = cv2.warpAffine(fig['rgba'], M, (OUT_W, OUT_H),
                               flags=cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_CONSTANT,
                               borderValue=(0, 0, 0, 0))

        alpha_f = fig_t[:, :, 3].astype(np.float32) / 255.0
        for c in range(3):
            canvas[:, :, c] = (canvas[:, :, c] * (1 - alpha_f) +
                               fig_t[:, :, c] * alpha_f).astype(np.uint8)

    writer.append_data(canvas)
    if (frame_i + 1) % FPS == 0:
        print(f'  {frame_i+1}/{TOTAL_FRAMES}')

writer.close()
print(f'Done! {VIDEO_OUT} ({os.path.getsize(VIDEO_OUT)/1024:.0f}KB)')

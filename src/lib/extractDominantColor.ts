export type Hsl = { h: number; s: number; l: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
    }

    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToCssVarValue(hsl: Hsl) {
  return `${clamp(hsl.h, 0, 360)} ${clamp(hsl.s, 0, 100)}% ${clamp(hsl.l, 0, 100)}%`;
}

export type DominantColorResult = {
  rgb: { r: number; g: number; b: number };
  hsl: Hsl;
};

/**
 * Attempts to extract a representative (average) color from an image URL.
 *
 * Notes:
 * - Will fail for some remote URLs due to CORS. In that case, return null.
 * - Designed for small logos; samples a downscaled version for performance.
 */
export async function extractDominantColorFromImageUrl(url: string): Promise<DominantColorResult | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.loading = "eager";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = url;
    });

    const size = 48; // enough for logos, cheap to compute
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    // draw centered & contain
    ctx.clearRect(0, 0, size, size);
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const dx = (size - w) / 2;
    const dy = (size - h) / 2;
    ctx.drawImage(img, dx, dy, w, h);

    const { data } = ctx.getImageData(0, 0, size, size);

    // Average over non-transparent pixels, and skip near-white/near-black to avoid background.
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 32) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const isNearWhite = min > 235;
      const isNearBlack = max < 20;
      if (isNearWhite || isNearBlack) continue;

      rSum += r;
      gSum += g;
      bSum += b;
      count++;
    }

    if (!count) return null;

    const r = Math.round(rSum / count);
    const g = Math.round(gSum / count);
    const b = Math.round(bSum / count);

    return { rgb: { r, g, b }, hsl: rgbToHsl(r, g, b) };
  } catch {
    return null;
  }
}

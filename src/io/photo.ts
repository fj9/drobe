/** Resize a chosen photo on the device: 800 px full + 240 px thumbnail, WebP (JPEG fallback), ~80% quality. */
export const FULL_EDGE = 800;
export const THUMB_EDGE = 240;
const QUALITY = 0.8;

function scaleTo(w: number, h: number, edge: number) {
  const k = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

function encode(source: CanvasImageSource, w: number, h: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(source, 0, 0, w, h);
  const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, QUALITY));
  // Safari can't encode WebP and silently returns PNG, so check the type we got back.
  return toBlob('image/webp').then(async (b) => (b && b.type === 'image/webp' ? b : (await toBlob('image/jpeg'))!));
}

/** Re-encoding drops EXIF (including location). The original is not kept. */
export async function resizePhoto(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const f = scaleTo(bmp.width, bmp.height, FULL_EDGE);
    const t = scaleTo(bmp.width, bmp.height, THUMB_EDGE);
    return { full: await encode(bmp, f.w, f.h), thumb: await encode(bmp, t.w, t.h) };
  } finally {
    bmp.close();
  }
}

export async function blobToDataUrl(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${b.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

export const dataUrlToBlob = async (u: string) => (await fetch(u)).blob();

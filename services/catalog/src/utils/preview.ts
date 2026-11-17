// Files the browser can show on the asset page (GET /api/assets/:id/file, README "Náhled").
// The content type comes from this table, never from the uploader, and nothing here can run a script
// (no SVG, no HTML), so a file opened directly in a tab stays a picture, a model or a sound.
const PREVIEW_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

// Catalog cards show the picture itself only up to this size, so a page of cards never loads hundreds of MB.
const CARD_IMAGE_MAX_BYTES = 5 * 1024 ** 2;

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

// null: this file type has no preview.
export function previewContentType(fileName: string): string | null {
  return PREVIEW_TYPES[extension(fileName)] ?? null;
}

// The URL cards use as their picture: small images only, everything else keeps the drawn cover.
export function cardPreviewUrl(asset: { id: string; fileName: string; fileSize: number }): string | null {
  const type = previewContentType(asset.fileName);
  return type?.startsWith('image/') && asset.fileSize <= CARD_IMAGE_MAX_BYTES ? `/api/assets/${asset.id}/file` : null;
}

export type ByteRange = { start: number; end: number };

// A single "Range: bytes=..." header (audio players seek with it). null = no usable range, send the whole file
// (also for several ranges or a malformed header, as HTTP allows); 'unsatisfiable' = the range is outside the file.
export function parseRange(header: string | undefined, size: number): ByteRange | 'unsatisfiable' | null {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (match[1] === '') {
    // "bytes=-500": the last 500 bytes
    const length = Number(match[2]);
    if (length === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size || end < start) return 'unsatisfiable';
  return { start, end };
}

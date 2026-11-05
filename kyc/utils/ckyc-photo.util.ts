// CKYC photos arrive as base64 plus an extension ("jpg", "png", …). Returns an <img> src, or null when there is no photo.
// Shared by the match card and the validated card so both read the same data the same way.
export function toCkycPhotoSrc(photo?: string | null, photoExt?: string | null): string | null {
  const data = photo?.trim();
  if (!data) return null;
  if (data.startsWith('data:image/')) return data; // already a data URL
  const ext = photoExt?.trim().toLowerCase().replace(/^\./, '') || 'jpeg'; // no extension: CKYC photos are JPEG
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data}`;
}

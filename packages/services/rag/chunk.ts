const DEFAULT_MAX_CHARS = 600;
const DEFAULT_OVERLAP = 80;

/** Split text into overlapping chunks for embedding / indexing. */
export function chunkText(
  text: string,
  opts?: { maxChars?: number; overlap?: number },
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = opts?.overlap ?? DEFAULT_OVERLAP;

  if (trimmed.length <= maxChars) return [trimmed];

  const paragraphs = trimmed.split(/\n{2,}/).flatMap((p) => {
    const part = p.trim();
    if (!part) return [];
    if (part.length <= maxChars) return [part];
    return splitBySize(part, maxChars, overlap);
  });

  if (paragraphs.length === 0) return splitBySize(trimmed, maxChars, overlap);
  return paragraphs;
}

function splitBySize(text: string, maxChars: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const slice = text.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

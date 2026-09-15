import { env } from "./env";

/** Values persisted before we switched to storage keys (direct bucket URLs). */
export function isStorageKey(value: string): boolean {
  return value.startsWith("chat/") || value.startsWith("approvals/");
}

function decodePath(pathname: string): string {
  return decodeURIComponent(pathname.replace(/^\//, ""));
}

function keyFromPathParts(parts: string[]): string | null {
  const bucket = env.AWS_S3_BUCKET ?? env.R2_BUCKET;
  let index = 0;

  while (index < parts.length && bucket && parts[index] === bucket) {
    index += 1;
  }

  const candidate = parts.slice(index).join("/");
  if (candidate.startsWith("chat/") || candidate.startsWith("approvals/")) {
    return decodeURIComponent(candidate);
  }

  return null;
}

/**
 * Resolve the object key from a stored attachment reference.
 * Accepts raw keys (chat/…, approvals/…) or legacy public/private bucket URLs.
 */
export function parseStorageKeyFromReference(reference: string): string | null {
  const trimmed = reference.trim();
  if (!trimmed) return null;

  if (isStorageKey(trimmed)) return trimmed;

  if (trimmed.startsWith("s3://")) {
    const withoutScheme = trimmed.slice(5);
    const slash = withoutScheme.indexOf("/");
    return slash >= 0 ? withoutScheme.slice(slash + 1) : null;
  }

  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const publicBase = env.AWS_S3_PUBLIC_BASE_URL ?? env.R2_PUBLIC_BASE_URL;
    if (publicBase && trimmed.startsWith(publicBase.replace(/\/$/, ""))) {
      const key = trimmed.slice(publicBase.replace(/\/$/, "").length + 1);
      return key.startsWith("chat/") || key.startsWith("approvals/") ? key : null;
    }

    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const fromParts = keyFromPathParts(pathParts);
    if (fromParts) return fromParts;

    const chatIndex = parsed.pathname.indexOf("/chat/");
    if (chatIndex >= 0) {
      return decodePath(parsed.pathname.slice(chatIndex + 1));
    }

    const approvalIndex = parsed.pathname.indexOf("/approvals/");
    if (approvalIndex >= 0) {
      return decodePath(parsed.pathname.slice(approvalIndex + 1));
    }

    return null;
  } catch {
    return null;
  }
}

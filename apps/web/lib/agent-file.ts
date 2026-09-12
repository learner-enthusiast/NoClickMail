const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const MAX_FILES_PER_MESSAGE = 10;

/** Base64 inflates bytes by ~33%, and the API accepts a 15MB JSON body. */
export const MAX_TOTAL_FILE_BYTES = 10 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "doc",
  "docx",
  "xlsx",
  "xls",
  "csv",
]);

export type AttachedAgentFile = {
  filename: string;
  mimeType?: string;
  data: string;
  size: number;
};

function extensionFromFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ?? null;
}

export function isSupportedAgentFile(filename: string): boolean {
  const ext = extensionFromFilename(filename);
  return ext ? ACCEPTED_EXTENSIONS.has(ext) : false;
}

export function readFileAsBase64(file: File): Promise<AttachedAgentFile> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_BYTES) {
      reject(new Error(`File too large (max ${MAX_FILE_BYTES / (1024 * 1024)}MB).`));
      return;
    }

    if (!isSupportedAgentFile(file.name)) {
      reject(
        new Error("Unsupported file type. Use pdf, png, jpg, doc, docx, xlsx, xls, or csv."),
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file."));
        return;
      }

      const base64 = result.includes(",") ? (result.split(",")[1] ?? "") : result;
      if (!base64) {
        reject(new Error("Failed to encode file."));
        return;
      }

      resolve({
        filename: file.name,
        mimeType: file.type || undefined,
        data: base64,
        size: file.size,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export const AGENT_FILE_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx,.xls,.csv,application/pdf,image/png,image/jpeg";

/**
 * Read a batch of picked files, rejecting the whole batch if it would exceed the
 * per-message count or the combined byte budget of files already attached.
 */
export async function readFilesAsBase64(
  files: File[],
  alreadyAttached: AttachedAgentFile[] = [],
): Promise<AttachedAgentFile[]> {
  if (files.length === 0) return [];

  if (alreadyAttached.length + files.length > MAX_FILES_PER_MESSAGE) {
    throw new Error(`You can attach up to ${MAX_FILES_PER_MESSAGE} files per message.`);
  }

  const attachedBytes = alreadyAttached.reduce((sum, f) => sum + f.size, 0);
  const incomingBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (attachedBytes + incomingBytes > MAX_TOTAL_FILE_BYTES) {
    throw new Error(
      `Attachments are too large together (max ${MAX_TOTAL_FILE_BYTES / (1024 * 1024)}MB total).`,
    );
  }

  return Promise.all(files.map((file) => readFileAsBase64(file)));
}

export function formatAttachedFilenames(filenames: string[]): string {
  return filenames.map((filename) => `📎 ${filename}`).join("\n");
}

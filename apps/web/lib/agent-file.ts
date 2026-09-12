const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const MAX_FILES_PER_MESSAGE = 10;

/** Combined budget for one message; base64 inflates it ~33% against the API body limit. */
export const MAX_TOTAL_FILE_BYTES = 20 * 1024 * 1024;

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

export type ReadFilesResult = {
  attached: AttachedAgentFile[];
  errors: string[];
};

function megabytes(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Read a batch of picked files, keeping every file that succeeds and reporting the
 * rest by name. A single unsupported or oversized file never discards the selection.
 */
export async function readFilesAsBase64(
  files: File[],
  alreadyAttached: AttachedAgentFile[] = [],
): Promise<ReadFilesResult> {
  const attached: AttachedAgentFile[] = [];
  const errors: string[] = [];

  if (files.length === 0) return { attached, errors };

  const remainingSlots = MAX_FILES_PER_MESSAGE - alreadyAttached.length;
  if (remainingSlots <= 0) {
    errors.push(`You can attach up to ${MAX_FILES_PER_MESSAGE} files per message.`);
    return { attached, errors };
  }

  const accepted = files.slice(0, remainingSlots);
  if (files.length > remainingSlots) {
    errors.push(
      `Only ${remainingSlots} more file(s) fit — skipped ${files.length - remainingSlots}.`,
    );
  }

  let usedBytes = alreadyAttached.reduce((sum, file) => sum + file.size, 0);

  for (const file of accepted) {
    if (usedBytes + file.size > MAX_TOTAL_FILE_BYTES) {
      errors.push(
        `${file.name} skipped — attachments cannot exceed ${megabytes(MAX_TOTAL_FILE_BYTES)}MB in total.`,
      );
      continue;
    }

    try {
      attached.push(await readFileAsBase64(file));
      usedBytes += file.size;
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : "could not be read."}`);
    }
  }

  return { attached, errors };
}

export function formatAttachedFilenames(filenames: string[]): string {
  return filenames.map((filename) => `📎 ${filename}`).join("\n");
}

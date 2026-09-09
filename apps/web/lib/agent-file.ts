const MAX_FILE_BYTES = 10 * 1024 * 1024;

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

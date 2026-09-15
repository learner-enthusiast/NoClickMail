import FileSaveService from "@repo/filesavemodule";

const fileSaveService = new FileSaveService();

function attachmentFilenamesFromContent(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => line.startsWith("📎 "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

/** Presign private object-storage refs before returning chat messages to the client. */
export async function presignMessageAttachmentUrls(
  content: string,
  references: string[] | null | undefined,
): Promise<string[] | null> {
  if (!references?.length) return references ?? null;

  const filenames = attachmentFilenamesFromContent(content);
  return fileSaveService.resolveAttachmentDownloadUrls(references, filenames);
}

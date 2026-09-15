"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, X } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  isImageAttachment,
  isPdfAttachment,
  type ChatAttachmentPreview,
} from "~/lib/agent-file";
import { AttachmentPreviewOverlay } from "./AttachmentPreviewOverlay";
import { PdfAttachmentPreview } from "./PdfAttachmentPreview";

function OfficeAttachmentCard({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const isSpreadsheet = ext === "xlsx" || ext === "xls" || ext === "csv";

  return (
    <div className="flex h-32 w-40 flex-col items-center justify-center gap-2 bg-secondary/60 px-3 text-center">
      <div className="flex size-10 items-center justify-center rounded-md bg-background/80 text-muted-foreground">
        {isSpreadsheet ? <FileSpreadsheet className="size-5" /> : <FileText className="size-5" />}
      </div>
      <span className="line-clamp-2 text-[10px] leading-tight text-foreground">{filename}</span>
      <span className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
        {ext ?? "file"}
      </span>
    </div>
  );
}

function AttachmentFilenameLabel({ filename }: { filename: string }) {
  return (
    <span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-1.5 py-0.5 text-[10px] text-foreground">
      {filename}
    </span>
  );
}

export function ChatAttachmentPreviews({
  items,
  onRemove,
  className,
  imageClassName,
}: {
  items: ChatAttachmentPreview[];
  onRemove?: (index: number) => void;
  className?: string;
  imageClassName?: string;
}) {
  const [previewItem, setPreviewItem] = useState<ChatAttachmentPreview | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <ul className={cn("flex flex-wrap gap-2", className)}>
        {items.map((item, index) => {
          const showImage = isImageAttachment(item.filename, item.previewUrl);
          const showPdf = isPdfAttachment(item.filename, item.previewUrl);
          const canExpand = Boolean(item.previewUrl);

          return (
            <li
              key={`${item.filename}-${index}`}
              className={cn(
                "relative overflow-hidden rounded-lg border border-border/60 bg-background/40",
                canExpand && "transition-shadow hover:shadow-md",
              )}
            >
              <button
                type="button"
                disabled={!canExpand}
                aria-label={canExpand ? `Preview ${item.filename}` : item.filename}
                onClick={() => canExpand && setPreviewItem(item)}
                className={cn(
                  "block w-full text-left",
                  canExpand && "cursor-zoom-in",
                  !canExpand && "cursor-default",
                )}
              >
                {showImage && item.previewUrl ? (
                  <>
                    <img
                      src={item.previewUrl}
                      alt={item.filename}
                      className={cn("block max-h-32 max-w-40 object-cover", imageClassName)}
                    />
                    <AttachmentFilenameLabel filename={item.filename} />
                  </>
                ) : showPdf && item.previewUrl ? (
                  <>
                    <PdfAttachmentPreview url={item.previewUrl} filename={item.filename} />
                    <AttachmentFilenameLabel filename={item.filename} />
                  </>
                ) : (
                  <OfficeAttachmentCard filename={item.filename} />
                )}
              </button>

              {onRemove && (
                <button
                  type="button"
                  aria-label={`Remove ${item.filename}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(index);
                  }}
                  className="absolute top-1 right-1 z-10 rounded-full bg-background/90 p-0.5 text-muted-foreground shadow-sm hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <AttachmentPreviewOverlay item={previewItem} onClose={() => setPreviewItem(null)} />
    </>
  );
}

"use client";

import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import {
  isImageAttachment,
  isPdfAttachment,
  type ChatAttachmentPreview,
} from "~/lib/agent-file";

function LargeImagePreview({ url, filename }: { url: string; filename: string }) {
  return (
    <img
      src={url}
      alt={filename}
      className="mx-auto max-h-[78vh] w-auto max-w-full rounded-md object-contain"
    />
  );
}

function LargePdfPreview({ url, filename }: { url: string; filename: string }) {
  return (
    <iframe
      src={`${url}#toolbar=1&navpanes=0&view=FitH`}
      title={filename}
      className="h-[78vh] w-full rounded-md border border-border bg-zinc-100 dark:bg-zinc-900"
    />
  );
}

function LargeFilePreview({ item }: { item: ChatAttachmentPreview }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        Preview is not available for this file type in the browser.
      </p>
      {item.previewUrl && (
        <Button asChild variant="outline">
          <a href={item.previewUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Open {item.filename}
          </a>
        </Button>
      )}
    </div>
  );
}

export function AttachmentPreviewOverlay({
  item,
  onClose,
}: {
  item: ChatAttachmentPreview | null;
  onClose: () => void;
}) {
  const open = item !== null;
  const url = item?.previewUrl;
  const filename = item?.filename ?? "Attachment";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,56rem)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:p-5">
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle className="truncate text-base">{filename}</DialogTitle>
            {url?.startsWith("http") && (
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  Open
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {!url ? (
            <LargeFilePreview item={item ?? { filename }} />
          ) : isImageAttachment(filename, url) ? (
            <LargeImagePreview url={url} filename={filename} />
          ) : isPdfAttachment(filename, url) ? (
            <LargePdfPreview url={url} filename={filename} />
          ) : (
            <LargeFilePreview item={item!} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

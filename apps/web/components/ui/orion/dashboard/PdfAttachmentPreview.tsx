"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

type PdfAttachmentPreviewProps = {
  url: string;
  filename: string;
  className?: string;
};

function PdfFallback({ filename, className }: { filename: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-32 w-40 flex-col items-center justify-center gap-2 bg-red-500/10 px-3 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-md bg-red-500/15 text-red-600 dark:text-red-400">
        <FileText className="size-5" />
      </div>
      <span className="line-clamp-2 text-[10px] leading-tight text-foreground">{filename}</span>
      <span className="text-[9px] font-semibold tracking-wide text-red-600 uppercase dark:text-red-400">
        PDF
      </span>
    </div>
  );
}

/** Render the first PDF page to a canvas — used for local data URLs before upload. */
function PdfCanvasThumbnail({ url, filename, className }: PdfAttachmentPreviewProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderFirstPage() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.55 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas unavailable");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;

        if (!cancelled) {
          setThumbUrl(canvas.toDataURL("image/png"));
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void renderFirstPage();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (thumbUrl) {
    return (
      <img
        src={thumbUrl}
        alt={filename}
        className={cn("block h-32 w-40 object-cover object-top", className)}
      />
    );
  }

  if (failed) {
    return <PdfFallback filename={filename} className={className} />;
  }

  return (
    <div
      className={cn(
        "flex h-32 w-40 items-center justify-center bg-red-500/5 text-xs text-muted-foreground",
        className,
      )}
    >
      Loading PDF…
    </div>
  );
}

/** Embedded viewer for uploaded PDF URLs (S3/R2). */
function PdfEmbedPreview({ url, filename, className }: PdfAttachmentPreviewProps) {
  return (
    <div className={cn("relative h-32 w-40 overflow-hidden bg-zinc-100 dark:bg-zinc-900", className)}>
      <iframe
        src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        title={filename}
        className="pointer-events-none h-full w-full scale-[1.02] border-0"
      />
    </div>
  );
}

export function PdfAttachmentPreview({ url, filename, className }: PdfAttachmentPreviewProps) {
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return <PdfCanvasThumbnail url={url} filename={filename} className={className} />;
  }

  return <PdfEmbedPreview url={url} filename={filename} className={className} />;
}

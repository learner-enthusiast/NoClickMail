"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "~/lib/utils";

const CSV_LINE = /^[^,\n]+(?:,[^,\n]+)+$/;

function maybeConvertCsvBlocks(content: string): string {
  const blocks = content.split(/\n{2,}/);
  const converted = blocks.map((block) => {
    const lines = block
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return block;
    if (!lines.every((line) => CSV_LINE.test(line))) return block;

    const rows = lines.map((line) => line.split(",").map((cell) => cell.trim()));
    const [header, ...body] = rows;
    if (!header?.length) return block;

    return [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`),
    ].join("\n");
  });

  return converted.join("\n\n");
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-md bg-background/60 px-3 py-2 font-mono text-xs">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-md bg-background/60 p-3 last:mb-0">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full min-w-[240px] border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border/60">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/40">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1.5 font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5 align-top text-foreground">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
};

type ChatMarkdownProps = {
  content: string;
  className?: string;
  invert?: boolean;
};

export function ChatMarkdown({ content, className, invert }: ChatMarkdownProps) {
  const prepared = maybeConvertCsvBlocks(content);

  return (
    <div
      className={cn(
        "text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        invert && "[&_code]:bg-primary-foreground/15 [&_pre]:bg-primary-foreground/10",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {prepared}
      </ReactMarkdown>
    </div>
  );
}

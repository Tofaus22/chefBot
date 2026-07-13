"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MARKDOWN_CLASSES = "prose prose-sm max-w-none dark:prose-invert prose-headings:text-amber-700 dark:prose-headings:text-amber-400 prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2 prose-h2:text-base prose-h3:text-base prose-strong:text-foreground prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-blockquote:border-amber-500 prose-blockquote:bg-amber-100/60 dark:prose-blockquote:bg-amber-950/30 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:text-amber-800 dark:prose-blockquote:text-amber-200 prose-hr:border-border prose-hr:my-3 prose-p:my-1";

const remarkPlugins = [remarkGfm];

interface MarkdownBodyProps {
  content: string;
}

function MarkdownBodyInner({ content }: MarkdownBodyProps) {
  return (
    <div className={MARKDOWN_CLASSES}>
      <ReactMarkdown remarkPlugins={remarkPlugins}>{content}</ReactMarkdown>
    </div>
  );
}

export const MarkdownBody = memo(MarkdownBodyInner);

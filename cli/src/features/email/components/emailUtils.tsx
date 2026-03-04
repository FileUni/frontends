import React from "react";
import DOMPurify from "dompurify";
export { createClientUniqueId } from "@/lib/id.ts";

export const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};

export const formatDate = (dateValue: string): string => {
  try {
    return new Date(dateValue).toLocaleDateString();
  } catch {
    return dateValue;
  }
};

export const formatSize = (bytesValue: number): string => {
  if (bytesValue < 1024) return `${bytesValue} B`;
  if (bytesValue < 1024 * 1024) return `${(bytesValue / 1024).toFixed(1)} KB`;
  return `${(bytesValue / (1024 * 1024)).toFixed(1)} MB`;
};

export const resolveAttachmentFileName = (
  contentDisposition: string | null,
  fallbackName: string,
): string => {
  if (!contentDisposition) {
    return fallbackName;
  }

  const utf8Name = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Name && utf8Name[1]) {
    return decodeURIComponent(utf8Name[1]);
  }

  const asciiName = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  if (asciiName && asciiName[1]) {
    return asciiName[1];
  }

  return fallbackName;
};

interface SafeHtmlRendererProps {
  html?: string;
  text?: string;
  emptyText: string;
}

export const SafeHtmlRenderer: React.FC<SafeHtmlRendererProps> = ({ html, text, emptyText }) => {
  if (!html) {
    return (
      <div className="text-sm leading-relaxed font-medium whitespace-pre-wrap">
        {text || emptyText}
      </div>
    );
  }

  const sanitizedHtml = DOMPurify.sanitize(html);
  return (
    <div
      className="w-full rounded-2xl border border-border/30 bg-background/70 shadow-inner p-4 text-sm leading-relaxed break-words [&_img]:max-w-full [&_table]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_a]:text-primary"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

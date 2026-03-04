import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { client } from "@/lib/api.ts";
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/Button.tsx";
import { FilePreviewHeader } from "./FilePreviewHeader.tsx";

// Static import PDF style files
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

type PdfViewComponentProps = Record<string, unknown>;
type PdfjsLike = {
  version?: string;
  GlobalWorkerOptions: {
    workerSrc: string;
  };
};

// Only import react-pdf in browser environment
let Document: React.ComponentType<PdfViewComponentProps> = () => null;
let Page: React.ComponentType<PdfViewComponentProps> = () => null;
let pdfjs: PdfjsLike | null = null;

if (typeof window !== "undefined") {
  const reactPdf = await import("react-pdf");
  Document = reactPdf.Document as React.ComponentType<PdfViewComponentProps>;
  Page = reactPdf.Page as React.ComponentType<PdfViewComponentProps>;
  pdfjs = reactPdf.pdfjs as PdfjsLike;

  // Prefer same-build local worker; fallback to CDN to avoid API/Worker version mismatch
  const runtimePdfVersion =
    typeof pdfjs?.version === "string" && pdfjs.version.length > 0
      ? pdfjs.version
      : "5.4.296";
  try {
    if (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
      ).toString();
    }
  } catch {
    if (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${runtimePdfVersion}/pdf.worker.min.mjs`;
    }
  }
}

interface Props {
  path: string;
  isDark?: boolean;
  headerExtra?: React.ReactNode;
  onClose?: () => void;
}

export const PdfPreview = ({ path, isDark, headerExtra, onClose }: Props) => {
  const { t } = useTranslation();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const updateWidth = () => {
      if (containerRef.current)
        setContainerWidth(containerRef.current.clientWidth);
    };
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    updateWidth();
    return () => observer.disconnect();
  }, []);

  const executeLoad = async (authToken: string) => {
    setProcessing(true);
    try {
      const { BASE_URL } = await import("@/lib/api.ts");
      const url = `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(authToken)}&inline=true`;
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } else {
        setError(`Fetch failed: ${response.status}`);
      }
    } catch (e) {
      setError("Failed to fetch PDF data");
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data: tokenRes } = await client.GET(
          "/api/v1/file/get-file-download-token",
          { params: { query: { path } } },
        );
        if (tokenRes?.data?.token) {
          const authToken = tokenRes.data.token;
          // Parent (FilePreviewPage) already checked size, so we proceed directly
          await executeLoad(authToken);
        }
      } catch (e) {
        setError("Metadata fetch failed");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [path]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // Memoize file object to solve DataCloneError and unnecessary reloads
  const documentFile = useMemo(() => ({ url: pdfUrl || "" }), [pdfUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  if (loading)
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  if (error)
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 text-red-500">
        <AlertCircle size={48} />
        <p className="font-bold">{error}</p>
      </div>
    );

  return (
    <div className="h-full flex flex-col">
      <FilePreviewHeader
        path={path}
        isDark={isDark}
        subtitle={t('filemanager.player.pdfEngine')}
        onClose={onClose}
        extra={
          <div className="flex items-center gap-2">
            {headerExtra}
            {pdfUrl && (
              <div className="flex items-center bg-accent/20 p-1 rounded-xl mx-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="px-3 text-sm font-black font-mono">
                  {pageNumber} / {numPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() =>
                    setPageNumber((p) => Math.min(numPages, p + 1))
                  }
                  disabled={pageNumber >= numPages}
                >
                  <ChevronRight size={16} />
                </Button>
                <div className="w-px h-4 bg-border mx-2" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                >
                  <ZoomOut size={16} />
                </Button>
                <span className="px-2 text-sm font-mono opacity-50">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                >
                  <ZoomIn size={16} />
                </Button>
              </div>
            )}
          </div>
        }
      />

      <main
        className="flex-1 bg-zinc-900 overflow-auto flex justify-center p-4 sm:p-8 custom-scrollbar"
        ref={containerRef}
      >
        {pdfUrl ? (
          <div className="shadow-2xl h-fit">
            <Document
              file={documentFile}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex flex-col items-center p-20 gap-4">
                  <Loader2 className="animate-spin text-primary" size={40} />
                  <p className="text-sm font-black uppercase tracking-widest opacity-30">
                    Rendering...
                  </p>
                </div>
              }
              error={
                <div className="p-20 text-red-500 font-bold">
                  Failed to render PDF.
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                width={
                  containerWidth
                    ? Math.min(containerWidth - 64, 1200)
                    : undefined
                }
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-white/50 gap-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-primary" size={40} />
              <p className="text-sm font-black uppercase tracking-widest opacity-30">
                {processing ? "Loading Stream..." : "Initializing..."}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

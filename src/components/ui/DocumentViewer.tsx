import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from "lucide-react";
import { Button } from "./Button";

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  url: string;
  type: "pdf" | "markdown" | "text";
  onClose: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  url,
  type,
  onClose,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [content, setContent] = useState<string>("");

  React.useEffect(() => {
    const loadContent = async () => {
      if (type === "markdown" || type === "text") {
        try {
          const result = await window.fs.readFile(url);
          if (result.success && result.content) {
            setContent(result.content);
          } else {
            console.error("Failed to read file:", result.error);
            setContent("Error loading file content.");
          }
        } catch (error) {
          console.error("Error reading file:", error);
          setContent("Error loading file content.");
        }
      }
    };
    loadContent();
  }, [url, type]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="font-medium text-gray-700 truncate max-w-[200px]">
          {url.split("/").pop()}
        </div>
        <div className="flex items-center gap-2">
          {type === "pdf" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                icon={<ZoomOut className="w-4 h-4" />}
              />
              <span className="text-xs text-gray-500 w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale((s) => Math.min(2.0, s + 0.1))}
                icon={<ZoomIn className="w-4 h-4" />}
              />
              <div className="h-4 w-px bg-gray-300 mx-2" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                icon={<ChevronLeft className="w-4 h-4" />}
              />
              <span className="text-xs text-gray-500">
                {pageNumber} / {numPages || "--"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPageNumber((p) => Math.min(numPages || 1, p + 1))
                }
                disabled={pageNumber >= (numPages || 1)}
                icon={<ChevronRight className="w-4 h-4" />}
              />
            </>
          )}
          <div className="h-4 w-px bg-gray-300 mx-2" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            icon={<X className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 bg-gray-100">
        {type === "pdf" ? (
          <div className="flex justify-center">
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              className="shadow-lg"
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="bg-white"
              />
            </Document>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-white p-8 shadow-sm min-h-full prose prose-emerald">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

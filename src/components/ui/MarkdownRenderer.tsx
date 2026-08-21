import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Check, Copy } from "lucide-react";
import "katex/dist/katex.min.css";
import "./markdown.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const CodeBlock: React.FC<{ language?: string; value: string; className?: string }> = ({
  language,
  value,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="code-block-wrapper my-3.5 rounded-2xl overflow-hidden neu-inset border border-border shadow-md">
      <div className="code-block-header px-4 py-2 bg-secondary/80 border-b border-border flex items-center justify-between">
        <span className="code-language text-[11px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg neu-raised-sm active:scale-95 transition-all cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span className="text-[11px] text-emerald-500 dark:text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block p-4 overflow-x-auto text-xs font-mono leading-relaxed text-foreground/90 custom-scrollbar">
        <code className={className}>{value}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({
  content,
  className = "",
}) => {
  return (
    <div className={`markdown-content ${className || ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-4 rounded-xl">
              <table className="markdown-table m-0 w-full" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="markdown-th px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider"
              {...props}
            />
          ),
          td: ({ ...props }) => (
            <td className="markdown-td px-4 py-2.5 text-sm" {...props} />
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const isInline = !className || !className.includes("language-");
            const codeString = String(children).replace(/\n$/, "");

            return isInline ? (
              <code
                className="inline-code px-2 py-0.5 rounded-md text-[12.5px] font-mono font-medium"
                {...props}
              >
                {children}
              </code>
            ) : (
              <CodeBlock language={language} value={codeString} className={className} />
            );
          },
          h1: ({ ...props }) => (
            <h1 className="text-xl font-bold text-foreground mt-4 mb-2 tracking-tight" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-lg font-bold text-foreground mt-3 mb-2 tracking-tight" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-base font-bold text-foreground mt-2 mb-1 tracking-tight" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="text-[14.5px] leading-relaxed mb-2.5 last:mb-0 text-foreground/90 font-normal" {...props} />
          ),
          ul: ({ ...props }) => <ul className="list-disc pl-5 my-2 space-y-1 text-sm text-foreground/90" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-sm text-foreground/90" {...props} />,
          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
          blockquote: ({ ...props }) => (
            <blockquote
              className="markdown-blockquote my-3 text-sm italic"
              {...props}
            />
          ),
          hr: ({ ...props }) => <hr className="markdown-hr my-4" {...props} />,
          a: ({ ...props }) => (
            <a
              className="text-primary font-semibold hover:underline inline-flex items-center gap-0.5"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;



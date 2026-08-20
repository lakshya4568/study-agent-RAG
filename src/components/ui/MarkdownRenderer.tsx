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
    <div className="code-block-wrapper my-3 rounded-2xl overflow-hidden border border-border/40 bg-zinc-950 shadow-xl">
      <div className="code-block-header px-4 py-2 bg-zinc-900/80 border-b border-border/30 flex items-center justify-between">
        <span className="code-language text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block p-4 overflow-x-auto text-xs font-mono leading-relaxed text-zinc-200">
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
            <div className="overflow-x-auto my-4 rounded-xl border border-border/40 shadow-sm">
              <table className="markdown-table m-0 w-full" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="bg-muted/60 text-foreground px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider border-b border-border/50"
              {...props}
            />
          ),
          td: ({ ...props }) => (
            <td className="px-4 py-2.5 text-sm border-b border-border/30" {...props} />
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const isInline = !className || !className.includes("language-");
            const codeString = String(children).replace(/\n$/, "");

            return isInline ? (
              <code
                className="inline-code bg-muted/60 text-foreground px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-border/40"
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
            <h3 className="text-base font-semibold text-foreground mt-2 mb-1 tracking-tight" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="text-sm leading-relaxed mb-2.5 last:mb-0 text-foreground/90" {...props} />
          ),
          ul: ({ ...props }) => <ul className="list-disc pl-5 my-2 space-y-1 text-sm" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-sm" {...props} />,
          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-2 border-primary/50 bg-primary/5 pl-4 py-1.5 my-3 rounded-r-xl text-sm italic text-muted-foreground"
              {...props}
            />
          ),
          hr: ({ ...props }) => <hr className="border-border/40 my-4" {...props} />,
          a: ({ ...props }) => (
            <a
              className="text-primary font-medium hover:underline inline-flex items-center gap-0.5"
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


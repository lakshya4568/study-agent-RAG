import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import "./markdown.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Beautiful Markdown Renderer Component
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - LaTeX math equations support (inline and display)
 * - Enhanced line breaks
 * - Syntax highlighted code blocks
 * - Custom styled tables with hover effects
 * - Professional typography with Inter and Work Sans fonts
 * - Native emoji support (renders Unicode emojis naturally)
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
}) => {
  return (
    <div className={`markdown-content ${className || ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          // Tables with beautiful styling
          table: ({ ...props }) => (
            <table className="markdown-table" {...props} />
          ),

          // Table headers with gradient background
          th: ({ ...props }) => <th className="markdown-th" {...props} />,

          // Table cells with hover effects
          td: ({ ...props }) => <td className="markdown-td" {...props} />,

          // Code blocks with syntax highlighting
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";

            // Check if this is inline code (no language class)
            const isInline = !className || !className.includes("language-");

            return isInline ? (
              <code className="inline-code" {...props}>
                {children}
              </code>
            ) : (
              <div className="code-block-wrapper">
                {language && (
                  <div className="code-block-header">
                    <span className="code-language">{language}</span>
                  </div>
                )}
                <pre className="code-block">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },

          // Headers with enhanced styling
          h1: ({ ...props }) => <h1 className="markdown-h1" {...props} />,
          h2: ({ ...props }) => <h2 className="markdown-h2" {...props} />,
          h3: ({ ...props }) => <h3 className="markdown-h3" {...props} />,
          h4: ({ ...props }) => <h4 className="markdown-h4" {...props} />,

          // Links with hover effects
          a: ({ ...props }) => (
            <a
              className="markdown-link"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),

          // Blockquotes with left border accent
          blockquote: ({ ...props }) => (
            <blockquote className="markdown-blockquote" {...props} />
          ),

          // Lists with proper spacing
          ul: ({ ...props }) => <ul className="markdown-ul" {...props} />,
          ol: ({ ...props }) => <ol className="markdown-ol" {...props} />,

          // Horizontal rules with gradient
          hr: ({ ...props }) => <hr className="markdown-hr" {...props} />,

          // Images with responsive sizing
          img: ({ ...props }) => <img className="markdown-img" {...props} />,

          // Task lists (GitHub style checkboxes)
          input: ({ ...props }) => (
            <input className="markdown-checkbox" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

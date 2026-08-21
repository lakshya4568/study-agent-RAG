import React, { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Check, Copy, Code2, Table as TableIcon } from "lucide-react";
import "katex/dist/katex.min.css";
import "./markdown.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Token categories for high-contrast, polished code syntax highlighting
const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "switch", "case", "break", "continue", "default", "try", "catch", "finally",
  "throw", "new", "class", "extends", "import", "export", "from", "as",
  "async", "await", "yield", "typeof", "instanceof", "void", "this", "super",
  "interface", "type", "enum", "namespace", "public", "private", "protected",
  "readonly", "static", "override", "def", "elif", "pass", "lambda", "with",
  "global", "nonlocal", "assert", "is", "in", "not", "and", "or", "fn", "pub",
  "struct", "impl", "trait", "mut", "match", "select", "insert", "update",
  "delete", "where", "join", "group", "by", "order", "limit", "having",
  "create", "table", "alter", "drop", "self", "None", "True", "False", "nil"
]);

const BOOLEANS_NULLS = new Set([
  "true", "false", "null", "undefined", "NaN", "Infinity"
]);

const BUILTIN_TYPES = new Set([
  "string", "number", "boolean", "any", "unknown", "never", "void",
  "Promise", "Array", "Map", "Set", "Record", "List", "Dict", "Tuple",
  "React", "FC", "Props", "JSX", "Element", "HTMLDivElement", "MouseEvent",
  "KeyboardEvent", "Error", "Date", "RegExp", "Buffer", "Object", "Function"
]);

function tokenizeLine(line: string): React.ReactNode[] {
  if (!line) return [<span key="empty">&nbsp;</span>];

  // Regex pattern matching comments, strings, identifiers, numbers, operators, punctuation
  const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|[a-zA-Z_$][a-zA-Z0-9_$]*|[=><!~?:&|+\-*/%^]+|[{}()\[\];,.]|\s+|[^\s\w]+)/g;

  const nodes: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    const token = match[0];
    keyIdx++;

    // Comments
    if (
      token.startsWith("//") ||
      token.startsWith("/*") ||
      token.startsWith("#") ||
      token.startsWith("--")
    ) {
      nodes.push(
        <span key={keyIdx} className="token-comment italic text-zinc-400 dark:text-zinc-500">
          {token}
        </span>
      );
      continue;
    }

    // Strings
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith("`") && token.endsWith("`"))
    ) {
      nodes.push(
        <span key={keyIdx} className="token-string text-emerald-700 dark:text-emerald-400">
          {token}
        </span>
      );
      continue;
    }

    // Numbers
    if (/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/.test(token)) {
      nodes.push(
        <span key={keyIdx} className="token-number text-amber-700 dark:text-amber-400 font-medium">
          {token}
        </span>
      );
      continue;
    }

    // Keywords
    if (KEYWORDS.has(token)) {
      nodes.push(
        <span key={keyIdx} className="token-keyword text-rose-700 dark:text-rose-400 font-semibold">
          {token}
        </span>
      );
      continue;
    }

    // Booleans & Nulls
    if (BOOLEANS_NULLS.has(token)) {
      nodes.push(
        <span key={keyIdx} className="token-boolean text-amber-800 dark:text-amber-300 font-semibold">
          {token}
        </span>
      );
      continue;
    }

    // Built-in Types
    if (BUILTIN_TYPES.has(token)) {
      nodes.push(
        <span key={keyIdx} className="token-type text-sky-700 dark:text-sky-400 font-medium">
          {token}
        </span>
      );
      continue;
    }

    // PascalCase (Custom Types / Classes)
    if (/^[A-Z][a-zA-Z0-9_]*$/.test(token)) {
      nodes.push(
        <span key={keyIdx} className="token-type text-sky-700 dark:text-sky-300 font-medium">
          {token}
        </span>
      );
      continue;
    }

    // Operators
    if (/^[=><!~?:&|+\-*/%^]+$/.test(token)) {
      nodes.push(
        <span key={keyIdx} className="token-operator text-teal-700 dark:text-teal-400">
          {token}
        </span>
      );
      continue;
    }

    // Punctuation
    if (/^[{}()\[\];,.]+$/.test(token)) {
      nodes.push(
        <span key={keyIdx} className="token-punctuation text-zinc-600 dark:text-zinc-400">
          {token}
        </span>
      );
      continue;
    }

    // Default variable / text
    nodes.push(
      <span key={keyIdx} className="token-text text-zinc-800 dark:text-zinc-200">
        {token}
      </span>
    );
  }

  return nodes;
}

const CodeBlock: React.FC<{ language?: string; value: string }> = ({
  language,
  value,
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

  const lines = useMemo(() => value.split("\n"), [value]);
  const displayLang = (language || "code").toUpperCase();

  return (
    <div className="code-block-wrapper my-4 rounded-2xl overflow-hidden neu-inset border border-border shadow-md bg-card/90 dark:bg-[#111114]">
      {/* Code Header Bar */}
      <div className="code-block-header px-4 py-2.5 bg-secondary/80 dark:bg-[#18181c] border-b border-border flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-primary" />
          <span className="code-language text-[11px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            {displayLang}
          </span>
          <span className="text-[10px] text-muted-foreground/70 font-mono">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg neu-raised-sm active:scale-95 transition-all cursor-pointer border border-border"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body with Line Numbers & Syntax Highlighting */}
      <div className="p-4 overflow-x-auto custom-scrollbar font-mono text-[13px] leading-relaxed bg-card/60 dark:bg-[#111114]">
        <table className="border-collapse w-full m-0 p-0">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/2 transition-colors leading-relaxed">
                {lines.length > 1 && (
                  <td className="select-none pr-4 text-right text-zinc-400 dark:text-zinc-600 text-xs font-mono w-[1%] whitespace-nowrap align-top border-none p-0">
                    {idx + 1}
                  </td>
                )}
                <td className="whitespace-pre font-mono align-top text-zinc-800 dark:text-zinc-200 border-none p-0">
                  {tokenizeLine(line)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
            <div className="overflow-x-auto my-4 rounded-xl border border-border shadow-md bg-card/90 dark:bg-[#121215] custom-scrollbar">
              <table className="markdown-table m-0 w-full border-collapse" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="markdown-th px-4 py-3 text-left text-xs font-bold text-foreground tracking-wider uppercase bg-secondary/80 dark:bg-[#18181c] border-b border-border font-sans"
              {...props}
            />
          ),
          td: ({ ...props }) => (
            <td
              className="markdown-td px-4 py-2.5 text-[14px] text-foreground/90 border-b border-border/50 font-normal leading-relaxed"
              {...props}
            />
          ),
          tr: ({ ...props }) => (
            <tr
              className="odd:bg-card even:bg-secondary/40 dark:odd:bg-[#121215] dark:even:bg-[#16161a] hover:bg-secondary/70 dark:hover:bg-[#1c1c22] transition-colors"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const isInline = !className || !className.includes("language-");
            const codeString = String(children).replace(/\n$/, "");

            return isInline ? (
              <code
                className="inline-code px-1.5 py-0.5 rounded-md text-[13px] font-mono font-medium bg-secondary/80 dark:bg-[#16161a] text-emerald-700 dark:text-emerald-400 border border-border"
                {...props}
              >
                {children}
              </code>
            ) : (
              <CodeBlock language={language} value={codeString} />
            );
          },
          h1: ({ ...props }) => (
            <h1 className="text-xl md:text-2xl font-bold text-foreground mt-5 mb-2.5 tracking-tight font-sans" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-lg md:text-xl font-bold text-foreground mt-4 mb-2 tracking-tight font-sans border-b border-border/40 pb-1" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-base md:text-lg font-bold text-foreground mt-3 mb-1.5 tracking-tight font-sans" {...props} />
          ),
          h4: ({ ...props }) => (
            <h4 className="text-sm md:text-base font-bold text-foreground mt-2.5 mb-1 tracking-tight font-sans" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="text-[15px] leading-relaxed mb-3 last:mb-0 text-foreground/95 font-normal font-sans" {...props} />
          ),
          ul: ({ ...props }) => <ul className="list-disc pl-5 my-2.5 space-y-1 text-[14.5px] text-foreground/90 font-sans" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal pl-5 my-2.5 space-y-1 text-[14.5px] text-foreground/90 font-sans" {...props} />,
          li: ({ ...props }) => <li className="leading-relaxed pl-0.5" {...props} />,
          blockquote: ({ ...props }) => (
            <blockquote
              className="markdown-blockquote my-3.5 pl-4 pr-3 py-2.5 border-l-[3.5px] border-primary bg-card/80 rounded-r-xl border-y border-r border-border text-[14.5px] italic text-foreground/90 font-sans"
              {...props}
            />
          ),
          hr: ({ ...props }) => <hr className="markdown-hr my-4 border-none h-px bg-border" {...props} />,
          a: ({ ...props }) => (
            <a
              className="text-primary font-semibold hover:underline inline-flex items-center gap-0.5 transition-colors"
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



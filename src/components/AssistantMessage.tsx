import { memo, useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Block = { type: "text"; content: string } | { type: "code"; lang: string; content: string };

function parseMarkdown(input: string): Block[] {
  const blocks: Block[] = [];
  const re = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      const text = input.slice(last, m.index);
      if (text.trim()) blocks.push({ type: "text", content: text });
    }
    blocks.push({
      type: "code",
      lang: (m[1] || "lua").toLowerCase(),
      content: m[2].replace(/\n$/, ""),
    });
    last = re.lastIndex;
  }
  if (last < input.length) {
    const text = input.slice(last);
    if (text.trim()) blocks.push({ type: "text", content: text });
  }
  if (blocks.length === 0) blocks.push({ type: "text", content: input });
  return blocks;
}

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-border bg-background/70">
      <div className="flex items-center justify-between border-b border-border/60 bg-surface/40 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono text-foreground/90">{content}</code>
      </pre>
    </div>
  );
}

type InlinePart =
  | { type: "text"; content: string }
  | { type: "image"; alt: string; src: string };

function isSafeImageUrl(src: string) {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return (
      /\.(png|jpe?g|webp|gif)$/i.test(url.pathname) ||
      url.pathname.includes("/storage/v1/object/public/generated-images/")
    );
  } catch {
    return false;
  }
}

function parseInlineImages(content: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const re = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    if (match.index > last) parts.push({ type: "text", content: content.slice(last, match.index) });
    const alt = match[1]?.trim() || "Generated image";
    const src = match[2]?.trim();
    if (src && isSafeImageUrl(src)) {
      parts.push({ type: "image", alt, src });
    } else {
      parts.push({ type: "text", content: match[0] });
    }
    last = re.lastIndex;
  }

  if (last < content.length) parts.push({ type: "text", content: content.slice(last) });
  return parts.length ? parts : [{ type: "text", content }];
}

function ImagePreview({ alt, src }: { alt: string; src: string }) {
  return (
    <figure className="my-3 overflow-hidden rounded-xl border border-border/70 bg-background/55 shadow-[var(--shadow-card)]">
      <a href={src} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="max-h-[22rem] w-full bg-black/30 object-contain"
        />
      </a>
      <figcaption className="flex items-center justify-between gap-3 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate">{alt}</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground hover:bg-surface-elevated transition"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </a>
      </figcaption>
    </figure>
  );
}

function RichText({ content }: { content: string }) {
  // Very light markdown: **bold**, `inline code`, preserve newlines.
  const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-foreground"
            >
              {p.slice(1, -1)}
            </code>
          );
        }
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {p.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </div>
  );
}

function InlineText({ content }: { content: string }) {
  const parts = parseInlineImages(content);
  return (
    <div className="space-y-1">
      {parts.map((part, i) =>
        part.type === "image" ? (
          <ImagePreview key={`${part.src}-${i}`} alt={part.alt} src={part.src} />
        ) : part.content.trim() ? (
          <RichText key={i} content={part.content} />
        ) : null,
      )}
    </div>
  );
}

// Memoized so that re-renders of the parent chat component (which happen on
// every keystroke in the prompt box, every status-poll tick, and the running
// "elapsed" timer) do NOT re-parse and re-render every prior message. With the
// default shallow prop compare, a message whose `content` string is unchanged
// is skipped entirely — turning per-keystroke work from O(all messages) into
// O(only the message that actually changed). This was a real source of typing
// lag in long conversations.
export const AssistantMessage = memo(function AssistantMessage({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  return (
    <div className="space-y-1">
      {blocks.map((b, i) =>
        b.type === "code" ? (
          <CodeBlock key={i} lang={b.lang} content={b.content} />
        ) : (
          <InlineText key={i} content={b.content} />
        ),
      )}
    </div>
  );
});

import type { ReactNode } from "react"

// Light markdown for chat messages: paragraphs, # headings, - / 1. lists,
// > quotes, ``` code fences, --- rules, **bold**, *italic*, `code`,
// [links](https://…) and bare URLs. Builds React elements, never HTML
// strings, so message text can't inject markup.

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g

const HEADING = ["text-base font-semibold", "text-[0.95rem] font-semibold", "font-semibold"]

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null
    if (part.startsWith("**") || part.startsWith("__")) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith("`")) return <code key={i} className="bg-foreground/10 px-1 font-mono text-[0.85em]">{part.slice(1, -1)}</code>
    if (part.startsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>
    const link = part.match(/^\[([^\]]+)\]\((.+)\)$/)
    const href = link ? link[2] : part.startsWith("http") ? part : undefined
    if (href)
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {link ? link[1] : part}
        </a>
      )
    return part
  })
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | undefined
  let quote: string[] | undefined
  let code: string[] | undefined
  const flush = () => {
    if (list) {
      const Tag = list.ordered ? "ol" : "ul"
      blocks.push(
        <Tag key={blocks.length} className={list.ordered ? "list-decimal space-y-0.5 pl-5" : "list-disc space-y-0.5 pl-5"}>
          {list.items.map((it, i) => (
            <li key={i}>{inline(it)}</li>
          ))}
        </Tag>
      )
      list = undefined
    }
    if (quote) {
      blocks.push(
        <blockquote key={blocks.length} className="border-l-2 pl-3 text-muted-foreground">
          {quote.map((q, i) => (
            <p key={i}>{inline(q)}</p>
          ))}
        </blockquote>
      )
      quote = undefined
    }
  }
  for (const line of text.split("\n")) {
    if (code) {
      if (line.trim().startsWith("```")) {
        blocks.push(
          <pre key={blocks.length} className="overflow-x-auto bg-foreground/10 p-3 font-mono text-xs">
            {code.join("\n")}
          </pre>
        )
        code = undefined
      } else code.push(line)
      continue
    }
    if (line.trim().startsWith("```")) {
      flush()
      code = []
      continue
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/)
    if (heading) {
      flush()
      const cls = HEADING[Math.min(heading[1].length, 3) - 1]
      blocks.push(
        <p key={blocks.length} className={`${cls} pt-1`}>
          {inline(heading[2].replace(/\*\*/g, ""))}
        </p>
      )
      continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush()
      blocks.push(<hr key={blocks.length} className="border-border" />)
      continue
    }
    const q = line.match(/^\s*>\s?(.*)$/)
    if (q) {
      if (list) flush()
      quote ??= []
      quote.push(q[1])
      continue
    }
    const item = line.match(/^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/)
    if (item) {
      const ordered = !!item[2]
      if (quote || (list && list.ordered !== ordered)) flush()
      list ??= { ordered, items: [] }
      list.items.push(item[3])
      continue
    }
    flush()
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>)
  }
  if (code) blocks.push(<pre key={blocks.length} className="overflow-x-auto bg-foreground/10 p-3 font-mono text-xs">{code.join("\n")}</pre>)
  flush()
  return <div className="space-y-2 break-words">{blocks}</div>
}

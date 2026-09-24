import type { ReactNode } from "react"

// Light markdown for chat messages: paragraphs, - / 1. lists, **bold**,
// *italic*, `code`, [links](https://…) and bare URLs. Builds React elements,
// never HTML strings, so message text can't inject markup.

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>
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
  const flush = () => {
    if (!list) return
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
  for (const line of text.split("\n")) {
    const item = line.match(/^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/)
    if (item) {
      const ordered = !!item[2]
      if (list && list.ordered !== ordered) flush()
      list ??= { ordered, items: [] }
      list.items.push(item[3])
      continue
    }
    flush()
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>)
  }
  flush()
  return <div className="space-y-2">{blocks}</div>
}

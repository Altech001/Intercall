import { ArrowUp, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

/** The prompt box from the dashboard: sparkle, textarea, send, and a toolbar row. */
export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  busy,
  toolbar,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
  busy?: boolean
  toolbar?: React.ReactNode
  className?: string
}) {
  return (
    <form
      className={cn("border bg-background shadow-sm transition-shadow focus-within:shadow-md", className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim() && !busy) onSubmit()
      }}
    >
      <div className="flex items-start gap-3 p-3 pl-4">
        <Sparkles className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
        <textarea
          value={value}
          rows={2}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              if (value.trim() && !busy) onSubmit()
            }
          }}
          className="max-h-48 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!value.trim() || busy}
          className="grid size-9 shrink-0 place-items-center bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
      {toolbar && <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5">{toolbar}</div>}
    </form>
  )
}

export function ToolButton({ icon: Icon, children, ...props }: React.ComponentProps<"button"> & { icon: typeof Sparkles }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50",
        props.className
      )}
    >
      <Icon className="size-3.5" /> {children}
    </button>
  )
}

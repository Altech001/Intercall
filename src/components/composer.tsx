import { useEffect, useRef, useState } from "react"
import { ArrowUp, AudioLines, Mic, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useVoiceEnabled } from "@/lib/voice"

// Web Speech API isn't in the TS DOM lib yet; type just what we use.
type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
const SpeechRecognition = globalThis as unknown as {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}
const RecognitionCtor =
  SpeechRecognition.SpeechRecognition ??
  SpeechRecognition.webkitSpeechRecognition

/** Dictation into the composer. `base` is the text already typed when listening starts. */
function useVoice(value: string, onChange: (v: string) => void) {
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const base = useRef("")
  const change = useRef(onChange)
  useEffect(() => {
    change.current = onChange
  })
  useEffect(() => () => rec.current?.stop(), [])

  function toggle() {
    if (!RecognitionCtor) return
    if (rec.current) return rec.current.stop()
    const r = new RecognitionCtor()
    r.continuous = true
    r.interimResults = true
    r.lang = navigator.language || "en-US"
    base.current = value.trim() ? value.trimEnd() + " " : ""
    r.onresult = (e) => {
      const heard = Array.from(e.results, (res) => res[0].transcript).join("")
      change.current(base.current + heard)
    }
    r.onend = r.onerror = () => {
      rec.current = null
      setListening(false)
    }
    rec.current = r
    r.start()
    setListening(true)
  }

  return {
    supported: !!RecognitionCtor,
    listening,
    toggle,
    stop: () => rec.current?.stop(),
  }
}

/** The prompt box from the dashboard: sparkle, textarea, mic, send, and a toolbar row. */
export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  busy,
  toolbar,
  className,
  onVoice,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
  busy?: boolean
  toolbar?: React.ReactNode
  className?: string
  /** Opens speech-to-speech voice mode; without it the mic dictates into the box. */
  onVoice?: () => void
}) {
  const voice = useVoice(value, onChange)
  const voiceMode = useVoiceEnabled() && !!onVoice
  const submit = () => {
    if (!value.trim() || busy) return
    voice.stop()
    onSubmit()
  }

  return (
    <form
      className={cn(
        "border bg-background shadow-sm transition-shadow focus-within:shadow-md",
        className
      )}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="flex items-start gap-3 p-3 pl-4">
        <Sparkles className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
        <textarea
          value={value}
          rows={2}
          placeholder={voice.listening ? "Listening…" : placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          className="max-h-48 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        {voiceMode ? (
          <button
            type="button"
            onClick={onVoice}
            disabled={busy}
            aria-label="Talk with voice"
            title="Talk with voice"
            className="grid size-9 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <AudioLines className="size-4" />
          </button>
        ) : (
          voice.supported && (
            <button
              type="button"
              onClick={voice.toggle}
              aria-label={voice.listening ? "Stop voice input" : "Voice input"}
              aria-pressed={voice.listening}
              title={voice.listening ? "Stop voice input" : "Voice input"}
              className={cn(
                "grid size-9 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                voice.listening &&
                  "animate-pulse bg-destructive/15 text-destructive hover:bg-destructive/20 hover:text-destructive"
              )}
            >
              <Mic className="size-4" />
            </button>
          )
        )}
        <button
          type="submit"
          aria-label="Send"
          disabled={!value.trim() || busy}
          className="grid size-9 shrink-0 place-items-center bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5">
          {toolbar}
        </div>
      )}
    </form>
  )
}

export function ToolButton({
  icon: Icon,
  children,
  ...props
}: React.ComponentProps<"button"> & { icon: typeof Sparkles }) {
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

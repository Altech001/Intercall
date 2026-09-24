import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { Orb } from "@/components/brand"
import { VoiceSession } from "@/lib/voice"
import { cn } from "@/lib/utils"

type Phase = "listening" | "thinking" | "speaking" | "paused"

const LABEL: Record<Phase, string> = {
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking · tap to interrupt",
  paused: "Tap the globe to talk",
}

/**
 * Speech-to-speech over the chat: listen → transcribe → onAsk → speak → listen.
 * The turns land in the normal chat too, so closing it leaves the transcript.
 */
export function VoiceMode({
  onAsk,
  onClose,
  className,
}: {
  /** Sends what the user said as a chat message; resolves with the reply text to speak. */
  onAsk: (text: string) => Promise<string>
  onClose: () => void
  className?: string
}) {
  const [phase, setPhase] = useState<Phase>("listening")
  const [heard, setHeard] = useState("")
  const [said, setSaid] = useState("")
  const [error, setError] = useState("")
  const globe = useRef<HTMLButtonElement>(null)
  const session = useRef<VoiceSession | null>(null)
  const ask = useRef(onAsk)
  useEffect(() => {
    ask.current = onAsk
  })

  // Voice mode is opened by a tap, so creating the audio session here is allowed to play sound.
  useEffect(() => {
    const s = new VoiceSession((level) => {
      if (globe.current)
        globe.current.style.transform = `scale(${1 + level * 0.35})`
    })
    session.current = s
    void converse(s)
    return () => s.close()
  }, [])

  async function converse(s: VoiceSession) {
    setError("")
    while (!s.closed) {
      try {
        setPhase("listening")
        const audio = await s.listen()
        if (s.closed) return
        if (!audio) return setPhase("paused")
        setPhase("thinking")
        const text = await s.transcribe(audio)
        if (s.closed) return
        if (!text) continue
        setHeard(text)
        setSaid("")
        const reply = await ask.current(text)
        if (s.closed) return
        setSaid(reply)
        if (!reply) continue
        setPhase("speaking")
        await s.say(reply)
      } catch (e) {
        if (s.closed) return
        const err = e as Error
        setError(
          err.name === "NotAllowedError"
            ? "Microphone access was blocked. Allow it in your browser to talk."
            : err.message
        )
        return setPhase("paused")
      }
    }
  }

  function tapGlobe() {
    const s = session.current
    if (!s) return
    if (phase === "listening") s.doneTalking()
    else if (phase === "speaking") s.interrupt()
    else if (phase === "paused") void converse(s)
  }

  return (
    <div
      role="dialog"
      aria-label="Voice mode"
      className={cn(
        "ic-rise z-40 flex flex-col items-center justify-center gap-8 bg-background/95 p-6 backdrop-blur",
        className
      )}
    >
      <button
        onClick={onClose}
        aria-label="Close voice mode"
        title="Close voice mode"
        className="absolute top-3 right-3 grid size-9 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-5" />
      </button>

      <button
        ref={globe}
        onClick={tapGlobe}
        disabled={phase === "thinking"}
        aria-label={LABEL[phase]}
        className="size-36 transition-transform duration-100 ease-out disabled:cursor-wait sm:size-44"
      >
        <Orb
          className={cn("size-full", phase === "paused" && "opacity-60")}
          active={phase === "thinking" || phase === "speaking"}
        />
      </button>

      <div className="max-w-md space-y-3 text-center" aria-live="polite">
        <p className="text-sm font-medium">{LABEL[phase]}</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {heard && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            You: {heard}
          </p>
        )}
        {said && (
          <p className="line-clamp-4 text-sm leading-relaxed">
            {said.replace(/[*_`#>]/g, "")}
          </p>
        )}
      </div>
    </div>
  )
}

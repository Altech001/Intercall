import { useEffect, useState } from "react"
import { API_BASE } from "@/lib/api"

// Voice mode: record one utterance (stops on a pause), send it to ElevenLabs
// Scribe via /api/voice/transcribe, and play replies from /api/voice/speak.

let enabled: Promise<boolean> | undefined
const browserCanRecord = () =>
  typeof window !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined"

/**
 * True once the server has an ElevenLabs key. The button shows even if this browser
 * can't record, so voice mode can say why instead of silently disappearing.
 */
export function useVoiceEnabled() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    enabled ??= fetch(API_BASE + "/api/voice")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => !!d.enabled)
      .catch(() => {
        enabled = undefined
        return false
      })
    void enabled.then(setOn)
  }, [])
  return on
}

async function check(res: Response) {
  if (res.ok) return res
  const err = await res.json().catch(() => ({}))
  throw new Error(err.error ?? "Voice request failed")
}

const SPEECH_LEVEL = 0.02 // RMS above this counts as talking
const END_PAUSE = 1300 // ms of quiet after speech that ends the turn
const NO_SPEECH = 15_000 // give up listening if nothing is said
const MAX_TURN = 60_000

export class VoiceSession {
  private ctx: AudioContext
  private mic?: MediaStream
  private finish?: (keep: boolean) => void
  private stopAudio?: () => void
  private abort = new AbortController()
  private onLevel: (level: number) => void
  closed = false

  /** Create inside a click handler so the browser lets audio play. */
  constructor(onLevel: (level: number) => void) {
    this.onLevel = onLevel
    this.ctx = new AudioContext()
  }

  private meter(source: AudioNode, onRms: (rms: number) => boolean | void) {
    const analyser = this.ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const buf = new Float32Array(analyser.fftSize)
    let raf = 0
    const tick = () => {
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += v * v
      const rms = Math.sqrt(sum / buf.length)
      this.onLevel(Math.min(1, rms * 8))
      if (onRms(rms) !== false) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      analyser.disconnect()
      this.onLevel(0)
    }
  }

  /** Records until the speaker pauses. Resolves null if nothing was said. */
  async listen(): Promise<Blob | null> {
    if (!browserCanRecord())
      throw new Error(
        window.isSecureContext
          ? "This browser can't record audio. Try Chrome, Edge, Firefox or Safari."
          : "Voice needs a secure page: open this site over https:// (or localhost) to use the microphone."
      )
    await this.ctx.resume()
    this.mic ??= await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    if (this.closed) return null
    const source = this.ctx.createMediaStreamSource(this.mic)
    const rec = new MediaRecorder(this.mic)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)

    return new Promise((resolve) => {
      const start = performance.now()
      let spoke = false
      let quietSince = start
      let stopMeter = () => {}
      const finish = (keep: boolean) => {
        this.finish = undefined
        stopMeter()
        source.disconnect()
        rec.onstop = () =>
          resolve(
            keep && spoke && !this.closed
              ? new Blob(chunks, { type: rec.mimeType })
              : null
          )
        if (rec.state === "inactive") resolve(null)
        else rec.stop()
      }
      this.finish = finish
      rec.start()
      stopMeter = this.meter(source, (rms) => {
        const now = performance.now()
        if (rms > SPEECH_LEVEL) {
          spoke = true
          quietSince = now
        }
        const ended =
          (spoke && now - quietSince > END_PAUSE) || now - start > MAX_TURN
        const silent = !spoke && now - start > NO_SPEECH
        if (!ended && !silent) return true
        finish(ended)
        return false
      })
    })
  }

  /** Ends the current recording now and keeps what was said. */
  doneTalking() {
    this.finish?.(true)
  }

  async transcribe(audio: Blob): Promise<string> {
    const res = await check(
      await fetch(API_BASE + "/api/voice/transcribe", {
        method: "POST",
        headers: { "content-type": audio.type || "audio/webm" },
        body: audio,
        signal: this.abort.signal,
      })
    )
    return ((await res.json()) as { text: string }).text
  }

  /** Speaks the text with ElevenLabs; resolves when playback ends or is interrupted. */
  async say(text: string): Promise<void> {
    const res = await check(
      await fetch(API_BASE + "/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        signal: this.abort.signal,
      })
    )
    const url = URL.createObjectURL(await res.blob())
    if (this.closed) return URL.revokeObjectURL(url)
    const audio = new Audio(url)
    const source = this.ctx.createMediaElementSource(audio)
    source.connect(this.ctx.destination)
    await new Promise<void>((resolve) => {
      const stopMeter = this.meter(source, () => {})
      const done = () => {
        this.stopAudio = undefined
        stopMeter()
        source.disconnect()
        URL.revokeObjectURL(url)
        resolve()
      }
      audio.onended = done
      audio.onerror = done
      this.stopAudio = () => {
        audio.pause()
        done()
      }
      audio.play().catch(done)
    })
  }

  /** Cuts the reply off mid-sentence. */
  interrupt() {
    this.stopAudio?.()
  }

  close() {
    this.closed = true
    this.abort.abort()
    this.finish?.(false)
    this.stopAudio?.()
    this.mic?.getTracks().forEach((t) => t.stop())
    void this.ctx.close()
  }
}

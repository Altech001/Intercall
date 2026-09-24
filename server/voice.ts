import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"

// ElevenLabs speech for voice mode: Scribe turns the caller's audio into text,
// TTS reads the reply back. Without a key, voice mode is hidden in the UI.
let client: ElevenLabsClient | undefined
const eleven = () =>
  (client ??= new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY }))

export const voiceEnabled = () => !!process.env.ELEVENLABS_API_KEY

const VOICE_ID = () => process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"
// Flash is ElevenLabs' lowest-latency TTS model, which matters for back-and-forth talk.
const TTS_MODEL = () => process.env.ELEVENLABS_TTS_MODEL || "eleven_flash_v2_5"
const STT_MODEL = () => process.env.ELEVENLABS_STT_MODEL || "scribe_v1"

export async function transcribe(audio: Blob): Promise<string> {
  const res = await eleven().speechToText.convert({
    file: audio,
    modelId: STT_MODEL(),
    tagAudioEvents: false,
  })
  return "text" in res ? res.text.trim() : ""
}

/** Streams MP3 audio for the text as it's generated. */
export function speak(text: string): Promise<ReadableStream<Uint8Array>> {
  return eleven().textToSpeech.convert(VOICE_ID(), {
    text,
    modelId: TTS_MODEL(),
    outputFormat: "mp3_44100_128",
  })
}

/** Markdown and card markup read aloud badly; keep only the words. */
export function speakable(text: string) {
  return text
    .replace(/<ui>[\s\S]*?(<\/ui>|$)/g, "")
    .replace(/\[\[[A-Z]+[^\]]*\]\]/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*(#{1,6}|>|[-*•]|\d+[.)])\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

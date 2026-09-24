import { useEffect, useRef } from "react"

/**
 * Runs `fn` now and every `ms` while enabled; restarts when `key` changes.
 * Used for live tickets and widget replies (the API has no push channel).
 */
export function usePoll(fn: () => Promise<unknown>, ms: number, key: unknown, enabled = true) {
  const latest = useRef(fn)
  useEffect(() => {
    latest.current = fn
  })
  useEffect(() => {
    if (!enabled) return
    const run = () => void latest.current().catch(() => {})
    const first = setTimeout(run, 0)
    const timer = setInterval(run, ms)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [ms, key, enabled])
}

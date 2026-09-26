import { useSyncExternalStore } from "react"
import type { PublicCustomer } from "./api"

// Who the widget is talking as: an anonymous visitor id, upgraded to a
// wallet session once the visitor signs in with their Sui wallet.
type Identity = { visitorId: string; token?: string; address?: string; customer?: PublicCustomer }

const KEY = "intercall.identity"
const listeners = new Set<() => void>()

function read(): Identity {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null")
    if (v?.visitorId) return v
  } catch {
    /* storage unavailable */
  }
  return { visitorId: uuid() }
}

let state = read()
write(state)

function write(next: Identity) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable: identity lasts for this page only */
  }
  listeners.forEach((l) => l())
}

export const identity = {
  get: () => state,
  set: (patch: Partial<Identity>) => write({ ...state, ...patch }),
  signOut: () => write({ visitorId: state.visitorId }),
  /** Body fields every widget request carries. */
  auth: () => ({ visitorId: state.visitorId, token: state.token }),
}

export function useIdentity() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state
  )
}

/** crypto.randomUUID only exists on secure pages (https, localhost); plain-http LAN addresses need a fallback. */
function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

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
  return { visitorId: crypto.randomUUID() }
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

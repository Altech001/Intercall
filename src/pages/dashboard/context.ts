import { useOutletContext } from "react-router"
import type { Status, TicketSummary } from "@/lib/api"

export type Ctx = { tickets: TicketSummary[]; status?: Status; reload: () => Promise<void> }
export const useDashboard = () => useOutletContext<Ctx>()

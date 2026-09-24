import { useCallback, useState } from "react"
import { Link } from "react-router"
import { BadgeCheck, Mail } from "lucide-react"
import { api, formatTokens, shortAddr, timeAgo, totalTokens, type CustomerDetail, type TicketSummary } from "@/lib/api"
import { usePoll } from "@/lib/use-poll"
import { useDashboard } from "./context"

/** Every customer with their AI token usage, memory and what the bot understands about them. */
export function CustomersPage() {
  const { tickets, status } = useDashboard()
  const [customers, setCustomers] = useState<CustomerDetail[]>()
  const load = useCallback(async () => setCustomers(await api<CustomerDetail[]>("/api/customers")), [])
  usePoll(load, 5000, null)

  const customerTokens = customers?.reduce((n, c) => n + totalTokens(c.tokens), 0) ?? 0
  const operatorTokens = totalTokens(status?.usage.operator)
  const latestTicket = (id: string) => tickets.find((t: TicketSummary) => t.customer?.id === id)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everyone who has talked to the widget, what AMI understands about them, and the AI tokens they've used.</p>

        <dl className="mt-8 grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
          {[
            ["Customers", customers?.length ?? "—"],
            ["Tokens · customers", formatTokens(customerTokens)],
            ["Tokens · your team", formatTokens(operatorTokens)],
            ["Memories", status?.counts.memories ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="bg-background p-4">
              <dd className="font-mono text-2xl font-semibold">{v}</dd>
              <dt className="mt-1 text-[10px] tracking-widest text-muted-foreground uppercase">{k}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-8 overflow-x-auto border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-[10px] tracking-widest text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Understanding</th>
                <th className="px-4 py-2.5 text-right font-semibold">Tickets</th>
                <th className="px-4 py-2.5 text-right font-semibold">Memories</th>
                <th className="px-4 py-2.5 text-right font-semibold">Tokens</th>
                <th className="px-4 py-2.5 text-right font-semibold">Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers?.map((c) => {
                const t = latestTicket(c.id)
                const share = customerTokens ? totalTokens(c.tokens) / customerTokens : 0
                return (
                  <tr key={c.id} className="align-top hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to={t ? `/dashboard/t/${t.id}` : "#"} className="font-medium hover:underline">
                        {c.name ?? (c.wallet ? shortAddr(c.wallet) : "Guest")}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {c.wallet && <BadgeCheck className="size-3 text-emerald-600" />}
                        {c.email ? (
                          <>
                            <Mail className="size-3" /> {c.email}
                          </>
                        ) : (
                          c.tier
                        )}
                      </div>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-xs leading-relaxed text-muted-foreground">{c.insight ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {c.ticketCount}
                      {c.openTickets > 0 && <span className="text-emerald-600"> ·{c.openTickets}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{c.memoryCount}</td>
                    <td className="px-4 py-3 text-right" title={`${c.tokens.input} in / ${c.tokens.output} out`}>
                      <div className="font-mono">{formatTokens(totalTokens(c.tokens))}</div>
                      <div className="mt-1 ml-auto h-1 w-16 bg-border">
                        <div className="h-full bg-foreground" style={{ width: `${Math.round(share * 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs whitespace-nowrap text-muted-foreground">{timeAgo(c.lastSeen)}</td>
                  </tr>
                )
              })}
              {customers?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

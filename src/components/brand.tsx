import { cn } from "@/lib/utils"

export function Orb({ className, active }: { className?: string; active?: boolean }) {
  return <span aria-hidden className={cn("ic-orb", active && "ic-orb-active", className)} />
}

export function Logo({ className, mark = "size-7" }: { className?: string; mark?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <img src="/logo.png" alt="" width={28} height={28} className={cn("shrink-0 object-contain", mark)} />
      <span>intercall</span>
    </span>
  )
}

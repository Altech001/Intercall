import { useRef } from "react"
import { Link } from "react-router"
import {
  ArrowRight,
  // Brain,
  ChevronDown,
  LayoutDashboard,
  Lock,
  MessageSquareText,
  Code2,
  Sparkles,
  Ticket,
  Wallet,
  type LucideIcon,
  Brain,
  BotIcon,
} from "lucide-react"
import { Logo, Orb } from "@/components/brand"
import { WalletButton } from "@/components/wallet-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { openChat } from "@/lib/api"
import { Magnetic, Reveal, Words } from "@/lib/motion"
import { cn } from "@/lib/utils"

const PRODUCTS: { icon: LucideIcon; title: string; body: string; to?: string; href?: string; chat?: boolean }[] = [
  { icon: MessageSquareText, title: "Chat widget", body: "AI support that remembers every customer", chat: true },
  { icon: LayoutDashboard, title: "Dashboard", body: "Live tickets, customers and token usage", to: "/dashboard" },
  { icon: Brain, title: "Walrus Memory", body: "Seal-encrypted memory, owned on Sui", href: "#product" },
  { icon: Code2, title: "Embed", body: "One script tag on any website", href: "#embed" },
]

/** Floating, glassy navigation bar (dark, like the hero it sits on). */
export function HeroNav() {
  return (
    <header className="dark fixed inset-x-3 top-3 z-40 sm:inset-x-6 sm:top-4">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 rounded border border-white/10 bg-[#0e0f13]/75 px-3 text-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:px-4">
        <Link to="/" className="px-1 text-xl">
          <Logo mark="size-8" />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-2 hidden items-center gap-1.5 rounded-none border border-white/12 px-3.5 py-2 text-sm text-white/90 transition-colors outline-none hover:bg-white/5 data-[state=open]:bg-white/5 md:flex">
            Products <ChevronDown className="size-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={10} className="dark w-80 rounded-xl border border-white/10 bg-[#121318] p-2 text-white">
            {PRODUCTS.map((p) => {
              const inner = (
                <>
                  <span className="grid size-9 shrink-0 place-items-center rounded text-white">
                    <p.icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{p.title}</span>
                    <span className="block text-xs text-white/55">{p.body}</span>
                  </span>
                </>
              )
              return (
                <DropdownMenuItem key={p.title} asChild={!p.chat} onSelect={p.chat ? openChat : undefined} className="gap-3 rounded-lg p-2.5 tracking-normal normal-case focus:bg-white/6">
                  {p.to ? <Link to={p.to}>{inner}</Link> : p.href ? <a href={p.href}>{inner}</a> : inner}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <nav className="mx-auto hidden items-center gap-8 text-sm text-white/80 lg:flex">
          <a href="#product" className="transition-colors hover:text-white">Features</a>
          <a href="#how" className="transition-colors hover:text-white">How it works</a>
          <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <Link to="/dashboard" className="hidden rounded px-4 py-2 text-sm text-white/85 transition-colors hover:text-white sm:block">
            Log in
          </Link>
          <WalletButton className="h-10 rounded- border border-white/10 bg-white/10 px-4 text-sm font-medium tracking-normal text-white normal-case hover:bg-white/15" />
        </div>
      </div>
    </header>
  )
}

/** Z-pattern hero: walrus visual on the left, headline and actions on the right. */
export function Hero() {
  const ref = useRef<HTMLElement>(null)

  // Cursor parallax: layers read --px/--py (−0.5…0.5) scaled by their depth.
  function onMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
    el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
  }

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      className="dark relative isolate overflow-hidden bg-[#09090c] text-white"
    >
      {/* lighting */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] size-[700px] rounded-full bg-[radial-gradient(closest-side,rgba(31,107,255,0.22),transparent)]" />
        <div className="absolute bottom-[-30%] left-[20%] size-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(53,208,255,0.12),transparent)]" />
        <div className="ic-hero-grain absolute inset-0 opacity-[0.07]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-[#09090c]" />
      </div>

      <div className="mx-auto grid min-h-svh max-w-7xl items-center gap-6 px-4 pt-28 pb-16 sm:px-8 lg:grid-cols-[1.12fr_1fr] lg:gap-4 lg:pt-24">
        {/* Visual (left on desktop, second on mobile) */}
        <div className="relative order-2 mx-auto aspect-square w-full max-w-[640px] lg:order-1">
          {/* glow in the render's own grey, so its edges dissolve into the scene */}
          <div aria-hidden className="absolute inset-[-18%] rounded-full bg-[radial-gradient(closest-side,#404040_0%,#3a3a3c_38%,#1c1c20_66%,transparent_100%)]" />
          <Layer depth={14} className="absolute inset-x-[-4%] top-[8%] bottom-[4%]">
            <img
              src="/walrus-hero.avif"
              alt="Walrus, the storage network InterCall keeps memories on"
              width={1200}
              height={900}
              fetchPriority="high"
              className="ic-hero-walrus size-full object-contain"
            />
          </Layer>

          {/* metallic coins, blurred when "far away"
          <Coin icon={Brain} depth={40} className="top-[6%] left-[2%] size-20" delay={0.2} />
          <Coin icon={Lock} depth={-24} className="top-[2%] right-[18%] size-14 blur-[1.5px]" delay={1.1} tilt={18} />
          <Coin icon={Wallet} depth={55} className="bottom-[14%] left-[-2%] size-24" delay={0.6} tilt={-14} />
          <Coin icon={Sparkles} depth={-30} className="right-[4%] bottom-[34%] size-12 blur-[2.5px]" delay={1.6} tilt={24} />
          <Coin icon={Ticket} depth={30} className="bottom-[2%] left-[38%] size-16 blur-[0.8px]" delay={0.9} tilt={-20} /> */}

          {/* product moments floating in the scene */}
          <Layer depth={-36} className="absolute top-[10%] right-[2%] origin-top-right scale-[0.82] sm:right-[4%] sm:scale-100">
            <Glass className="w-64" delay={500}>
              <div className="flex items-center gap-2.5">
                <Orb className="size-7" active />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">Welcome back, Priya 👋</div>
                  <div className="text-[11px] text-white/55">Same WhatsApp updates as last time?</div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-cyan-300">
                <Brain className="size-3" /> 4 memories recalled
              </div>
            </Glass>
          </Layer>

          <Layer depth={48} className="absolute bottom-[22%] left-[6%] hidden sm:left-[10%] sm:block">
            <Glass delay={800}>
              <div className="flex items-center gap-2.5">
                <IconChip icon={Lock} />
                <div>
                  <div className="text-xs font-medium">Sealed on Walrus</div>
                  <div className="font-mono text-[10px] text-white/50">blob · HG_XyEmQhlY…</div>
                </div>
              </div>
            </Glass>
          </Layer>

          <Layer depth={-20} className="absolute right-[6%] bottom-[8%] origin-bottom-right scale-[0.82] sm:scale-100">
            <Glass delay={1100}>
              <div className="flex items-center gap-2.5">
                <IconChip icon={Ticket} />
                <div>
                  <div className="text-xs font-medium">Ticket #1042 · priority</div>
                  <div className="text-[10px] text-white/50">Form filled · team notified</div>
                </div>
              </div>
            </Glass>
          </Layer>
        </div>

        {/* Copy (right on desktop) */}
        <div className="relative order-1 lg:order-2 lg:pl-4">

          <h1 className="mt-6 text-[clamp(2.8rem,5.4vw,5.4rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">
            <Words text="Support That" />
            <br />
            <span className="ic-hero-gradient">
              <Words text="Never Forgets" />
            </span>
          </h1>


          <Reveal delay={400}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link
                  to="/dashboard"
                  className="ic-hero-cta group inline-flex h-12 items-center gap-2 rounded px-6 text-sm font-semibold text-white"
                >
                  Navgiate To Dash
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Magnetic>
              <Magnetic>
                <button
                  onClick={openChat}
                  className="inline-flex h-12 items-center gap-2 rounded bg-white/6 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  <MessageSquareText className="size-4" /> Talk to AMI
                </button>
              </Magnetic>
            </div>
          </Reveal>

          <Reveal delay={550}>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/55">
              {[
                [Lock, "Seal-encrypted memory"],
                [Wallet, "Wallet optional"],
                [Brain, "All Navidia Models"],
              ].map(([Icon, label]) => {
                const I = Icon as LucideIcon
                return (
                  <li key={label as string} className="flex items-center gap-2">
                    <I className="size-3.5 text-cyan-300" /> {label as string}
                  </li>
                )
              })}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/** Moves with the cursor by `depth` px (negative = opposite direction, reads as further away). */
function Layer({ depth, className, children }: { depth: number; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("transition-transform duration-500 ease-out will-change-transform", className)}
      style={{ transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth}px), 0)` }}
    >
      {children}
    </div>
  )
}

function Glass({ className, delay = 0, children }: { className?: string; delay?: number; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "ic-glass rounded  bg-white/[0.07] p-3.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl",
        className
      )}
      style={{ animationDelay: `${delay}ms, ${delay / 1000 + 1}s` }}
    >
      {children}
    </div>
  )
}

function IconChip({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-8 place-items-center rounded bg-blue-500/50">
      <Icon className="size-4 text-white" />
    </span>
  )
}

/** A brushed-metal token with an embossed icon, floating in the scene. */
function Coin({
  icon: Icon,
  depth,
  className,
  delay,
  tilt = 10,
}: {
  icon: LucideIcon
  depth: number
  className?: string
  delay: number
  tilt?: number
}) {
  return (
    <Layer depth={depth} className={cn("absolute", className)}>
      <div className="ic-float size-full" style={{ animationDelay: `${delay}s`, animationDuration: `${5 + delay}s` }}>
        <div className="ic-coin grid size-full place-items-center rounded-full" style={{ transform: `rotate(${tilt}deg)` }}>
          <Icon className="size-[42%] text-[#2b2f38] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]" strokeWidth={2.4} />
        </div>
      </div>
    </Layer>
  )
}

import { useState } from "react"
import { Link } from "react-router"
import { ArrowRight, Brain, Check, Copy, Ticket, Wallet } from "lucide-react"
import { ChatWidget } from "@/components/chat-widget"
import { Hero, HeroNav } from "@/pages/landing-hero"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { embedSnippet, openChat } from "@/lib/api"
import { FillStatement, Magnetic, Reveal, Words } from "@/lib/motion"

const MARQUEE = [
  "Walrus Memory",
  "Seal encryption",
  "Sui wallets",
  "Walrus Memory",
  "NVIDIA NIM",
  "Live tickets",
  "Human hand-off",
  "Semantic recall",
  "One-line embed",
]

const BUCKETS = [
  {
    icon: Brain,
    title: "Memory that learns",
    body: "Every conversation is distilled into facts about the person: their name, plan, preferences, what broke last time. Next visit, the bot already knows.",
    points: ["Semantic recall per message", "Facts extracted automatically", "Seal-encrypted on Walrus"],
    tag: "Recall in ~200ms",
  },
  {
    icon: Ticket,
    title: "A ticket for every chat",
    body: "The widget opens a ticket the moment someone writes. Your team sees it live, taps in, and takes over. Or lets the AI keep going.",
    points: ["Autopilot, copilot or human", "AI drafts with full memory", "Auto hand-off when stuck"],
    tag: "Zero setup",
  },
  {
    icon: Wallet,
    title: "Wallet-native identity",
    body: "Customers who connect a Sui wallet get memory that follows them across devices, priority routing, and ownership of what's remembered.",
    points: ["One signature, no passwords", "Guest history merges on sign-in", "Priority queue in the dashboard"],
    tag: "Better service, opt-in",
  },
]

const STEPS = [
  { n: "01", title: "Embed", sub: "One script tag", body: "Drop the widget on any site. It works for guests immediately." },
  { n: "02", title: "Chat", sub: "Recall → answer → learn", body: "Each message recalls relevant memories, the model answers, new facts get stored." },
  { n: "03", title: "Take over", sub: "Tap the ticket", body: "Open any conversation in the dashboard and reply as a human, in the same thread." },
]

const FAQ = [
  ["Where are memories stored?", "On Walrus, the decentralized storage network on Sui, through Walrus Memory. Each customer has their own namespace, and memories are recalled by meaning, not keywords."],
  ["Who can read them?", "Memories are encrypted with Seal before they leave the relayer. Only the delegate key you control can decrypt them for recall. Walrus nodes store ciphertext."],
  ["Do customers need a wallet?", "No. Guests get memory tied to their browser. Connecting a Sui wallet is optional; it makes memory portable across devices and moves them to the priority queue."],
  ["Which model answers?", "Any NVIDIA NIM model you choose (GLM, Nemotron, DeepSeek, Kimi and more), with the customer's recalled memories and your knowledge base in context. Switch models from the dashboard in one click, no redeploy."],
  ["What if the bot can't help?", "It says so, hands the ticket to your team, and stops replying. The customer sees a teammate pick it up in the same chat window."],
  ["Can I run it myself?", "Yes. It's a single Vite + Node app. Add your NVIDIA and Walrus Memory keys and deploy anywhere."],
]

export function Landing() {
  return (
    <div className="min-h-svh overflow-x-hidden bg-background text-foreground">
      <HeroNav />
      <Hero />
      <Marquee />
      <Buckets />
      <section className="border-y px-4 py-24 sm:px-8 sm:py-36">
        <FillStatement
          text="Your customers shouldn't have to repeat themselves. Not to a bot, not to your team, not on a new device."
          className="mx-auto max-w-5xl text-[clamp(2rem,5.5vw,4.5rem)] leading-[1.02] font-bold tracking-[-0.04em]"
        />
      </section>
      <Process />
      <Embed />
      <Faq />
      <FooterCta />
      <ChatWidget />
    </div>
  )
}

function Marquee() {
  const row = [...MARQUEE, ...MARQUEE]
  return (
    <div className="ic-marquee-host overflow-hidden border-y bg-primary py-5 text-primary-foreground">
      <div className="ic-marquee flex w-max gap-8 text-2xl font-bold tracking-tight whitespace-nowrap sm:text-4xl">
        {[...row, ...row].map((w, i) => (
          <span key={i} className="flex items-center gap-8">
            {w} <span className="text-primary-foreground/40">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function Buckets() {
  return (
    <section id="product" className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
      <h2 className="mb-16 max-w-3xl text-[clamp(2.25rem,5vw,4rem)] leading-[0.95] font-bold tracking-[-0.04em]">
        <Words text="Three things your help desk forgot to do." />
      </h2>
      <div className="grid gap-px border bg-border md:grid-cols-3">
        {BUCKETS.map((b, i) => (
          <Reveal key={b.title} delay={i * 120} className="group flex flex-col bg-background p-8 transition-colors hover:bg-muted/40">
            <div className="mb-10 flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <b.icon className="size-5 transition-transform group-hover:-rotate-12" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">{b.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
            <ul className="mt-6 space-y-2 text-sm">
              {b.points.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check className="size-3.5" /> {p}
                </li>
              ))}
            </ul>
            <span className="mt-auto pt-10 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{b.tag}</span>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Process() {
  return (
    <section id="how" className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
      <h2 className="mb-16 text-[clamp(2.25rem,5vw,4rem)] leading-[0.95] font-bold tracking-[-0.04em]">
        <Words text="No scripts. Three moves." />
      </h2>
      <div className="grid gap-10 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 140} className="border-t-2 border-foreground pt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-6xl font-bold tracking-tighter">{s.n}</span>
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{s.sub}</span>
            </div>
            <h3 className="mt-6 text-xl font-bold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Embed() {
  const [copied, setCopied] = useState(false)
  return (
    <section id="embed" className="border-y border-dashed  px-4 py-20 sm:px-8">
      <Reveal className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Live on your site in one line.</h2>
          <p className="mt-2 text-muted-foreground">Paste before &lt;/body&gt;. Chats show up in your dashboard as tickets.</p>
        </div>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(embedSnippet())
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="group flex max-w-full items-center gap-4 border bg-background px-5 py-4 text-left font-mono text-xs sm:text-sm"
        >
          <code className="truncate">{embedSnippet()}</code>
          {copied ? <Check className="size-4 shrink-0" /> : <Copy className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />}
        </button>
      </Reveal>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-8 sm:py-32 lg:grid-cols-[1fr_1.4fr]">
      <h2 className="text-[clamp(2.25rem,5vw,4rem)] leading-[0.95] font-bold tracking-[-0.04em]">
        <Words text="Questions, answered." />
      </h2>
      <Accordion type="single" collapsible className="border-t">
        {FAQ.map(([q, a]) => (
          <AccordionItem key={q} value={q}>
            <AccordionTrigger className="py-5 text-base">{q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

function FooterCta() {
  return (
    <footer className="bg-primary rounded-tr-full px-4 pt-24 pb-10 text-primary-foreground sm:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-[clamp(3rem,11vw,10rem)] leading-[0.88] font-bold tracking-[-0.05em]">
          <Words text="Let's make support remember." />
        </h2>
        <div className="mt-12 flex flex-wrap gap-3">
          <Magnetic>
            <Button size="lg" variant="secondary" onClick={openChat}>
              Talk to AMI <ArrowRight data-icon="inline-end" />
            </Button>
          </Magnetic>
          <Button asChild size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <Link to="/dashboard">Open dashboard</Link>
          </Button>
        </div>
        <div className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-primary-foreground/15 pt-6 text-xs text-primary-foreground/60">
          <span>© {new Date().getFullYear()} InterCall</span>
          <span>Built on Walrus Memory · Seal · Sui · NVIDIA NIM</span>
        </div>
      </div>
    </footer>
  )
}

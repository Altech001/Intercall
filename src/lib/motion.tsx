import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Adds `is-in` once the element scrolls into view. */
function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-in")
          io.disconnect()
        }
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return ref
}

export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
}: {
  as?: ElementType
  delay?: number
  className?: string
  children: ReactNode
}) {
  const ref = useInView<HTMLElement>(0.15)
  return (
    <Tag ref={ref} className={cn("ic-reveal", className)} style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      {children}
    </Tag>
  )
}

/** Splits text into words that rise from a mask in sequence. */
export function Words({ text, as: Tag = "span", className }: { text: string; as?: ElementType; className?: string }) {
  const ref = useInView<HTMLElement>(0.3)
  return (
    <Tag ref={ref} className={cn("ic-words", className)}>
      {text.split(" ").map((w, i) => (
        <span key={i}>
          <span style={{ "--i": i } as React.CSSProperties}>{w}&nbsp;</span>
        </span>
      ))}
    </Tag>
  )
}

const GLYPHS = "アカサタナハマヤラワ0123456789ABCDEFGH#%&*"

/** Resolves text out of random glyphs, left to right. */
export function Scramble({ text, className }: { text: string; className?: string }) {
  const [out, setOut] = useState(text)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let frame = 0
    let raf = 0
    const tick = () => {
      frame++
      const done = Math.floor(frame / 2)
      setOut(
        text
          .split("")
          .map((c, i) => (i < done || c === " " ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join("")
      )
      if (done < text.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text])
  return <span className={className}>{out}</span>
}

/** Words fill from outline to solid as the block scrolls through the viewport. */
export function FillStatement({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const words = Array.from(el.children) as HTMLElement[]
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)))
      const n = Math.round(p * words.length)
      words.forEach((w, i) => w.classList.toggle("on", i < n))
    }
    const onScroll = () => (raf ||= requestAnimationFrame(update))
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <p ref={ref} className={cn("ic-fill", className)}>
      {text.split(" ").map((w, i) => (
        <span key={i}>{w} </span>
      ))}
    </p>
  )
}

/** Pulls its child toward the cursor, springing back on leave. */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span
      ref={ref}
      className="inline-block"
      onMouseMove={(e) => {
        const el = ref.current!
        const r = el.getBoundingClientRect()
        el.style.transition = "transform .15s ease-out"
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`
      }}
      onMouseLeave={() => {
        const el = ref.current!
        el.style.transition = "transform .55s cubic-bezier(.34,1.56,.64,1)"
        el.style.transform = ""
      }}
    >
      {children}
    </span>
  )
}

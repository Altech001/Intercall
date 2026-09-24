import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Cpu, Loader2, Save, Search } from "lucide-react"
import { api, type ModelCheck } from "@/lib/api"
import { cn } from "@/lib/utils"

type Entry = { id: string; check?: ModelCheck }

/** Choose any NVIDIA NIM model: search the live catalogue, test it, or paste a custom id. */
export function ModelPicker({
  current,
  onSaved,
  align = "left",
  side = "top",
}: {
  current?: string
  onSaved: () => void
  align?: "left" | "right"
  side?: "top" | "bottom"
}) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<Entry[]>([])
  const [error, setError] = useState<string>()
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string>()
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    api<{ models: Entry[]; error?: string }>("/api/models")
      .then((r) => {
        setModels(r.models)
        setError(r.error)
      })
      .catch((e) => setError((e as Error).message))
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => models.filter((m) => m.id.toLowerCase().includes(q)), [models, q])
  const custom = q && !models.some((m) => m.id.toLowerCase() === q) ? query.trim() : undefined
  const selected = picked ?? current

  async function test(id: string) {
    setTesting((t) => ({ ...t, [id]: true }))
    const check = await api<ModelCheck>("/api/models/test", { body: { model: id } }).catch(
      (e) => ({ ok: false, ms: 0, error: (e as Error).message, at: Date.now() }) as ModelCheck
    )
    setModels((ms) => (ms.some((m) => m.id === id) ? ms.map((m) => (m.id === id ? { ...m, check } : m)) : [{ id, check }, ...ms]))
    setTesting((t) => ({ ...t, [id]: false }))
  }

  async function save() {
    if (!picked) return
    setSaving(true)
    await api("/api/settings", { method: "PUT", body: { model: picked } }).catch(() => {})
    setSaving(false)
    setPicked(undefined)
    setOpen(false)
    onSaved()
    void test(picked)
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-56 items-center gap-1.5 px-2.5 py-1.5 text-xs text-fuchsia-600 hover:bg-muted dark:text-fuchsia-400"
      >
        <Cpu className="size-3.5 shrink-0" />
        <span className="truncate">{current ? current.split("/").pop() : "Model"}</span>
        <ChevronDown className="size-3 shrink-0" />
      </button>

      {open && (
        <div
          className={cn(
            "ic-rise absolute z-50 flex max-h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col border bg-popover text-popover-foreground shadow-xl",
            align === "right" ? "right-0" : "left-0",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <span className="text-xs font-semibold">Select AI model</span>
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">NVIDIA NIM</span>
          </div>
          <label className="flex items-center gap-2 border-b px-3">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or paste any model id…"
              className="h-9 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {error && <p className="p-2 text-xs text-destructive">{error}</p>}
            {custom && (
              <Row id={custom} label={`Use "${custom}"`} selected={selected === custom} onPick={() => setPicked(custom)} testing={testing[custom]} onTest={() => void test(custom)} />
            )}
            {!models.length && !error && (
              <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Loading catalogue…
              </div>
            )}
            {shown.map((m) => (
              <Row key={m.id} id={m.id} check={m.check} selected={selected === m.id} onPick={() => setPicked(m.id)} testing={testing[m.id]} onTest={() => void test(m.id)} />
            ))}
          </div>
          <div className="border-t p-2">
            <button
              type="button"
              disabled={!picked || picked === current || saving}
              onClick={() => void save()}
              className="flex w-full items-center justify-center gap-1.5 border py-2 text-xs font-medium hover:bg-muted disabled:opacity-40"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  id,
  label,
  check,
  selected,
  testing,
  onPick,
  onTest,
}: {
  id: string
  label?: string
  check?: ModelCheck
  selected: boolean
  testing?: boolean
  onPick: () => void
  onTest: () => void
}) {
  const [vendor, name] = id.includes("/") ? id.split("/", 2) : ["", id]
  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn("group flex cursor-pointer items-center gap-2.5 px-2 py-2 hover:bg-muted", selected && "bg-muted")}
    >
      <span
        title={check ? (check.ok ? `Answered in ${(check.ms / 1000).toFixed(1)}s` : check.error) : "Not tested"}
        className={cn("size-1.5 shrink-0 rounded-full", !check ? "bg-border" : check.ok ? "bg-emerald-500" : "bg-destructive")}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs">{label ?? name}</div>
        <div className="truncate text-[10px] text-muted-foreground">
          {check && !check.ok ? check.error : check?.ok ? `${vendor} · ${(check.ms / 1000).toFixed(1)}s` : vendor}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onTest()
        }}
        className="text-[10px] tracking-widest text-muted-foreground uppercase opacity-0 group-hover:opacity-100 hover:text-foreground"
      >
        {testing ? <Loader2 className="size-3 animate-spin" /> : "Test"}
      </button>
      {selected && <Check className="size-3.5 shrink-0" />}
    </div>
  )
}

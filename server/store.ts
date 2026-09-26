// Postgres persistence for the in-memory `db` object. Every customer, ticket,
// memory, session and nonce is its own row ("tickets/<id>" → JSON), so requests
// on different serverless instances only overwrite the records they changed.
//
// sync() pulls the latest rows into `db` before a request; flush() writes the
// records that changed since the last sync or flush.

export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>

const DICTS = ["customers", "tickets", "sessions", "nonces"] as const
const METAS = ["settings", "usage", "seq"] as const

type Shape = Record<(typeof DICTS)[number], Record<string, unknown>> &
  Record<(typeof METAS)[number], unknown> & { memories: { id: string }[] }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)

/** Each record of `data` serialized under its row key. */
function records(data: Shape) {
  const out = new Map<string, string>()
  for (const d of DICTS) for (const [id, v] of Object.entries(data[d])) out.set(`${d}/${id}`, JSON.stringify(v))
  for (const m of data.memories) out.set(`memories/${m.id}`, JSON.stringify(m))
  for (const m of METAS) out.set(`meta/${m}`, JSON.stringify(data[m]))
  return out
}

/** Replace an object's contents, keeping its identity so handlers holding it see the update. */
function replace(target: Obj, src: Obj) {
  for (const k of Object.keys(target)) delete target[k]
  Object.assign(target, src)
}

export function pgStore<T extends Shape>(query: Query, db: T, defaults: () => T) {
  // Last state known to be in Postgres for each key. A record whose JSON differs
  // from it has unsaved local changes and is never overwritten by sync().
  let snapshot: Map<string, string> | undefined
  const writing = new Set<string>()
  let chain = Promise.resolve()

  const get = (key: string): unknown => {
    const [kind, id] = split(key)
    if (kind === "memories") return db.memories.find((m) => m.id === id)
    if (kind === "meta") return db[id as (typeof METAS)[number]]
    return db[kind as (typeof DICTS)[number]][id]
  }

  const put = (key: string, value: unknown) => {
    const [kind, id] = split(key)
    const current = get(key)
    if (isObj(current) && isObj(value)) return replace(current, value)
    if (kind === "memories") db.memories.push(value as { id: string })
    else if (kind === "meta") (db as Obj)[id] = value
    else db[kind as (typeof DICTS)[number]][id] = value
  }

  const remove = (key: string) => {
    const [kind, id] = split(key)
    if (kind === "meta") return // absent means default
    if (kind === "memories") {
      const i = db.memories.findIndex((m) => m.id === id)
      if (i >= 0) db.memories.splice(i, 1)
    } else delete db[kind as (typeof DICTS)[number]][id]
  }

  async function init() {
    await query(`create table if not exists intercall_records (
      key text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )`)
    const [{ n }] = await query("select count(*)::int as n from intercall_records")
    if (n === 0) {
      // Empty database: keep whatever `db` holds (a local data file, if any) and upload it.
      snapshot = new Map()
      await flush()
    } else {
      Object.assign(db, defaults())
      snapshot = records(db)
    }
  }

  async function sync() {
    if (!snapshot) await init()
    const snap = snapshot!
    const rows = await query("select key, data from intercall_records")
    const local = records(db)
    const seen = new Set<string>()
    for (const row of rows) {
      const key = row.key as string
      seen.add(key)
      if (writing.has(key) || (local.has(key) && local.get(key) !== snap.get(key))) continue
      const json = JSON.stringify(row.data)
      if (json !== local.get(key)) put(key, row.data)
      snap.set(key, JSON.stringify(get(key)))
    }
    // Rows deleted by another instance, unless changed here since.
    for (const key of [...snap.keys()]) {
      if (seen.has(key) || writing.has(key)) continue
      if (local.get(key) === snap.get(key)) remove(key)
      if (!key.startsWith("meta/")) snap.delete(key)
    }
  }

  function flush() {
    chain = chain.then(write, write)
    return chain
  }

  async function write() {
    if (!snapshot) return
    const snap = snapshot
    const current = records(db)
    const upserts = [...current].filter(([k, v]) => snap.get(k) !== v)
    const deletes = [...snap.keys()].filter((k) => !current.has(k) && !k.startsWith("meta/"))
    if (!upserts.length && !deletes.length) return
    const before = new Map([...upserts.map(([k]) => k), ...deletes].map((k) => [k, snap.get(k)]))
    for (const [k, v] of upserts) snap.set(k, v)
    for (const k of deletes) snap.delete(k)
    for (const k of before.keys()) writing.add(k)
    try {
      // Sent as one JSON document ({key: record}) so any Postgres driver passes it the same way.
      if (upserts.length)
        await query(
          `insert into intercall_records (key, data)
           select key, value from jsonb_each($1::text::jsonb)
           on conflict (key) do update set data = excluded.data, updated_at = now()`,
          [`{${upserts.map(([k, v]) => `${JSON.stringify(k)}:${v}`).join(",")}}`]
        )
      if (deletes.length)
        await query("delete from intercall_records where key in (select jsonb_array_elements_text($1::text::jsonb))", [
          JSON.stringify(deletes),
        ])
    } catch (err) {
      // Put the snapshot back so the next flush retries these records.
      for (const [k, v] of before) {
        if (v === undefined) snap.delete(k)
        else snap.set(k, v)
      }
      console.error("[db] write failed:", (err as Error).message)
    } finally {
      for (const k of before.keys()) writing.delete(k)
    }
  }

  return { sync, flush }
}

function split(key: string): [string, string] {
  const i = key.indexOf("/")
  return [key.slice(0, i), key.slice(i + 1)]
}

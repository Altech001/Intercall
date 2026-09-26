// Copies the app's keys from .env to the linked Vercel project, since Vercel
// never reads .env files. Only keys listed in .env.example (plus DATABASE_URL)
// are sent. Usage: bun run env:vercel [production|preview|development]
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

const target = process.argv[2] ?? "production"

function parse(file: string, withComments = false) {
  const out = new Map<string, string>()
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(withComments ? /^\s*#?\s*([A-Z][A-Z0-9_]*)=(.*)$/ : /^\s*([A-Z][A-Z0-9_]*)=(.*)$/)
    if (m) out.set(m[1], m[2].trim().replace(/^(["'])(.*)\1$/, "$2"))
  }
  return out
}

const wanted = new Set([...parse(".env.example", true).keys(), "DATABASE_URL"])
const env = [...parse(".env")].filter(([k, v]) => wanted.has(k) && v)
if (!env.length) {
  console.log("No keys from .env.example are set in .env")
  process.exit(1)
}

for (const [key, value] of env) {
  spawnSync("vercel", ["env", "rm", key, target, "--yes"], { stdio: "ignore" })
  const add = spawnSync("vercel", ["env", "add", key, target], { input: value, encoding: "utf8" })
  console.log(add.status === 0 ? `✓ ${key}` : `✗ ${key}: ${(add.stderr || add.stdout).trim().split("\n").at(-1)}`)
}
console.log(`\nRedeploy for ${target} to pick these up: vercel --prod`)

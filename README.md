<div align="center">

<pre>
██╗███╗   ██╗████████╗███████╗██████╗  ██████╗ █████╗ ██╗     ██╗
██║████╗  ██║╚══██╔══╝██╔════╝██╔══██╗██╔════╝██╔══██╗██║     ██║
██║██╔██╗ ██║   ██║   █████╗  ██████╔╝██║     ███████║██║     ██║
██║██║╚██╗██║   ██║   ██╔══╝  ██╔══██╗██║     ██╔══██║██║     ██║
██║██║ ╚████║   ██║   ███████╗██║  ██║╚██████╗██║  ██║███████╗███████╗
╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝
</pre>

**A website support chatbot that remembers each customer.**

<p>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img alt="Bun" src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" />
  <img alt="CSS3" src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" />
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
</p>

<p>
  <img alt="Sui" src="https://img.shields.io/badge/Sui-4DA2FF?style=flat-square&logo=sui&logoColor=white" />
  <img alt="Walrus Memory" src="https://img.shields.io/badge/Walrus_Memory-2E2E2E?style=flat-square" />
  <img alt="Seal" src="https://img.shields.io/badge/Seal_encryption-5B4BDB?style=flat-square" />
  <img alt="NVIDIA NIM" src="https://img.shields.io/badge/NVIDIA_NIM-76B900?style=flat-square&logo=nvidia&logoColor=white" />
  <img alt="ElevenLabs" src="https://img.shields.io/badge/ElevenLabs-000000?style=flat-square&logo=elevenlabs&logoColor=white" />
  <img alt="shadcn/ui" src="https://img.shields.io/badge/shadcn%2Fui-000000?style=flat-square&logo=shadcnui&logoColor=white" />
  <img alt="Neon" src="https://img.shields.io/badge/Neon_Postgres-00E599?style=flat-square&logo=postgresql&logoColor=black" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
</p>

</div>

---

InterCall answers website visitors with an NVIDIA NIM model of your choice. It stores facts
about each customer Seal-encrypted on Walrus through Walrus Memory, and turns every chat
into a ticket your team can take over from the dashboard.

## Contents

- [Requirements](#requirements)
- [Clone and install](#clone-and-install)
- [Configure](#configure)
- [Run](#run)
- [Deploy to Vercel](#deploy-to-vercel)
- [Use it](#use-it)
- [Embed on another site](#embed-on-another-site)
- [How memory works](#how-memory-works)
- [Models](#models)
- [Project layout](#project-layout)
- [Scripts](#scripts)

## Requirements

- [Bun](https://bun.sh) 1.x (package manager, dev server runtime and production server)
- Git
- Optional keys: NVIDIA NIM, Walrus Memory, ElevenLabs. The app runs without any of them
  (see [Configure](#configure)).

Install Bun if you don't have it:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Clone and install

```bash
git clone https://github.com/Altech001/Intercall.git
cd Intercall
bun install
```

## Configure

Copy the example environment file and fill in the keys you have:

```bash
cp .env.example .env
```

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | On Vercel | Neon Postgres connection string. Leave empty locally to use the JSON file in `data/`. |
| `NVIDIA_API_KEY` | No | NVIDIA NIM key from [build.nvidia.com](https://build.nvidia.com). Without it the widget still creates tickets and a human can reply. |
| `NVIDIA_BASE_URL` | No | Defaults to `https://integrate.api.nvidia.com/v1`. |
| `NVIDIA_MODEL` | No | Fallback model. Defaults to `nvidia/nemotron-3-super-120b-a12b`. |
| `MEMWAL_PRIVATE_KEY` | No | Walrus Memory delegate key from [memory.walrus.xyz](https://memory.walrus.xyz). Leave empty to use a local in-process mock. |
| `MEMWAL_ACCOUNT_ID` | No | Walrus Memory account id. |
| `MEMWAL_SERVER_URL` | No | Defaults to `https://relayer.memory.walrus.xyz`. |
| `SUI_NETWORK` | No | Network used to verify wallet sign-ins (`testnet` or `mainnet`). |
| `VITE_SUI_NETWORK` | No | Network shown in the wallet button. Keep it the same as `SUI_NETWORK`. |
| `VITE_WALRUS_NETWORK` | No | Walruscan network for memory blob links (`mainnet` or `testnet`). |
| `ELEVENLABS_API_KEY` | No | Turns on voice mode. Leave empty to hide it. |
| `ELEVENLABS_VOICE_ID`, `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_STT_MODEL` | No | Voice, text-to-speech and speech-to-text overrides. |
| `PORT` | No | Production server port. Defaults to `8787`. |
| `INTERCALL_DATA` | No | Path to the JSON data file. Defaults to `data/intercall.json`. |

## Run

**Development** (app and API together, with hot reload):

```bash
bun run dev
```

Open http://localhost:5173.

**Production** (one server for the app and the API):

```bash
bun run build
bun run start
```

Open http://localhost:8787, or the port you set in `PORT`.

## Deploy to Vercel

Vercel serves the built frontend, and `api/index.ts` runs the API as a serverless
function. Serverless instances don't share memory or disk, so data lives in
[Neon](https://neon.tech) Postgres.

1. Create the database: in the Vercel dashboard, open your project, then
   **Storage → Create Database → Neon**. This sets `DATABASE_URL` on the project.
   The table is created on the first request.
2. Push your keys from `.env` (Vercel never reads `.env` files):

   ```bash
   bun run env:vercel            # production; pass preview or development for others
   ```

   Only keys listed in `.env.example` are sent.
3. Deploy:

   ```bash
   vercel --prod
   ```

To use the same database locally, add `DATABASE_URL` to `.env`. If the database is
empty, the first request uploads your existing `data/intercall.json`.

On Vercel, conversations that go quiet are only summarized when the ticket is resolved,
because the 90-second idle timer doesn't survive between serverless requests.

## Use it

| Route | What's there |
| --- | --- |
| `/` | Landing page with the live chat widget in the bottom right |
| `/dashboard` | Operator assistant, live tickets and customer memory |
| `/embed` | The widget on its own (loaded by `public/widget.js`) |

1. Open `/` and send a message in the widget. That creates a ticket.
2. Open `/dashboard` to see the ticket, reply as a human, or let the bot answer.
3. Tell the bot something about yourself (a name or a preference), then open a new chat.
   It recalls that fact, and the dashboard shows the stored memory with its Walrus blob id.
4. Connect a Sui wallet in the widget and sign once to carry your tickets and memory
   across devices.

> [!WARNING]
> The dashboard API has no login yet. Put it behind auth before you expose it publicly.

## Embed on another site

Add one script tag to any page:

```html
<script src="https://YOUR-INTERCALL-HOST/widget.js" async></script>
```

## How memory works

1. A visitor writes in the widget. The server recalls the Walrus memories relevant to the
   message plus the customer's core profile (name, preferences). Each customer has their own namespace.
2. The selected NIM model answers with those memories and your knowledge base in context.
3. The customer's message is sent to `memwal.analyze()`, which extracts durable facts.
   The relayer Seal-encrypts each fact and uploads it to Walrus. The dashboard shows
   each fact with its blob id.
4. If the visitor connects a Sui wallet and signs once, their guest tickets and memories
   move to a `wallet:<address>` namespace. Memory then follows them across devices, and
   their tickets are marked priority.

## Models

Choose the model from the picker in any dashboard composer or on **Bot & embed**. It lists
the live NIM catalogue, can **Test** any model against your key, and accepts any model id
you paste. NVIDIA retires models and restricts some per account, so test before switching.

If none is selected, `NVIDIA_MODEL` is used, then `nvidia/nemotron-3-super-120b-a12b`
(about 2s to first word). Slow reasoning models are cut off after 45s without output and
answered by that fallback instead.

## Project layout

```
server/
  api.ts            routes (chat SSE, tickets, wallet sign-in, models, settings)
  ai.ts             NVIDIA NIM client (OpenAI-compatible), streaming, model tests
  memory.ts         Walrus Memory recall/analyze (local mock when keys are absent)
  db.ts             data store: JSON file in data/, or Postgres when DATABASE_URL is set
  voice.ts          ElevenLabs text-to-speech and speech-to-text
  prod.ts           production server (bun run start)
  store.ts          Postgres persistence (used when DATABASE_URL is set)
api/
  index.ts          Vercel serverless entry for /api/*
src/
  pages/            landing page and dashboard
  components/       UI, including chat-widget.tsx (the widget)
public/
  widget.js         embeddable loader script
```

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the dev server with the API |
| `bun run build` | Type-check and build to `dist/` |
| `bun run start` | Serve the built app and API |
| `bun run env:vercel` | Copy the keys from `.env` to the linked Vercel project |
| `bun run preview` | Preview the built frontend only |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | Run the TypeScript compiler without emitting |
| `bun run format` | Format `.ts`/`.tsx` files with Prettier |

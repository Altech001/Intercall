# InterCall

A website support chatbot that remembers each customer. Conversations are
answered by an NVIDIA NIM model of your choice, facts about the customer are
stored Seal-encrypted on Walrus via Walrus Memory, and every chat becomes a
ticket your team can take over from the dashboard.

## Run it

```bash
cp .env.example .env   # add NVIDIA_API_KEY and your Walrus Memory keys
bun install
bun run dev            # app + API on http://localhost:5173
```

- `/`: landing page with the live widget (bottom right)
- `/dashboard`: operator assistant, live tickets, customer memory
- `/embed`: the widget on its own (loaded by `public/widget.js`)

Production: `bun run build && bun run start` serves the app and API on one port (`PORT`, default 8787).

## Embed on another site

```html
<script src="https://YOUR-INTERCALL-HOST/widget.js" async></script>
```

## How memory works

1. A visitor writes in the widget. The server recalls the Walrus memories relevant to the
   message plus the customer's core profile (name, preferences), one namespace per customer.
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
If none is selected, `NVIDIA_MODEL` is used, then `nvidia/nemotron-3-super-120b-a12b` (about 2s to first word). Slow reasoning models are cut off after 45s without output and answered by that fallback instead.

## Layout

- `server/api.ts`: routes (chat SSE, tickets, wallet sign-in, models, settings)
- `server/ai.ts`: NVIDIA NIM client (OpenAI-compatible), streaming, model tests
- `server/memory.ts`: Walrus Memory recall/analyze (local mock when keys are absent)
- `server/db.ts`: JSON file store in `data/` (tickets, customers, memory index)
- `src/pages/`: landing and dashboard; `src/components/chat-widget.tsx`: the widget

The dashboard API has no login yet. Put it behind auth before exposing it publicly.

# Due Process

**Your tasks have retained counsel.**

A funny, usable productivity app built for the Terrible Ideas Hackathon. Neglected tasks take you to the Court of Extremely Small Claims, presided over by the deeply unimpressed Judge P. Geon.

File a task, plead your excuse, receive a tiny practical sentence, and serve a focus session. Objections actually change the work. A small start becomes evidence; finishing the task earns a certificate.

## What works

- Account-owned, durable task docket with due dates, notes, daily or weekly recurrence, and a paged archive that never hides active tasks.
- Tailored judge dialogue and first steps using **only `claude-haiku-5-5`**, explicitly at **low effort**.
- Useful crafted verdicts during outages and in the isolated, zero-cost demo court.
- Editable first steps and 2, 5, 10, 15 or 25-minute focus sessions; refresh, pause and resume preserve elapsed time.
- Distinct progress and completion outcomes, hearing history, printable certificates, and an awaiting-evidence queue.
- Optional spoken rulings, responsive layouts, keyboard controls and reduced-motion support.
- Browser agent tools to read the docket, file a case and open a hearing.

See [DEMO.md](./DEMO.md) for a 90-second presentation.

## Run locally

Requires Node 22.13+ and npm.

```sh
npm ci
cp .env.example .dev.vars
# Add your own ANTHROPIC_API_KEY to .dev.vars, or set AI_ENABLED=false.
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_skinny_mordo.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_daffy_wild_child.sql
npm run dev
```

Use the local URL printed by the server. Sign in through the app to use the simulated local account. This mock identity is loopback-only and excluded from production; hosted identity comes from Sites' ChatGPT sign-in.

## AI cost controls

The server fixes the model, effort, a 1,200-token output ceiling, a 6,000-byte request bound and one request per hearing action. There are no automatic retries, alternate models, tools, prompt caches or growing chat histories.

Before every request, an atomic D1 ledger reserves **one US cent**, conservatively above the published maximum cost for this bounded request. Failed calls retain their reservation. The hosted ledger allows at most **$199** of reservations; local testing is limited to **$1**, together within the requested **$200** envelope. At exhaustion or a rate limit, the judge uses a crafted verdict. Each user may make at most ten reserved requests per minute.

Actual token usage is logged separately without task text. The initial live test used 725 input tokens and 123 output tokens, estimated at **$0.000134**, and reserved $0.01. These application limits cover this local instance and its hosted instance. They do not govern use of the same key by other applications or additional deployments, so do not reuse the funded key elsewhere.

Only task titles and optional defenses are sent to Anthropic. Private case notes are not sent. The browser never receives the API credential. Configure hosted `ANTHROPIC_API_KEY` as a secret, `AI_BUDGET_CENTS=19900`, and `AI_ENABLED=true`.

## Verification

```sh
npm test
npm run typecheck
npm run check:secrets
# With the local server and migrations ready:
npm run test:api
# Optional: exactly one paid hearing inside the local allowance:
COURT_LIVE_AI_TEST=1 npm run test:api
```

Engine tests cover timer arithmetic, refresh reconstruction, calendar recurrence, state transitions and the fixed AI contract. Integration checks cover identity spoofing, ownership, idempotent filing, concurrent resolution, origin checks and durable session state. Browser checks cover the actual demo journey and mobile/desktop layouts.

## Architecture

React 19 and Vinext on Cloudflare Workers. D1 stores account-owned case files with version checks for concurrent updates. Recurring resolution creates the next occurrence in the same database transaction. Calendar recurrence preserves the original cadence and advances to the first future occurrence; a task without a date uses the completion day as its anchor.

The generated source and platform build helpers live together in this repository. `.openai/hosting.json` describes logical platform bindings and the Site identity; `.dev.vars`, `.env` files, generated databases, dependencies and build output are ignored. Run the secret check before pushing.

This is not a real court. It is a real start.

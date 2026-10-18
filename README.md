# LabelLens

Plain-language, evidence-aware explanations of product labels. Photograph packaging, check the text that was read, and get an explanation that keeps label facts, interpretation, source-checked statements and unverified items visibly apart.

## Run it

Requires Node 22.18+ (runs the TypeScript server directly; `.node-version` pins 24).

```bash
npm install
cp .env.example .env        # then add your AI_API_KEY
npm run dev                 # app + API on http://localhost:5173
```

Production:

```bash
npm run build
npm start                   # serves dist/ and the API on http://localhost:8787
```

Checks: `npm run typecheck` and `npm test` (server validation and safety rules).

## Deploy

### GitHub Pages (free, password protected)

`.github/workflows/pages.yml` builds a static version on every push to `main` and publishes it to `https://<user>.github.io/labellens/`. There's no server: the label pipeline runs in the visitor's browser and calls the AI provider directly.

The AI key is never in the repository or in plain form on the site. The workflow reads two repository secrets and encrypts the key with the password (AES-256-GCM, PBKDF2-SHA256 with 600,000 iterations) into `vault.json`. Visitors must enter the password to unlock it in their browser.

1. Repository **Settings → Secrets and variables → Actions → New repository secret**:
   - `AI_API_KEY`: your Anthropic, OpenAI, Gemini or OpenRouter key.
   - `APP_PASSWORD`: at least 12 characters; a few random words works well.
   - Optional **variables** `AI_PROVIDER` and `AI_MODEL`.
2. **Actions → Deploy to GitHub Pages → Run workflow**, or push to `main`.

Anyone with the password can, with effort, recover the key from their browser. Share the password only with people you trust, and give the key a spending limit. To change the key or password, update the secret and re-run the workflow; everyone has to unlock again.

Browser support by provider: Anthropic, Gemini and OpenRouter work from the browser. OpenAI's API accepts browser requests, but its error replies don't include CORS headers, so a bad OpenAI key shows up as "Couldn't reach the AI service".

### Render (server)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ellomehllo/labellens)

`render.yaml` defines a free Node web service: `npm ci && npm run build`, then `npm start`, health check on `/api/status`, redeploy on every push to `main`. Render asks for `AI_API_KEY` when you create it. The daily AI-call cap is set to 100.

Free instances sleep after 15 minutes without traffic and take about a minute to wake. The feedback file lives on the instance's temporary disk and is cleared on each deploy.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_API_KEY` | yes | Key for any supported provider. Read only by the server. |
| `AI_PROVIDER` | no | `anthropic`, `openai`, `gemini` or `openrouter`. Only needed if the key's format isn't recognised. |
| `AI_MODEL` | no | Overrides the provider's default model (below). |
| `AI_BASE_URL` | no | Points the OpenAI adapter at another OpenAI-compatible endpoint. |
| `PORT` | no | Production server port, default 8787. |
| `LABELLENS_DAILY_LIMIT` | no | Max AI calls per day across all users, default 300. |
| `LABELLENS_FEEDBACK` | no | `off` stops writing reports to `data/feedback.jsonl`. |

Provider-specific names (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) also work. Without a key the app runs and shows a clear "analysis isn't switched on" state.

## AI providers

The provider is detected from the key, and each adapter lives in `core/ai/`:

| Provider | Key looks like | Default model | Adapter |
| --- | --- | --- | --- |
| Anthropic | `sk-ant-…` | `claude-opus-5-5` | Official SDK, structured outputs, prompt caching |
| OpenAI | `sk-…` / `sk-proj-…` | `gpt-6-astra` | Chat Completions, strict JSON schema |
| Google Gemini | `AIza…` | `gemini-3.8-flash` | `generateContent`, JSON schema |
| OpenRouter | `sk-or-…` | `anthropic/claude-opus-5.5` | Chat Completions, routed only to schema-enforcing endpoints |

Any model you choose needs image input and JSON-schema output. The same prompts, source registry and server-side validation apply whichever provider answers.

## How it works

Code layout: `core/` is the pipeline shared by the server and the browser (prompts, sources, AI adapters, validation, vault), `server/` is the Node API, `src/` is the React app.

0. **Intro** (`src/screens/Intro.tsx`): first visit only. Mochi, the capybara guide, says hello; Settings → "Say hi again" replays it.
1. **Scanner** (`src/screens/Capture.tsx`): dark camera screen that starts the camera straight away, with Photos, History and "Try a sample label". Up to 4 photos. The browser orients, downsizes and re-encodes them as JPEG and runs quick blur/darkness/glare hints.
2. **Read** (`POST /api/extract`): the AI model transcribes only visible text into typed sections, marks unreadable characters with `[?]`, and guesses category and market. Images stay in memory for that request only.
3. **Quick check** (`src/screens/Review.tsx`): photo card, product type, counts and photo quality (Clear / Partly clear / Hard to read, never an invented percentage), and "What Mochi read" with Fix text for correcting ingredients, amounts, warnings and dates. Typed text and the clearly labelled sample use the same screen.
4. **Explain** (`POST /api/analyze`): text only. The model returns structured findings and may cite only `source_id`/`point_id` pairs from the curated registry (`core/sources.ts`); it can't supply URLs.
5. **Validate** (`core/analysis.ts`): references are resolved against the registry and unknown ones are dropped. A "verified" finding with no resolvable source is downgraded to "Not verified". Sentences stating absolute safety verdicts are removed and the removal is disclosed. A jurisdiction caveat is added when a source's country differs from the selected market.
6. **Your label** (`src/screens/Results.tsx`): a headline and label-based chips, then Summary (care cards, Ask Mochi questions answered in the same pass, other findings with type badges), Ingredients (label order, amount, role tag, what it does, full label text) and Sources (what was source-checked, read clarity, sources with dates, what couldn't be verified, limits). Poison-help guidance appears for cleaners and label first-aid warnings.

Progress steps are streamed as each stage actually starts. Scan history is on by default, kept only in this browser tab for the session (text, never photos), and can be turned off or cleared in Settings.

## Curated sources

`core/sources.ts` holds 14 pages from the FDA, CDC, Health Canada, the European Commission, WHO and the ADA. Each point paraphrases a statement read on that page on the `checked` date. To add a source, open the page, write points that say only what the page says, and set `checked`. Coverage is intentionally narrow (mostly US, EU and Canada), so many claims will correctly show as "Not verified".

## Known limits

- Rate limits and the daily cap are in-memory: fine for one server process, not for several.
- Market coverage beyond the US, EU and Canada is thin; India, UK and Australia have no dedicated sources yet.
- Image quality hints are heuristics; the extraction step's own readability rating is the authority.
- Not a certified product-safety or regulatory tool.

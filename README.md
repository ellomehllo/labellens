# LabelLens

Plain-language, evidence-aware explanations of product labels. Photograph packaging, check the text that was read, and get an explanation that keeps label facts, interpretation, source-checked statements and unverified items visibly apart.

## Run it

Requires Node 22.18+ (runs the TypeScript server directly).

```bash
npm install
cp .env.example .env        # then add your ANTHROPIC_API_KEY
npm run dev                 # app + API on http://localhost:5173
```

Production:

```bash
npm run build
npm start                   # serves dist/ and the API on http://localhost:8787
```

Checks: `npm run typecheck` and `npm test` (server validation and safety rules).

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Claude API key. Read only by the server. |
| `LABELLENS_MODEL` | no | Defaults to `claude-opus-5-5`. |
| `PORT` | no | Production server port, default 8787. |
| `LABELLENS_DAILY_LIMIT` | no | Max AI calls per day across all users, default 300. |
| `LABELLENS_FEEDBACK` | no | `off` stops writing reports to `data/feedback.jsonl`. |

Without a key the app runs and shows a clear "analysis isn't switched on" state.

## How it works

1. **Capture** (`src/screens/Capture.tsx`): camera or upload, up to 4 photos. The browser orients, downsizes and re-encodes them as JPEG and runs quick blur/darkness/glare hints.
2. **Read** (`POST /api/extract`): Claude transcribes only visible text into typed sections, marks unreadable characters with `[?]`, and guesses category and market. Images stay in memory for that request only.
3. **Review** (`src/screens/Review.tsx`): the user corrects critical fields (ingredients, allergens, amounts, directions, warnings, dates) and confirms category and market. Typed text and a clearly labelled example label use the same screen.
4. **Explain** (`POST /api/analyze`): text only. Claude returns structured findings and may cite only `source_id`/`point_id` pairs from the curated registry (`server/sources.ts`); it can't supply URLs.
5. **Validate** (`server/validate.ts`): references are resolved against the registry and unknown ones are dropped. A "verified" finding with no resolvable source is downgraded to "Not verified". Sentences stating absolute safety verdicts are removed and the removal is disclosed. A jurisdiction caveat is added when a source's country differs from the selected market.
6. **Results** (`src/screens/Results.tsx`): summary, label facts, precautions, ingredients grouped by purpose, source-checked and unverified findings, limits, and a correction loop. Poison-help guidance appears for cleaners and label first-aid warnings.

Progress steps are streamed from the server as each stage actually starts. History is opt-in and stored only in the browser (text, never photos).

## Curated sources

`server/sources.ts` holds 14 pages from the FDA, CDC, Health Canada, the European Commission, WHO and the ADA. Each point paraphrases a statement read on that page on the `checked` date. To add a source, open the page, write points that say only what the page says, and set `checked`. Coverage is intentionally narrow (mostly US, EU and Canada), so many claims will correctly show as "Not verified".

## Known limits

- Rate limits and the daily cap are in-memory: fine for one server process, not for several.
- Market coverage beyond the US, EU and Canada is thin; India, UK and Australia have no dedicated sources yet.
- Image quality hints are heuristics; the extraction step's own readability rating is the authority.
- Not a certified product-safety or regulatory tool.

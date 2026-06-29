# VLM Arcade

A catalog of 5 live-webcam vision games, built as a **Vite + React** app and
deployable to **Cloudflare Pages by drag-and-drop**. Each game uses your camera
as the controller and asks an **NVIDIA NIM** vision-language model what it sees.

| Game | What you do |
| --- | --- |
| Webcam Charades | Hold up the secret object; make the AI name it |
| Scavenger Speedrun | Grab whatever it asks for, beat the clock |
| Draw the Owl | Doodle the target, survive a snobby art critic |
| Reality Caption Battle | Two players, two rooms — whose scene is more poetic |
| The Appraiser | Show any object, get a deadpan fictional valuation |

## Architecture

The browser **never** holds the API key and never calls NVIDIA directly
(CORS + key exposure). The built `dist/` folder includes a Cloudflare Pages
**advanced-mode Worker** (`_worker.js`) that serves the app *and* the backend:

```
React app ──POST /api/infer──▶  dist/_worker.js  ──▶  NVIDIA NIM
                                (holds NVIDIA_API_KEY)   integrate.api.nvidia.com
```

`_worker.js` lives in `public/`, so `vite build` copies it to the root of
`dist/` automatically — the folder you upload is self-contained.

## Deploy — drag and drop (no CLI, no Git)

1. `npm install && npm run build` → produces the `dist/` folder.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Upload assets**.
3. **Drag the entire `dist/` folder** onto the uploader, name the project, Deploy.
4. Open the new project → **Settings → Variables and Secrets** → add a secret
   named **`NVIDIA_API_KEY`** with your `nvapi-...` key → **Save**.
5. Re-deploy (or upload `dist/` again) so the Worker picks up the secret. Done.

> The `dist/_worker.js` is detected automatically — there is no build config to
> set in the dashboard for the drag-and-drop (Direct Upload) flow.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # add your NVIDIA key
npm run build
npm run cf:dev                   # wrangler pages dev dist → serves app + /api/infer
```

Open the printed URL and allow camera access. (`npm run dev` serves the UI only;
`/api/infer` exists only under `wrangler pages dev`.)

> Camera APIs need a secure context — `localhost` and the deployed HTTPS URL
> both qualify.

## Optional — CLI deploy instead of drag-and-drop

```bash
npm run deploy                                  # build + wrangler pages deploy dist
wrangler pages secret put NVIDIA_API_KEY        # paste your nvapi-... key
```

## Notes

- **NIM model ids change.** Confirm exact ids at [build.nvidia.com](https://build.nvidia.com).
  A wrong id returns a 404, which the UI shows verbatim.
- All AI guesses, captions, and appraisals are generated **for play** — not
  authoritative facts. Appraisals and provenance are fictional entertainment.
- No `localStorage`/`sessionStorage` is used; scores are in-memory per session.

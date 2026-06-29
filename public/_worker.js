/* =========================================================================
   Cloudflare Pages — advanced-mode single Worker (_worker.js).

   Vite copies this file from /public to the root of the build output (dist/),
   so the dist/ folder you DRAG AND DROP into Cloudflare Pages already contains
   the backend. Pages runs this Worker for every request:
     - POST /api/infer  → forwards to NVIDIA NIM using the server-side
                          NVIDIA_API_KEY secret (never shipped to the browser).
     - everything else  → served as a static asset via env.ASSETS.

   The ONLY thing to configure after the drag-and-drop upload:
     Cloudflare dashboard → your Pages project → Settings →
       Variables and Secrets → add  NVIDIA_API_KEY  (your nvapi-... key).

   NIM model ids change — confirm exact ids at build.nvidia.com. A wrong id
   returns a 404 that the UI shows verbatim.
   ========================================================================= */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const trunc = (v) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return (s || "").slice(0, 300);
};

async function handleInfer(request, env) {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!env.NVIDIA_API_KEY) {
    return json({ error: "Server is missing the NVIDIA_API_KEY secret. Add it in Pages → Settings → Variables and Secrets." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON request body." }, 400);
  }
  const { model, imageDataUrl, prompt } = body || {};
  if (!model) return json({ error: "Missing model." }, 400);
  if (!prompt) return json({ error: "Missing prompt." }, 400);

  // OpenAI-compatible NIM shape.
  const content = [{ type: "text", text: prompt }];
  if (imageDataUrl) content.push({ type: "image_url", image_url: { url: imageDataUrl } });

  try {
    const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        max_tokens: 256,
      }),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) return json({ error: `NIM ${r.status}: ${trunc(data)}` }, r.status);
    return json({ text: data?.choices?.[0]?.message?.content ?? "" });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/infer") return handleInfer(request, env);
    return env.ASSETS.fetch(request);
  },
};

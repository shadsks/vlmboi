import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Gamepad2,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Search,
  Pencil,
  Swords,
  Gavel,
  Loader2,
  AlertTriangle,
  Trophy,
  Zap,
  Eraser,
  Camera,
  ChevronRight,
  Cpu,
  ShieldCheck,
  ScanLine,
  Radio,
  Play,
} from "lucide-react";

/* =========================================================================
   VLM ARCADE — Neon Editorial Cabinet.

   INFERENCE ARCHITECTURE (unchanged):
   The browser never talks to NVIDIA directly. Every game calls the same-origin
   /api/infer endpoint served by the Pages Worker (public/_worker.js), which
   holds NVIDIA_API_KEY and forwards to NVIDIA NIM (OpenAI-compatible) using
   each game's model id. No key is ever shipped to the browser.

   DESIGN SYSTEM (this revamp):
   - Theme: dark-only, locked (arcade identity). Off-black base, never #000.
   - Accent: each game is an arcade "cabinet" with ONE neon hue. That hue is
     bound to a CSS var (--accent) on the card/screen and used consistently
     for glow, reticle, primary button, win states. Shared chrome is neutral
     chalk/ash with one brand accent (acid lime) for the wordmark + marquee.
   - Shape lock: pill buttons, 28px cards, 20px media, 12px chips.
   - Type: Space Grotesk (self-hosted). Motion: CSS + IntersectionObserver,
     reduced-motion safe.
   ========================================================================= */

/* ----------------------------- inference --------------------------------- */
// One abstraction shared by every game. Routes through the same-origin Worker
// so the NVIDIA key stays server-side.
async function infer({ model, imageDataUrl, prompt, wantJSON }) {
  const res = await fetch("/api/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, imageDataUrl, prompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  const text = data.text || "";

  if (wantJSON) {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const candidate = (cleaned.match(/\{[\s\S]*\}/) || [cleaned])[0];
    try {
      return JSON.parse(candidate);
    } catch {
      throw new Error("Model did not return valid JSON: " + text.slice(0, 160));
    }
  }
  return text;
}

/* --------------------------- webcam + capture ---------------------------- */
function useWebcam() {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        setError("Camera unavailable: " + (e?.message || e));
      }
    })();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, error, ready };
}

// Downscale to max 512px long edge, JPEG q~0.6.
function captureFrame(video) {
  if (!video || !video.videoWidth) return null;
  const MAX = 512;
  const w = video.videoWidth;
  const h = video.videoHeight;
  const scale = Math.min(1, MAX / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", 0.6);
}

/* --------------------------- reveal + spotlight -------------------------- */
// Reveal-on-scroll wrapper. Elements mount hidden and unmask once when they
// enter the viewport, staggered via the --reveal-delay CSS var.
function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      style={{ "--reveal-delay": `${delay}ms` }}
      className={`reveal ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// Track the cursor over a card so the spotlight border can follow it.
function trackSpotlight(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/* ------------------------------ shared UI -------------------------------- */
function PrimaryBtn({ accent, className = "", children, ...props }) {
  return (
    <button
      {...props}
      className={`group/btn inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold tracking-tight text-black transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${className}`}
      style={{
        backgroundColor: accent,
        boxShadow: `0 16px 40px -14px ${accent}cc, inset 0 1px 0 rgba(255,255,255,0.4)`,
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ className = "", children, ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-200 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.97] disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function Panel({ className = "", children, style, accent }) {
  return (
    <div
      className={`glass rounded-3xl p-5 ${className}`}
      style={
        accent
          ? { ...style, boxShadow: `inset 0 0 0 1px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.06)` }
          : style
      }
    >
      {children}
    </div>
  );
}

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 animate-pop">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
      <span className="break-words">{msg}</span>
    </div>
  );
}

function Thinking({ on, accent, label = "Looking" }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} />
      {label}
    </span>
  );
}

// Corner-bracket reticle overlaid on a live screen — pure decoration.
function Reticle({ accent }) {
  const c = "absolute h-4 w-4 border-current opacity-70";
  return (
    <div className="pointer-events-none absolute inset-3 z-[1]" style={{ color: accent }} aria-hidden="true">
      <span className={`${c} left-0 top-0 border-l-2 border-t-2 rounded-tl`} />
      <span className={`${c} right-0 top-0 border-r-2 border-t-2 rounded-tr`} />
      <span className={`${c} bottom-0 left-0 border-b-2 border-l-2 rounded-bl`} />
      <span className={`${c} bottom-0 right-0 border-b-2 border-r-2 rounded-br`} />
    </div>
  );
}

function VideoStage({ videoRef, ready, error, accent }) {
  return (
    <div
      className="crt relative aspect-video w-full overflow-hidden rounded-[20px] bg-black"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}44, 0 30px 70px -30px ${accent}55` }}
    >
      <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
      <Reticle accent={accent} />
      {!ready && !error && (
        <div className="absolute inset-0 z-[2] grid place-items-center bg-black/40">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Camera className="h-4 w-4 animate-pulse" strokeWidth={2} style={{ color: accent }} />
            Requesting camera
          </span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-[2] grid place-items-center bg-black/50 p-4">
          <ErrorBanner msg={error} />
        </div>
      )}
      {/* live dot only when the camera is actually streaming */}
      {ready && !error && (
        <div className="absolute left-3 top-3 z-[3] inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accent, animation: "pulseRing 1.8s ease-out infinite" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          </span>
          Live
        </div>
      )}
      <div className="absolute bottom-3 right-3 z-[3] inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-1 font-mono text-[9px] uppercase tracking-widest text-white/70 backdrop-blur">
        <ScanLine className="h-3 w-3" strokeWidth={2} /> NIM
      </div>
    </div>
  );
}

function WinBanner({ accent, children }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-4 font-bold animate-pop"
      style={{ backgroundColor: `${accent}1f`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}55, 0 16px 40px -18px ${accent}` }}
    >
      <Trophy className="h-5 w-5 shrink-0" strokeWidth={2.2} />
      <span>{children}</span>
    </div>
  );
}

const LABEL = "text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500";

/* ============================== GAMES ==================================== */

/* 1 — Webcam Charades --------------------------------------------------- */
const CHARADES_BANK = [
  "banana", "phone", "book", "coffee mug", "glasses", "keys", "headphones",
  "shoe", "bottle", "pen", "spoon", "hat", "remote", "plant", "watch",
];
const CHARADES_SYN = {
  "coffee mug": ["mug", "cup", "coffee"],
  glasses: ["spectacles", "eyeglasses", "sunglasses"],
  keys: ["key", "keychain"],
  headphones: ["headset", "earphones", "earbuds"],
  phone: ["cellphone", "smartphone", "mobile"],
  bottle: ["water bottle", "flask"],
  remote: ["remote control", "controller", "clicker"],
  plant: ["flower", "leaf"],
};
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function looseMatch(guess, secret) {
  const g = norm(guess);
  const s = norm(secret);
  if (!g) return false;
  if (g.includes(s) || s.includes(g)) return true;
  return (CHARADES_SYN[s] || []).some((w) => g.includes(w));
}

function Charades({ infer, accent }) {
  const { videoRef, ready, error } = useWebcam();
  const [secret] = useState(() => CHARADES_BANK[Math.floor(Math.random() * CHARADES_BANK.length)]);
  const [guess, setGuess] = useState("");
  const [history, setHistory] = useState([]);
  const [won, setWon] = useState(false);
  const [err, setErr] = useState("");
  const [thinking, setThinking] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!ready || won) return;
    const id = setInterval(async () => {
      if (busy.current) return;
      const frame = captureFrame(videoRef.current);
      if (!frame) return;
      busy.current = true;
      setThinking(true);
      setErr("");
      try {
        const text = await infer({
          model: "nvidia/nemotron-nano-12b-v2-vl",
          imageDataUrl: frame,
          prompt:
            "Look at the person on camera. In 1-3 words, name the single most prominent object they are holding up or showing. Reply with only the object name, nothing else.",
          wantJSON: false,
        });
        const g = (text || "").trim().replace(/[.\n]/g, " ").trim();
        if (g) {
          setGuess(g);
          setHistory((h) => [g, ...h].slice(0, 5));
          if (looseMatch(g, secret)) setWon(true);
        }
      } catch (e) {
        setErr(e.message);
      } finally {
        busy.current = false;
        setThinking(false);
      }
    }, 2500);
    return () => clearInterval(id);
  }, [ready, won, secret, infer]);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <VideoStage videoRef={videoRef} ready={ready} error={error} accent={accent} />
      <div className="flex flex-col gap-4">
        <Panel accent={accent}>
          <div className={LABEL}>Your secret word</div>
          <div className="mt-2 text-4xl font-black tracking-tighter">{secret}</div>
          <div className="mt-2 text-sm text-zinc-400">Hold up that object so the AI guesses it.</div>
        </Panel>
        <Panel accent={accent}>
          <div className="flex items-center justify-between">
            <div className={LABEL}>The AI's guess</div>
            <Thinking on={thinking} accent={accent} />
          </div>
          <div className="mt-2 min-h-[2.5rem] text-3xl font-black tracking-tight">
            {guess || <span className="text-zinc-700">. . .</span>}
          </div>
          {history.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {history.slice(1).map((h, i) => (
                <span key={i} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400 ring-1 ring-white/5">{h}</span>
              ))}
            </div>
          )}
          <div className="mt-3 text-[11px] text-zinc-600">AI guess, for play. Not a fact.</div>
        </Panel>
        <ErrorBanner msg={err} />
        {won && <WinBanner accent={accent}>Got it. The AI read "{secret}".</WinBanner>}
      </div>
    </div>
  );
}

/* 2 — Scavenger Speedrun ------------------------------------------------- */
const SCAV_PROMPTS = [
  "something red", "something made of metal", "something you can write with",
  "something round", "something blue", "a piece of paper", "something soft",
  "something with text on it", "something electronic", "a drinking container",
];
function pickPrompt(exclude) {
  let p;
  do { p = SCAV_PROMPTS[Math.floor(Math.random() * SCAV_PROMPTS.length)]; } while (p === exclude && SCAV_PROMPTS.length > 1);
  return p;
}

function Scavenger({ infer, accent }) {
  const { videoRef, ready, error } = useWebcam();
  const [prompt, setPrompt] = useState(() => pickPrompt());
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const check = useCallback(async () => {
    if (busy.current || !ready) return;
    const frame = captureFrame(videoRef.current);
    if (!frame) return;
    busy.current = true;
    setChecking(true);
    setErr("");
    setFeedback(null);
    try {
      const res = await infer({
        model: "nvidia/nemotron-nano-12b-v2-vl",
        imageDataUrl: frame,
        prompt:
          `Does the main object shown to the camera match: "${prompt}"? ` +
          `Respond with strict JSON only: {"match": boolean, "reason": string} where reason is one short sentence.`,
        wantJSON: true,
      });
      setFeedback(res);
      if (res?.match === true) {
        setScore((s) => s + 1);
        setPrompt((p) => pickPrompt(p));
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, [infer, prompt, ready]);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <VideoStage videoRef={videoRef} ready={ready} error={error} accent={accent} />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Panel accent={accent}>
            <div className={LABEL}>Found</div>
            <div className="mt-2 text-4xl font-black tabular-nums tnum" style={{ color: accent }}>{score}</div>
          </Panel>
          <Panel accent={accent}>
            <div className={LABEL}>Time</div>
            <div className="mt-2 text-4xl font-black tabular-nums tnum">{seconds}s</div>
          </Panel>
        </div>
        <Panel accent={accent}>
          <div className={LABEL}>Fetch me</div>
          <div className="mt-2 text-3xl font-black tracking-tight">{prompt}</div>
        </Panel>
        <PrimaryBtn accent={accent} onClick={check} disabled={!ready || checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" strokeWidth={2.6} />}
          Check it
        </PrimaryBtn>
        {feedback && (
          <div
            className="rounded-2xl p-4 animate-pop"
            style={
              feedback.match
                ? { backgroundColor: `${accent}1f`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}55` }
                : { backgroundColor: "rgba(245,158,11,0.10)", color: "#fcd34d", boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.32)" }
            }
          >
            <div className="font-bold">{feedback.match ? "Match. +1" : "Not quite"}</div>
            <div className="mt-0.5 text-sm opacity-90">{feedback.reason}</div>
          </div>
        )}
        <ErrorBanner msg={err} />
      </div>
    </div>
  );
}

/* 3 — Draw the Owl ------------------------------------------------------- */
const OWL_TARGETS = ["owl", "cat", "house", "tree", "fish", "car", "sun", "flower"];

function DrawTheOwl({ infer, accent }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const busy = useRef(false);
  const [target] = useState(() => OWL_TARGETS[Math.floor(Math.random() * OWL_TARGETS.length)]);
  const [critique, setCritique] = useState("");
  const [guess, setGuess] = useState("");
  const [won, setWon] = useState(false);
  const [err, setErr] = useState("");
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#111111";
  }, []);

  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: ((p.clientX - r.left) / r.width) * c.width, y: ((p.clientY - r.top) / r.height) * c.height };
  };
  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
  };
  const end = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    dirty.current = false;
  };

  useEffect(() => {
    if (won) return;
    const id = setInterval(async () => {
      if (busy.current || !dirty.current) return;
      busy.current = true;
      setThinking(true);
      setErr("");
      try {
        const png = canvasRef.current.toDataURL("image/png");
        const res = await infer({
          model: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
          imageDataUrl: png,
          prompt:
            "This is a crude doodle. Respond with strict JSON only: " +
            '{"guess": string, "critique": string} where guess is your single best one-word guess of what it depicts, ' +
            "and critique is ONE snobby art-teacher one-liner roasting the drawing.",
          wantJSON: true,
        });
        if (res) {
          setGuess(res.guess || "");
          setCritique(res.critique || "");
          if (looseMatch(res.guess || "", target)) setWon(true);
        }
      } catch (e) {
        setErr(e.message);
      } finally {
        busy.current = false;
        setThinking(false);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [infer, target, won]);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div
          className="crt overflow-hidden rounded-[20px]"
          style={{ boxShadow: `inset 0 0 0 1px ${accent}44, 0 30px 70px -30px ${accent}55` }}
        >
          <canvas
            ref={canvasRef}
            width={480}
            height={480}
            className="aspect-square w-full touch-none bg-white"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
        </div>
        <GhostBtn onClick={clear}>
          <Eraser className="h-4 w-4" strokeWidth={2.4} /> Clear canvas
        </GhostBtn>
      </div>
      <div className="flex flex-col gap-4">
        <Panel accent={accent}>
          <div className={LABEL}>Draw this</div>
          <div className="mt-2 text-4xl font-black capitalize tracking-tighter">{target}</div>
        </Panel>
        <Panel accent={accent}>
          <div className="flex items-center justify-between">
            <div className={LABEL}>Critic sees</div>
            <Thinking on={thinking} accent={accent} label="Judging" />
          </div>
          <div className="mt-2 text-2xl font-black capitalize">{guess || <span className="text-zinc-700">. . .</span>}</div>
          {critique && <p className="mt-2 text-sm italic leading-relaxed text-zinc-400">"{critique}"</p>}
          <div className="mt-3 text-[11px] text-zinc-600">AI opinion, for play. Not a fact.</div>
        </Panel>
        <ErrorBanner msg={err} />
        {won && <WinBanner accent={accent}>The critic recognized your {target}.</WinBanner>}
      </div>
    </div>
  );
}

/* 4 — Reality Caption Battle -------------------------------------------- */
function CaptionBattle({ infer, accent }) {
  const { videoRef, ready, error } = useWebcam();
  const [phase, setPhase] = useState("A");
  const [capA, setCapA] = useState("");
  const [capB, setCapB] = useState("");
  const [verdict, setVerdict] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const captionCurrent = async () => {
    const frame = captureFrame(videoRef.current);
    if (!frame) return null;
    return infer({
      model: "nvidia/nemotron-nano-12b-v2-vl",
      imageDataUrl: frame,
      prompt: "Caption this scene in one vivid, lyrical sentence.",
      wantJSON: false,
    });
  };

  const captureA = async () => {
    setBusy(true); setErr("");
    try {
      const c = (await captionCurrent())?.trim();
      if (c) { setCapA(c); setPhase("B"); }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const captureB = async () => {
    setBusy(true); setErr("");
    try {
      const c = (await captionCurrent())?.trim();
      if (!c) return;
      setCapB(c);
      const v = await infer({
        model: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
        imageDataUrl: null, // judge is text-only
        prompt:
          `Two captions describe two scenes.\nA: "${capA}"\nB: "${c}"\n` +
          "Which is more lyrical? Respond with strict JSON only: " +
          '{"scoreA": number 0-10, "scoreB": number 0-10, "winner": "A" or "B", "line": string} ' +
          "where line celebrates the winning caption in one sentence.",
        wantJSON: true,
      });
      setVerdict(v);
      setPhase("result");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <VideoStage videoRef={videoRef} ready={ready} error={error} accent={accent} />
      <div className="flex flex-col gap-4">
        <Panel accent={accent}>
          <div className={LABEL}>Turn</div>
          <div className="mt-2 text-2xl font-black tracking-tight">
            {phase === "A" && "Player A, show your space"}
            {phase === "B" && "Player B, show your space"}
            {phase === "result" && "Results"}
          </div>
        </Panel>

        {phase === "A" && (
          <PrimaryBtn accent={accent} onClick={captureA} disabled={!ready || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" strokeWidth={2.4} />}
            Capture Player A
          </PrimaryBtn>
        )}
        {phase === "B" && (
          <PrimaryBtn accent={accent} onClick={captureB} disabled={!ready || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" strokeWidth={2.4} />}
            Capture Player B and judge
          </PrimaryBtn>
        )}

        {capA && (
          <Panel accent={accent}>
            <div className={LABEL}>A {verdict ? `· ${verdict.scoreA}/10` : ""}</div>
            <p className="mt-2 text-sm italic leading-relaxed text-zinc-100">"{capA}"</p>
          </Panel>
        )}
        {capB && (
          <Panel accent={accent}>
            <div className={LABEL}>B {verdict ? `· ${verdict.scoreB}/10` : ""}</div>
            <p className="mt-2 text-sm italic leading-relaxed text-zinc-100">"{capB}"</p>
          </Panel>
        )}

        {verdict && (
          <div
            className="rounded-2xl p-5 animate-pop"
            style={{ backgroundColor: `${accent}1f`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}55, 0 16px 40px -18px ${accent}` }}
          >
            <div className="flex items-center gap-2 text-xl font-black">
              <Trophy className="h-5 w-5" strokeWidth={2.2} /> Winner: Player {verdict.winner}
            </div>
            <p className="mt-1 text-sm opacity-90">{verdict.line}</p>
          </div>
        )}
        <ErrorBanner msg={err} />
      </div>
    </div>
  );
}

/* 5 — The Appraiser ------------------------------------------------------ */
function Appraiser({ infer, accent }) {
  const { videoRef, ready, error } = useWebcam();
  const [result, setResult] = useState(null);
  const [bank, setBank] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const appraise = async () => {
    if (!ready || busy) return;
    const frame = captureFrame(videoRef.current);
    if (!frame) return;
    setBusy(true); setErr(""); setResult(null);
    try {
      const res = await infer({
        model: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
        imageDataUrl: frame,
        prompt:
          "You are a deadpan auction-house appraiser. Examine the object shown. " +
          "Respond with strict JSON only: " +
          '{"appraisal": string, "provenance": string, "valueUSD": number}. ' +
          "Invent a grand, fictional provenance. valueUSD is a plain number.",
        wantJSON: true,
      });
      setResult(res);
      const v = Number(res?.valueUSD) || 0;
      setBank((b) => b + v);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <VideoStage videoRef={videoRef} ready={ready} error={error} accent={accent} />
      <div className="flex flex-col gap-4">
        <Panel accent={accent}>
          <div className={LABEL}>Banked total</div>
          <div className="mt-2 text-4xl font-black tabular-nums tnum" style={{ color: accent }}>
            ${bank.toLocaleString()}
          </div>
        </Panel>
        <PrimaryBtn accent={accent} onClick={appraise} disabled={!ready || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" strokeWidth={2.4} />}
          Appraise this item
        </PrimaryBtn>
        {result && (
          <Panel accent={accent} className="animate-pop">
            <p className="text-sm leading-relaxed text-zinc-100">{result.appraisal}</p>
            <p className="mt-3 text-xs text-zinc-400">
              <span className="text-zinc-500">Provenance —</span> {result.provenance}
            </p>
            <div className="mt-3 text-4xl font-black tabular-nums tnum" style={{ color: accent }}>
              ${(Number(result.valueUSD) || 0).toLocaleString()}
            </div>
          </Panel>
        )}
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] leading-relaxed text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>Appraisals and provenance are fictional entertainment generated by an AI. Not real valuations.</span>
        </div>
        <ErrorBanner msg={err} />
      </div>
    </div>
  );
}

/* ----------------------------- game catalog ------------------------------ */
// Single extensible array. Each game owns ONE neon hue (its arcade cabinet)
// and a bento `span` so the lobby reads as an asymmetric grid, not a 3-up.
const GAMES = [
  {
    id: "charades",
    idx: "01",
    title: "Webcam Charades",
    hook: "Hold up the secret object and make the AI name it.",
    tag: "Continuous · auto",
    badge: "nemotron-nano-12b-v2-vl",
    icon: Sparkles,
    color: "#ff6b8b",
    span: "sm:col-span-2 lg:col-span-4 lg:row-span-2",
    feature: true,
    Component: Charades,
  },
  {
    id: "scavenger",
    idx: "02",
    title: "Scavenger Speedrun",
    hook: "Grab whatever it asks for. Beat the clock.",
    tag: "Timed",
    badge: "nemotron-nano-12b-v2-vl",
    icon: Search,
    color: "#2dd4bf",
    span: "lg:col-span-2",
    Component: Scavenger,
  },
  {
    id: "owl",
    idx: "03",
    title: "Draw the Owl",
    hook: "Doodle the target. Survive a snobby art critic.",
    tag: "Canvas",
    badge: "nemotron-nano-vl-8b-v1",
    icon: Pencil,
    color: "#c4f24a",
    span: "lg:col-span-2",
    Component: DrawTheOwl,
  },
  {
    id: "caption",
    idx: "04",
    title: "Reality Caption Battle",
    hook: "Two players, two rooms. Whose scene reads more poetic?",
    tag: "Versus",
    badge: "nano-12b-v2-vl + nano-vl-8b-v1",
    icon: Swords,
    color: "#ff9d4d",
    span: "lg:col-span-3",
    Component: CaptionBattle,
  },
  {
    id: "appraiser",
    idx: "05",
    title: "The Appraiser",
    hook: "Show any object. Get a deadpan, fictional fortune.",
    tag: "Solo",
    badge: "nemotron-nano-vl-8b-v1",
    icon: Gavel,
    color: "#f5c451",
    span: "lg:col-span-3",
    Component: Appraiser,
  },
];

/* ------------------------- decorative background ------------------------- */
function Backdrop() {
  // Drifting blobs in the five game hues, behind content, non-interactive,
  // frozen under prefers-reduced-motion (handled in CSS).
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="aurora-blob h-[44vmax] w-[44vmax]" style={{ top: "-14vmax", left: "-10vmax", background: "#ff6b8b", animationDelay: "0s" }} />
      <div className="aurora-blob h-[36vmax] w-[36vmax]" style={{ top: "8vmax", right: "-12vmax", background: "#2dd4bf", animationDelay: "-6s" }} />
      <div className="aurora-blob h-[30vmax] w-[30vmax]" style={{ bottom: "-12vmax", left: "18vmax", background: "#c4f24a", animationDelay: "-11s", opacity: 0.32 }} />
      <div className="aurora-blob h-[28vmax] w-[28vmax]" style={{ bottom: "-10vmax", right: "6vmax", background: "#ff9d4d", animationDelay: "-15s", opacity: 0.38 }} />
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute inset-0 bg-[#07070a]/55" />
      <div className="absolute inset-0 bg-grain" />
    </div>
  );
}

/* ----------------------------- kinetic marquee --------------------------- */
function Marquee() {
  const items = [
    "INSERT COIN", "FIVE CABINETS", "ONE CONTROLLER — YOU",
    "REFEREED BY NVIDIA NIM", "LIVE WEBCAM VISION", "NO KEYBOARDS",
    "ALL PLAY, NO FACTS",
  ];
  const seq = [...items, ...items];
  return (
    <div className="relative flex overflow-hidden border-y border-white/10 bg-white/[0.02] py-4 select-none">
      <div className="marquee">
        {seq.map((t, i) => (
          <span key={i} className="flex items-center whitespace-nowrap px-6 text-sm font-bold uppercase tracking-[0.25em] text-zinc-500">
            {t}
            <span className="ml-6 inline-block h-1.5 w-1.5 rounded-full bg-[#c4f24a]" />
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#07070a] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#07070a] to-transparent" />
    </div>
  );
}

/* ------------------------------- bento card ------------------------------ */
function GameCard({ g, onPlay, i }) {
  const Icon = g.icon;
  const Wrapper = g.feature ? Reveal : Reveal;
  return (
    <Wrapper
      as="article"
      delay={i * 70}
      onMouseMove={trackSpotlight}
      onClick={() => onPlay(g.id)}
      style={{ "--accent": g.color }}
      className={`spotlight group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 ${g.span ?? ""}`}
    >
      {/* hue wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(120% 90% at 18% 0%, ${g.color}1f, transparent 55%)` }}
      />
      {g.feature && (
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
          style={{ background: g.color }}
        />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl transition duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${g.color}1f`, color: g.color, boxShadow: `inset 0 0 0 1px ${g.color}40` }}
        >
          <Icon className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <span className="font-mono text-xs font-bold tracking-widest text-zinc-600">{g.idx}</span>
      </div>

      {/* feature cards get a faux cabinet preview to fill the taller span */}
      {g.feature && (
        <div className="relative mt-6 hidden aspect-[16/7] overflow-hidden rounded-2xl border border-white/10 lg:block"
          style={{ background: `linear-gradient(150deg, ${g.color}22, rgba(7,7,10,0.6))` }}>
          <div className="crt absolute inset-0 grid place-items-center">
            <Icon className="h-10 w-10 opacity-30" strokeWidth={1.6} style={{ color: g.color }} />
          </div>
          <Reticle accent={g.color} />
        </div>
      )}

      <div className={`relative ${g.feature ? "mt-6" : "mt-8"}`}>
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: g.color, backgroundColor: `${g.color}1a` }}>{g.tag}</span>
        </div>
        <h3 className={`font-black tracking-tight ${g.feature ? "text-3xl" : "text-xl"}`}>{g.title}</h3>
        <p className={`mt-2 text-sm leading-relaxed text-zinc-400 ${g.feature ? "" : "line-clamp-2"}`}>{g.hook}</p>
      </div>

      <div className="relative mt-6 flex items-center justify-between gap-3">
        <span className="max-w-[60%] truncate rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] text-zinc-500 ring-1 ring-white/10">
          {g.badge}
        </span>
        <span
          className="inline-flex items-center gap-1 text-sm font-bold opacity-80 transition duration-300 group-hover:gap-2 group-hover:opacity-100"
          style={{ color: g.color }}
        >
          Play
          <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
        </span>
      </div>
    </Wrapper>
  );
}

/* ------------------------------- shell ----------------------------------- */
export default function App() {
  const [activeId, setActiveId] = useState(null);
  const [replayKey, setReplayKey] = useState(0);

  const active = GAMES.find((g) => g.id === activeId);

  const play = (id) => {
    setActiveId(id);
    setReplayKey((k) => k + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="relative min-h-[100dvh] text-zinc-100">
      <Backdrop />

      {/* ---------------- header ---------------- */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setActiveId(null)} className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c4f24a] text-black" style={{ boxShadow: "0 8px 24px -8px #c4f24a99" }}>
              <Gamepad2 className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <span className="text-lg font-black tracking-tight">VLM Arcade</span>
          </button>
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" style={{ animation: "pulseRing 2s ease-out infinite" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            NVIDIA NIM online
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {!active ? (
          <>
            {/* ---------------- hero ---------------- */}
            <section className="relative pt-16 pb-10 sm:pt-24 md:pt-28">
              <Reveal as="div" className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300">
                <Radio className="h-3.5 w-3.5 text-[#c4f24a]" strokeWidth={2.4} />
                Five cabinets · live webcam vision
              </Reveal>

              <h1 className="max-w-4xl text-[clamp(2.75rem,9vw,6.5rem)] font-black leading-[0.92] tracking-tighter">
                <Reveal as="span" className="block">Webcam games,</Reveal>
                <Reveal as="span" delay={90} className="block">
                  refereed by{" "}
                  <span className="stroke-headline" style={{ ["--accent"]: "#c4f24a" }}>an AI.</span>
                </Reveal>
              </h1>

              <Reveal as="p" delay={160} className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
                Five quick vision challenges scored live by NVIDIA models. The camera is the
                controller — the only controller is you.
              </Reveal>

              <Reveal as="div" delay={230} className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#cabinets"
                  className="group inline-flex items-center gap-2 rounded-full bg-[#c4f24a] px-6 py-3 text-sm font-bold text-black transition active:scale-[0.97]"
                  style={{ boxShadow: "0 16px 40px -14px #c4f24acc" }}
                >
                  <Play className="h-4 w-4" strokeWidth={2.6} /> Pick a cabinet
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" strokeWidth={2.6} />
                </a>
                <div className="inline-flex items-center gap-4 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" strokeWidth={2} /> Key stays server-side</span>
                  <span className="inline-flex items-center gap-1.5"><Cpu className="h-4 w-4" strokeWidth={2} /> NIM vision models</span>
                </div>
              </Reveal>
            </section>

            <Marquee />

            {/* ---------------- bento lobby ---------------- */}
            <section id="cabinets" className="scroll-mt-24 pt-14">
              <Reveal as="div" className="mb-8 flex items-end justify-between gap-4">
                <div>
                  <div className={LABEL}>Select cabinet</div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">The line-up.</h2>
                </div>
                <span className="hidden font-mono text-xs text-zinc-600 sm:block">05 / 05 ready</span>
              </Reveal>

              <div className="grid auto-rows-[minmax(190px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
                {GAMES.map((g, i) => (
                  <GameCard key={g.id} g={g} i={i} onPlay={play} />
                ))}
              </div>
            </section>

            {/* ---------------- how it works ---------------- */}
            <section className="pt-20">
              <Reveal as="div" className="mb-8">
                <div className={LABEL}>Under the hood</div>
                <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                  The browser never sees the key. The model never sees the internet.
                </h2>
              </Reveal>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { icon: Camera, t: "You point a webcam", d: "Each game captures a downscaled frame — max 512px, JPEG — straight from your device. Nothing is stored." },
                  { icon: Cpu, t: "Worker asks NIM", d: "The frame + prompt POST to same-origin /api/infer. A Cloudflare Worker holds the NVIDIA key and forwards to NIM." },
                  { icon: Trophy, t: "Model scores the round", d: "The OpenAI-compatible reply comes back as plain text or JSON, and the cabinet renders a win, a critique, or a verdict." },
                ].map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <Reveal key={i} delay={i * 80}>
                      <Panel className="h-full">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-[#c4f24a] ring-1 ring-white/10">
                          <Icon className="h-5 w-5" strokeWidth={2.2} />
                        </span>
                        <div className="mt-4 text-lg font-bold tracking-tight">{s.t}</div>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.d}</p>
                      </Panel>
                    </Reveal>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          /* ---------------- play / cabinet view ---------------- */
          <div className="pt-10">
            {/* cabinet top strip */}
            <div
              className="mb-6 overflow-hidden rounded-[20px] border border-white/10"
              style={{ background: `linear-gradient(120deg, ${active.color}1a, rgba(255,255,255,0.02))` }}
            >
              <div className="flex items-center gap-4 p-5 sm:p-6">
                <span
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
                  style={{ backgroundColor: `${active.color}22`, color: active.color, boxShadow: `inset 0 0 0 1px ${active.color}55` }}
                >
                  <active.icon className="h-7 w-7" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold tracking-widest text-zinc-500">CABINET {active.idx}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: active.color, backgroundColor: `${active.color}1a` }}>{active.tag}</span>
                  </div>
                  <h2 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">{active.title}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{active.hook}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <GhostBtn onClick={() => setActiveId(null)}>
                    <ArrowLeft className="h-4 w-4" strokeWidth={2.4} /> <span className="hidden sm:inline">Back</span>
                  </GhostBtn>
                  <GhostBtn onClick={() => setReplayKey((k) => k + 1)}>
                    <RotateCcw className="h-4 w-4" strokeWidth={2.4} /> <span className="hidden sm:inline">Replay</span>
                  </GhostBtn>
                </div>
              </div>
              {/* accent rail */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${active.color}, transparent)` }} />
            </div>

            <active.Component key={replayKey} infer={infer} accent={active.color} />

            {/* next cabinet shortcut */}
            <NextCabinet current={active.id} onPlay={play} />
          </div>
        )}
      </main>

      {/* ---------------- footer ---------------- */}
      <footer className="relative border-t border-white/10 bg-[#07070a]/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c4f24a] text-black">
                  <Gamepad2 className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <span className="text-lg font-black tracking-tight">VLM Arcade</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                A drag-and-drop Cloudflare Pages app. Five webcam vision games,
                scored live by NVIDIA NIM. Built for play, not for facts.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
              <div className="col-span-2 mb-1 text-[11px] font-bold uppercase tracking-widest text-zinc-600">Cabinets</div>
              {GAMES.map((g) => (
                <button key={g.id} onClick={() => play(g.id)} className="text-left text-zinc-400 transition hover:text-zinc-100">
                  {g.title}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center">
            <p>All guesses, captions, and appraisals are AI-generated for play, not authoritative facts.</p>
            <p className="font-mono">Runs on NVIDIA NIM · retired models surface their 404 in-game</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* small "next cabinet" affordance at the bottom of a play view */
function NextCabinet({ current, onPlay }) {
  const idx = GAMES.findIndex((g) => g.id === current);
  const next = GAMES[(idx + 1) % GAMES.length];
  const Icon = next.icon;
  return (
    <button
      onClick={() => onPlay(next.id)}
      onMouseMove={trackSpotlight}
      style={{ "--accent": next.color }}
      className="spotlight group mt-8 flex w-full items-center justify-between overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.025] p-5 text-left transition hover:border-white/20"
    >
      <div className="flex items-center gap-4">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ backgroundColor: `${next.color}1f`, color: next.color }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Next cabinet</div>
          <div className="text-lg font-bold tracking-tight">{next.title}</div>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-zinc-500 transition group-hover:translate-x-1" style={{ color: next.color }} strokeWidth={2.4} />
    </button>
  );
}

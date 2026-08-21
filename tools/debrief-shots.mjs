// Capture the three debrief target states at the reference canvas size, straight from a real build.
//
// ⚠️ HEADLESS CHROME OVER CDP, NOT A SCREENSHOT BY HAND. The acceptance checklist requires an
// overlay and an absolute-difference image against the supplied references, and that needs the
// build's pixels in a FILE at 450x954 — the same canvas the references were exported at.
//
// Usage: node tools/debrief-shots.mjs <port> <outDir> [light|dark]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = process.argv[2] || "8751";
const OUT = process.argv[3] || "/tmp/rd-shots";
const THEME = process.argv[4] || "light";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const DEBUG_PORT = 9333 + (THEME === "dark" ? 1 : 0);
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=" + DEBUG_PORT,
  "--user-data-dir=/tmp/rd-chrome-" + THEME,
  "--window-size=450,954", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTargets() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch("http://127.0.0.1:" + DEBUG_PORT + "/json/list");
      const j = await r.json();
      const page = j.find((t) => t.type === "page");
      if (page) return page;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error("Chrome did not come up on " + DEBUG_PORT);
}

let nextId = 1;
function rpc(ws, method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id !== id) return;
      ws.removeEventListener("message", onMsg);
      if (m.error) reject(new Error(method + ": " + JSON.stringify(m.error)));
      else resolve(m.result);
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => reject(new Error(method + " timed out")), 30000);
  });
}

const FIXTURE = `(() => {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    pts.push({ lat: 54.6820 + t * 0.0180 + Math.sin(t * 9) * 0.0006,
               lng: -1.2160 + t * 0.0065 + Math.cos(t * 7) * 0.0009,
               t: Math.round(t * 2142) });
  }
  const base = [338, 344, 336, 341, 339, 347];
  const splits = base.map((s, i) => ({ km: i + 1, sec: s }));
  const run = {
    id: "run-fixture-1", t: "36\\u2019 easy run", d: "Today",
    dateIso: new Date().toISOString().slice(0, 10),
    dist: "6.31 km", time: "35:42", pace: "5:40 /km",
    distKm: 6.31, sec: 2142, avgPaceSec: 340,
    route: pts, splits: splits, elevGain: 28, type: "easy",
    rpe: 3, rband: { min: 2, max: 4 },
    pband: { minSecPerKm: 320, maxSecPerKm: 370 }, pwin: { s: 0, e: 6310 },
    avgHr: 142, maxHr: 158, kcal: 412, cadence: 162,
    zoneSec: [20, 522, 1462, 138, 0],
    steps: "36 minutes easy, conversational throughout"
  };
  localStorage.setItem("interun_runs", JSON.stringify([run]));
  localStorage.setItem("interun_theme_v1", "THEME_HERE");
  return "seeded";
})()`;

const ENTER = `(() => {
  // The welcome-back screen has no button any more — it self-dismisses after four seconds and a tap
  // anywhere skips it (owner, 2026-08-21). Clicking the overlay is what the button used to do.
  const wb = document.getElementById('welcomeback'); if (wb) wb.click();
  document.querySelectorAll('.welcome, .splash').forEach(n => n.remove());
  state.logged = JSON.parse(localStorage.getItem('interun_runs'));
  state.viewRunId = state.logged[0].id;
  state.screen = 'runview';
  render();
  return 'ok';
})()`;

async function main() {
  const page = await cdpTargets();
  const { WebSocket } = await import("ws").catch(() => ({ WebSocket: globalThis.WebSocket }));
  const ws = new (globalThis.WebSocket || WebSocket)(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });

  await rpc(ws, "Page.enable");
  await rpc(ws, "Runtime.enable");
  await rpc(ws, "Emulation.setDeviceMetricsOverride",
    { width: 450, height: 954, deviceScaleFactor: 2, mobile: true });

  const url = "http://localhost:" + PORT + "/index.html";
  await rpc(ws, "Page.navigate", { url });
  await sleep(1800);
  await rpc(ws, "Runtime.evaluate", { expression: FIXTURE.replace("THEME_HERE", THEME) });
  await rpc(ws, "Page.navigate", { url });
  await sleep(2200);
  await rpc(ws, "Runtime.evaluate", { expression: ENTER });
  // Tiles are fetched and composited asynchronously; give them a moment or the hero is a bare line.
  await sleep(3500);

  // ⚠️ THE REFERENCE PNGs INCLUDE A 44pt OS STATUS BAR AND A HEADLESS VIEWPORT HAS NONE, so every
  // landmark would read 44px high and the overlay would be uniformly shifted — a systematic error
  // that hides the real ones. This emulates the inset for the capture only; the app is untouched.
  await rpc(ws, "Runtime.evaluate", { expression: `(()=>{
    const b=document.createElement('div');
    b.style.cssText='position:fixed;left:0;top:0;right:0;height:44px;z-index:9999;background:var(--bg)';
    document.body.appendChild(b);
    document.querySelector('.app').style.paddingTop='44px';
    document.querySelector('.app').style.height='954px';
    return 'inset';})()` });
  await sleep(400);

  // ⚠️ EACH STATE IS ALIGNED ON ITS OWN ANCHOR, not on a scroll number picked by eye. A guessed
  // offset makes every row in the comparison wrong by the same amount and reads as a layout fault.
  const shots = [
    { name: "A-map-hero", anchor: null, scroll: 0 },
    { name: "B-coach", anchor: "Coach", targetY: 203 },
    { name: "C-analysis", anchor: "Run analysis", targetY: 156 },
  ];
  for (const s of shots) {
    const expr = s.anchor
      ? `(()=>{const v=document.getElementById('view');
           const h=[...v.querySelectorAll('.rd-sec')].find(n=>n.textContent.indexOf(${JSON.stringify(s.anchor)})===0);
           if(!h) return -1;
           v.scrollTop = 0; v.dispatchEvent(new Event('scroll'));
           const top = h.getBoundingClientRect().top;
           v.scrollTop = top - ${s.targetY};
           v.dispatchEvent(new Event('scroll')); return v.scrollTop;})()`
      : "(()=>{const v=document.getElementById('view');v.scrollTop=0;v.dispatchEvent(new Event('scroll'));return v.scrollTop})()";
    const got = await rpc(ws, "Runtime.evaluate", { expression: expr, returnByValue: true });
    if (got.result && got.result.value === -1) console.log("  ! anchor not found for", s.name);
    await sleep(600);
    const r = await rpc(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(OUT + "/" + s.name + "-" + THEME + ".png", Buffer.from(r.data, "base64"));
    console.log("wrote", s.name + "-" + THEME + ".png");
  }
  // What the analysis tab looks like with Splits selected, for the checklist.
  ws.close();
  chrome.kill();
}
main().catch((e) => { console.error(String(e)); chrome.kill(); process.exit(1); });

// Capture every panel of the recap story at the reference canvas size, straight from a real build.
//
// ⚠️ HEADLESS CHROME OVER CDP, same technique as tools/debrief-shots.mjs. The reference frames are
// 380x825 screen recordings, so the emulated viewport matches that and every landmark can be measured
// against theirs in the same coordinate space.
//
// ⚠️ THE FIXTURE IS THE REFERENCE'S OWN RUN. Comparing our 6.31 km against their 5.51 km would make
// every bar length, every pace and every sentence differ for reasons that are not design.
//
// ⚠️ THE AUTO-ADVANCE IS CANCELLED AND EACH PANEL DRIVEN BY HAND. Letting the story run and grabbing
// frames on a timer captures panels mid-cross-dissolve, which reads as a blurred design rather than a
// blurred transition.
//
// Usage: node tools/story-shots.mjs <port> <outDir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = process.argv[2] || "8761";
const OUT = process.argv[3] || "/tmp/story-shots";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const DEBUG_PORT = 9351;
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=" + DEBUG_PORT,
  "--user-data-dir=/tmp/story-chrome",
  "--window-size=380,825", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const j = await (await fetch("http://127.0.0.1:" + DEBUG_PORT + "/json/list")).json();
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
    setTimeout(() => reject(new Error(method + " timed out")), 40000);
  });
}

// The reference run: 5.51 km in 31:04, 5:38/km, splits 5:51 5:37 5:36 5:33 5:34 and 0.51 km at 5:33,
// avg HR 148 max 163, 11 m of climb, 158 spm. Route is a there-and-back up a river path.
const FIXTURE = `(() => {
  const pts = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    pts.push({ lat: 54.6820 + t * 0.0190 + Math.sin(t * 8) * 0.0007,
               lng: -1.2160 + t * 0.0058 + Math.cos(t * 6) * 0.0010,
               t: Math.round(t * 1864) });
  }
  const splits = [
    { km: 1, sec: 351 }, { km: 2, sec: 337 }, { km: 3, sec: 336 },
    { km: 4, sec: 333 }, { km: 5, sec: 334 }, { km: 6, sec: 333, part: 0.51 }
  ];
  const hr = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    hr.push([Math.round(t * 5510), Math.round(120 + 34 * Math.min(1, t * 3.2) + Math.sin(t * 5) * 4)]);
  }
  const run = {
    id: "run-story-ref", t: "5.5km Easy Run", d: "Today",
    dateIso: new Date().toISOString().slice(0, 10),
    dist: "5.51 km", time: "31:04", pace: "5:38 /km",
    distKm: 5.51, sec: 1864, avgPaceSec: 338,
    route: pts, splits: splits, elevGain: 11, type: "easy",
    rpe: 3, rband: { min: 2, max: 4 },
    pband: { minSecPerKm: 320, maxSecPerKm: 360 }, pwin: { s: 0, e: 5510 },
    avgHr: 148, maxHr: 163, kcal: 372, cadence: 158,
    hrSeries: hr,
    zoneSec: [18, 402, 1180, 264, 0],
    steps: "36 minutes easy, conversational throughout"
  };
  localStorage.setItem("interun_runs", JSON.stringify([run]));
  localStorage.setItem("interun_theme_v1", "dark");
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

// Open the story, then take the wheel: clear both timers so nothing advances or re-words underneath
// a capture. Returns the panel kinds so the caller labels files by what is actually in them.
const OPEN = `(() => {
  openRunStory(state.logged[0]);
  clearTimeout(STORY.timer); clearTimeout(STORY.beatTimer);
  return JSON.stringify({ kinds: STORY.kinds, n: STORY.n });
})()`;

const showPanel = (i) => `(() => {
  storyShow(${i});
  clearTimeout(STORY.timer); clearTimeout(STORY.beatTimer);
  return STORY.kinds[STORY.i] + ':' + STORY.beats.length;
})()`;

const showBeat = (k) => `(() => {
  storyBeat(${k});
  clearTimeout(STORY.timer); clearTimeout(STORY.beatTimer);
  return 'beat' + ${k};
})()`;

async function main() {
  const page = await cdpTarget();
  const { WebSocket } = await import("ws").catch(() => ({ WebSocket: globalThis.WebSocket }));
  const ws = new (globalThis.WebSocket || WebSocket)(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });

  await rpc(ws, "Page.enable");
  await rpc(ws, "Runtime.enable");
  await rpc(ws, "Emulation.setDeviceMetricsOverride",
    { width: 380, height: 825, deviceScaleFactor: 2, mobile: true });

  const url = "http://localhost:" + PORT + "/index.html";
  await rpc(ws, "Page.navigate", { url });
  await sleep(1800);
  await rpc(ws, "Runtime.evaluate", { expression: FIXTURE });
  await rpc(ws, "Page.navigate", { url });
  await sleep(2400);
  await rpc(ws, "Runtime.evaluate", { expression: ENTER });
  await sleep(900);

  const opened = await rpc(ws, "Runtime.evaluate", { expression: OPEN, returnByValue: true });
  const meta = JSON.parse(opened.result.value);
  console.log("panels:", meta.kinds.join(" / "), "n=" + meta.n);

  const shots = [];
  for (let i = 0; i < meta.n; i++) {
    // ⚠️ PANEL 0 IS ALREADY ON SCREEN — openRunStory shows it. Calling storyShow(0) again here built a
    // SECOND panel over the first while the tile cache was still cold, and the two concurrent
    // buildStoryMap calls for one key left the basemap uncomposited: measured, the whole map band came
    // out a flat 14.4 luminance (#06110e, the panel's own backing) with the route floating on nothing.
    // That is the harness photographing its own re-entry, and it read exactly like a missing basemap.
    let kind = meta.kinds[i], beats = "1";
    if (i > 0) {
      const r = await rpc(ws, "Runtime.evaluate", { expression: showPanel(i), returnByValue: true });
      [kind, beats] = String(r.result.value).split(":");
    } else {
      const r = await rpc(ws, "Runtime.evaluate", { returnByValue: true,
        expression: "String(STORY.kinds[0]) + ':' + STORY.beats.length" });
      [kind, beats] = String(r.result.value).split(":");
    }
    // The route draws itself over STORY_DRAW_MS and the tiles arrive over the network; everything else
    // settles in well under a second. Wait for the thing to have finished happening.
    await sleep(kind === "route" ? 7000 : 1400);
    shots.push({ file: `${i}-${kind}.png` });
    let s = await rpc(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(OUT + "/" + `${i}-${kind}.png`, Buffer.from(s.data, "base64"));
    console.log("wrote", `${i}-${kind}.png`);
    for (let b = 1; b < Number(beats); b++) {
      await rpc(ws, "Runtime.evaluate", { expression: showBeat(b), returnByValue: true });
      await sleep(1400);
      s = await rpc(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(OUT + "/" + `${i}-${kind}-b${b}.png`, Buffer.from(s.data, "base64"));
      console.log("wrote", `${i}-${kind}-b${b}.png`);
    }
  }

  // What actually served the tiles, and whether the overlay composited — a bare line on a flat ground
  // and a real basemap look similar at a glance in a dark theme.
  const diag = await rpc(ws, "Runtime.evaluate", { returnByValue: true, expression: `(() => {
    const m = document.querySelector('.story-map');
    const cv = document.querySelector('.story-mapcv');
    return JSON.stringify({
      mapReady: m ? m.className : null,
      canvas: cv ? (cv.width + 'x' + cv.height) : null,
      provider: (typeof mapProviderFor === 'function') ? mapProviderFor() : 'n/a',
      attr: (document.querySelector('.story-attr') || {}).textContent || null
    });
  })()` });
  console.log("diag:", diag.result.value);
  ws.close();
  chrome.kill();
}
main().catch((e) => { console.error(String(e)); chrome.kill(); process.exit(1); });

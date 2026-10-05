// The iPhone screenshots for the App Store, straight from a real build, at the two sizes Apple takes.
//
// ⚠️ HEADLESS CHROME OVER CDP, the same technique as tools/story-shots.mjs (PLAN.md D4 asked for that
// pattern). The iPhone app IS this page in a web view, so a capture at the phone's own size, at its own
// pixel density, is the app's own pixels — no mock-up, no device frame.
//
// ⚠️ THE RUNNER IN THESE PICTURES IS MADE UP — "Sam", week 5 of a 13-week half-marathon plan — because
// the App Store is public and a real runner's history would publish where they run. Sam's earlier runs
// are run through each planned session's own steps at the middle of its own target paces, then stored
// and linked to the session through the app's own functions, so every screen reads them the way it
// reads a real phone run. A loop in Hyde Park; nothing near anybody's home.
//
// ⚠️ THE CLOCK IS FROZEN ON A SUNDAY AT 07:10 (the coming one), the plan's long-run day: Today shows a
// 100-minute long run with a fast finish, and its briefing reads last Sunday's debrief and the fuelling.
// (Tuesday's tempo was tried first, and its briefing quoted "A run by feel" — the debrief's verdict for
// every rep session, raised as its own task.) Always a day or more ahead of the real date, never more
// than a week, so the live weather is still a real forecast.
//
// ⚠️ NO MAPS. The free basemap provider (CARTO) now answers every tile with "API KEY REQUIRED" (measured
// 2026-10-05), and the Mapbox token the shipped app uses is a live credential that this tool will not
// carry. The coach's debrief is shown scrolled past the route map for that reason.
//
// ⚠️ NO ALPHA CHANNEL. Apple: "Images can't include alpha channels or transparencies." Chrome writes
// RGBA, so every capture is re-encoded as plain RGB before it is saved, and the size is checked.
//
// Usage: python3 -m http.server 8777 --directory docs   (in another terminal; check the port is free)
//        node tools/store-shots.mjs [port] [outDir]       → <outDir>/iphone-6.9/*.png, iphone-6.5/*.png
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import zlib from "node:zlib";

const PORT = process.argv[2] || "8777";
const OUT = process.argv[3] || "store-shots";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = "http://localhost:" + PORT;

// Apple's accepted portrait sizes (Screenshot specifications, read 2026-10-05): 6.9" takes 1320 x 2868,
// 6.5" takes 1284 x 2778. Both are the phone's points at 3x.
export const SIZES = [
  { dir: "iphone-6.9", w: 440, h: 956, px: [1320, 2868] },
  { dir: "iphone-6.5", w: 428, h: 926, px: [1284, 2778] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The coming Sunday (never today), 07:10 on the page's clock. Time keeps moving from there.
const DAY = 0;
const CLOCK = `(() => {
  const RealDate = Date;
  const r = new RealDate();
  const ahead = ((${DAY} - r.getDay() + 7) % 7) || 7;
  const target = new RealDate(r.getFullYear(), r.getMonth(), r.getDate() + ahead, 7, 10, 0, 0).getTime();
  const OFFSET = target - RealDate.now();
  function FakeDate(...a) {
    if (!new.target) return new RealDate(RealDate.now() + OFFSET).toString();
    return a.length ? new RealDate(...a) : new RealDate(RealDate.now() + OFFSET);
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = () => RealDate.now() + OFFSET;
  FakeDate.UTC = RealDate.UTC;
  FakeDate.parse = RealDate.parse;
  globalThis.Date = FakeDate;
})();`;

// Sam's profile: the plan began on the Monday four weeks before this one and the race is the Sunday
// of week 13, so today is week 5 of 13, in the build phase.
const SEED = `(() => {
  localStorage.clear();
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 28);
  const race = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 13 * 7 - 1);
  const prof = { name: "Sam", avatar: "", status: "regular", goalDist: "half", targetS: 6900, targetSet: true,
    raceDate: iso(race), startDateIso: iso(start), longRunDay: 6, fitSrc: "recent", recentDistM: 5000,
    recentTimeS: 1530, noRecent: false, easyPaceS: 0, twoKmS: 0, daysPerWeek: 4, volKm: 28, sex: "",
    strength: true, returning: false, personalized: true, bRace: null, age: 34 };
  localStorage.setItem("rc_profile_v1", JSON.stringify(prof));
  localStorage.setItem("interun_anchor_v1", iso(start));
  localStorage.setItem("interun_guide_seen", "1");
  localStorage.setItem("interun_theme_v1", "dark");
  return iso(now) + " start " + iso(start) + " race " + iso(race);
})()`;

// Every planned run before today, recorded the way the phone records one (liveRunRecord's fields),
// through the session's own steps, and linked to its session with the app's own linkRunTo/tickSession.
const RUNS = `(() => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jit = (x, f) => x * (1 + (rnd() * 2 - 1) * f);
  const LOOP = [
    [51.50262, -0.15275], [51.50300, -0.15720], [51.50330, -0.16250], [51.50355, -0.16800],
    [51.50380, -0.17300], [51.50470, -0.17360], [51.50620, -0.17420], [51.50800, -0.17480],
    [51.50990, -0.17520], [51.51060, -0.17420], [51.51110, -0.16950], [51.51160, -0.16450],
    [51.51220, -0.16000], [51.51260, -0.15880], [51.51090, -0.15760], [51.50850, -0.15620],
    [51.50600, -0.15480], [51.50400, -0.15360], [51.50262, -0.15275]];
  const R = 6371000, rad = (d) => d * Math.PI / 180;
  const hav = (a, b) => { const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h)); };
  const segs = []; let loopLen = 0;
  for (let i = 1; i < LOOP.length; i++) { const d = hav(LOOP[i - 1], LOOP[i]); segs.push([LOOP[i - 1], LOOP[i], loopLen, d]); loopLen += d; }
  const at = (m) => { const x = m % loopLen;
    for (const [a, b, s, d] of segs) if (x <= s + d) { const f = (x - s) / d; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
    return LOOP[0]; };
  // A step with no pace target is run at a pace for its effort; a walk is a walk; a sprint is a sprint.
  const paceFor = (st) => {
    const b = st.targetPaceSecPerKm;
    if (b && b.minSecPerKm && b.maxSecPerKm) return (b.minSecPerKm + b.maxSecPerKm) / 2;
    if (/walk/i.test(st.label || "")) return 840;
    if ((st.durationSeconds || 99) <= 30) return 290;
    const r = st.targetRpe ? (st.targetRpe.min + st.targetRpe.max) / 2 : 3;
    return r <= 3 ? 417 : r <= 5 ? 392 : r <= 7 ? 345 : 315;
  };
  const hrFor = (pace) => pace >= 600 ? 118 : pace >= 410 ? 143 : pace >= 380 ? 152 : pace >= 340 ? 165 : pace >= 300 ? 172 : 176;
  const ceil = maxHrEstimate();
  function recordFor(c, hh, mm) {
    const sess = c.raw, tl = []; let t = 0, m = 0, hr = 96;
    for (const st of (sess.steps || [])) {
      const pace = jit(paceFor(st), 0.012);
      const dur = st.durationSeconds != null ? st.durationSeconds : st.distanceMeters != null ? st.distanceMeters / 1000 * pace : 60;
      const target = hrFor(pace);
      for (let s = 0; s < dur; s += 5) {
        const dt = Math.min(5, dur - s);
        m += (1000 / jit(pace, 0.03)) * dt; t += dt;
        hr += (target + t / 600 - hr) * (1 - Math.exp(-dt / 35));
        tl.push({ t: t, m: m, hr: hr + (rnd() * 2 - 1) * 1.5 });
      }
    }
    const totalM = tl[tl.length - 1].m, totalS = Math.round(tl[tl.length - 1].t);
    const distKm = Math.round(totalM / 10) / 100;
    const splits = []; let lastT = 0, nextKm = 1;
    for (const p of tl) { while (p.m >= nextKm * 1000) { splits.push({ km: nextKm, sec: Math.round(p.t - lastT) }); lastT = p.t; nextKm++; } }
    const rem = totalM - (nextKm - 1) * 1000;
    if (rem >= 50) splits.push({ km: nextKm, sec: Math.round(((totalS - lastT) / rem) * 1000), part: Math.round(rem / 10) / 100 });
    const route = [], hrSeries = [], zoneSec = [0, 0, 0, 0, 0];
    let nextR = 0, nextH = 0, prevT = 0, hrSum = 0, hrN = 0, hrMax = 0;
    for (const p of tl) {
      if (p.m >= nextR) { const ll = at(p.m); route.push({ lat: +(ll[0] + (rnd() - 0.5) * 0.00004).toFixed(6), lng: +(ll[1] + (rnd() - 0.5) * 0.00006).toFixed(6), t: Math.round(p.t) }); nextR += 30; }
      const bpm = Math.round(p.hr);
      if (p.m >= nextH) { hrSeries.push([Math.round(p.m), bpm]); nextH += 100; }
      const z = hrZoneIndex(bpm, ceil); if (z >= 0) zoneSec[z] += p.t - prevT; prevT = p.t;
      hrSum += bpm; hrN++; hrMax = Math.max(hrMax, bpm);
    }
    const pace = Math.round(totalS / (totalM / 1000));
    const stamp = paceStampFor(sess), rb = plannedRpeBandOf(sess);
    const d = c.iso.split("-").map(Number);
    const startMs = new Date(d[0], d[1] - 1, d[2], hh, mm, 0, 0).getTime();
    const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return {
      id: "run-" + startMs, t: sess.title,
      d: d[2] + " " + M[d[1] - 1] + " · " + String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"),
      dateIso: c.iso, dist: distKm.toFixed(2) + " km", time: fmtPace(totalS), pace: fmtPace(pace) + " /km",
      distKm: distKm, sec: totalS, avgPaceSec: pace,
      route: route, splits: splits, elevGain: Math.round(6 + distKm * 0.8), type: sess.type,
      rpe: rb ? Math.round((rb.min + rb.max) / 2) : 3,
      pband: stamp.pband, rband: rb, pwin: stamp.pwin, pmix: stamp.pmix,
      anchor: profile.recentTimeS, pmodel: PACE_MODEL_VERSION,
      avgHr: Math.round(hrSum / hrN), maxHr: hrMax,
      cadence: Math.round(166 + (pace < 360 ? 6 : 0) + (rnd() * 2 - 1) * 2),
      hrSeries: hrSeries, zoneSec: zoneSec.map((s) => Math.round(s)), steps: sessionStepText(sess),
    };
  }
  const today = todayIso(); let n = 0;
  for (let iso = PLAN.weeks[0].startIso; iso < today; iso = isoAdd(iso, 1).toISOString().slice(0, 10)) {
    for (const c of linkCandidatesFor(iso, null).filter((x) => x.iso === iso)) {
      const rec = recordFor(c, 6 + Math.floor(rnd() * 2), 5 + Math.floor(rnd() * 40));
      state.logged.unshift(rec);
      linkRunTo(rec.id, { sid: c.sid, wk: c.wk, iso: c.iso });
      tickSession(c.iso, c.sid);
      n++;
    }
  }
  state.logged.sort((a, b) => (a.dateIso < b.dateIso ? 1 : a.dateIso > b.dateIso ? -1 : 0));
  const long = state.logged.find((r) => r.type === "long"); if (long) long.react = "up";
  saveRuns();
  return n + " runs";
})()`;

// Helpers the scenes share, defined after each load.
const HELPERS = `(() => {
  window.__shots = {
    tab(t) {
      try { closeSheet(); } catch (e) {}
      state.screen = null;
      const b = document.querySelector('[data-tab="' + t + '"]');
      if (b) b.click(); else render();
      const v = document.getElementById("view"); if (v) v.scrollTop = 0;
    },
    today() {
      const w = RAW.weeks[CURRENT_WEEK];
      return (w.sessions || []).find((s) => PRIMARY_TYPES[s.type] && effDay(s) === TODAY_DOW);
    },
    // This week's first strength session (there is none on a Sunday).
    strength() { return (RAW.weeks[CURRENT_WEEK].sessions || []).find((s) => s.type === "strength"); },
  };
  return "today " + todayIso() + " week " + (CURRENT_WEEK + 1) + " dow " + TODAY_DOW;
})()`;

const DISMISS_REVIEW = `(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Not now");
  if (!b) return "not shown";
  b.click();
  return "answered Not now";
})()`;

// Each scene: what to do, how long to let it settle, and (optionally) what must be true first.
export const SCENES = [
  { name: "1-today", wait: 1500, ready: "!!(state.wx && state.wx.live)",
    js: `(() => { __shots.tab("today"); return "today"; })()` },
  { name: "2-briefing", wait: 1800,
    js: `(() => { __shots.tab("today"); const s = __shots.today(); openSessionSheet(s, CURRENT_WEEK + 1); return s.title; })()` },
  { name: "3-plan", wait: 1500,
    js: `(() => { __shots.tab("plan"); return "plan"; })()` },
  { name: "4-debrief", wait: 1800,
    js: `(() => {
      __shots.tab("activities");
      const r = state.logged.find((x) => x.type === "long");
      state.viewRunId = r.id; state.viewRunIdx = state.logged.indexOf(r); state.screen = "runview"; render();
      setTimeout(() => {
        const v = document.getElementById("view");
        const h = [...document.querySelectorAll("h2, h3, .subhead, .sec-h, .rd-h")].find((e) => /^Coach\\u2019s debrief/.test(e.textContent.trim()));
        if (v && h) v.scrollTop += h.getBoundingClientRect().top - 72;
      }, 600);
      return r.t;
    })()` },
  { name: "5-alfie", wait: 2600,
    js: `(() => { __shots.tab("today"); alfieSetOnline(false); openAlfie(); setTimeout(() => alfieAsk("How fast should my easy runs be?"), 300); return "alfie"; })()` },
  { name: "6-strength", wait: 2600,
    js: `(() => { __shots.tab("today"); const s = __shots.strength(); openSessionSheet(s, CURRENT_WEEK + 1); return s.title; })()` },
];

// ---- PNG: drop the alpha channel ------------------------------------------------------------------
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
export function pngToRgb(buf) {
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || (ctype !== 6 && ctype !== 2)) throw new Error("unexpected PNG: depth " + depth + ", colour type " + ctype);
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * (1 + w * 3));
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride), translucent = 0;
  for (let y = 0; y < h; y++) {
    const base = y * (stride + 1), f = raw[base];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = raw[base + 1 + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    const o = y * (1 + w * 3);
    out[o] = 0;
    for (let x = 0; x < w; x++) {
      out[o + 1 + x * 3] = cur[x * bpp]; out[o + 2 + x * 3] = cur[x * bpp + 1]; out[o + 3 + x * 3] = cur[x * bpp + 2];
      if (bpp === 4 && cur[x * 4 + 3] !== 255) translucent++;
    }
    [prev, cur] = [cur, prev];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(out, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  return { png, w, h, translucent };
}

// ---- CDP plumbing (as tools/story-shots.mjs) --------------------------------------------------------
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
async function evaluate(ws, expression) {
  const r = await rpc(ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("page threw: " + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function waitFor(ws, cond, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await evaluate(ws, "(() => { try { return !!(" + cond + "); } catch (e) { return false; } })()")) return true;
    await sleep(250);
  }
  return false;
}

async function shootSize(size, debugPort) {
  const profileDir = join(tmpdir(), "interun-store-shots-" + size.dir);
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--remote-debugging-port=" + debugPort, "--user-data-dir=" + profileDir,
    "--window-size=" + size.w + "," + size.h, "about:blank"], { stdio: "ignore" });
  try {
    let page = null;
    for (let i = 0; i < 40 && !page; i++) {
      try { page = (await (await fetch("http://127.0.0.1:" + debugPort + "/json/list")).json()).find((t) => t.type === "page"); } catch (e) {}
      if (!page) await sleep(250);
    }
    if (!page) throw new Error("Chrome did not come up on " + debugPort);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
    await rpc(ws, "Page.enable");
    await rpc(ws, "Runtime.enable");
    await rpc(ws, "Network.enable");
    await rpc(ws, "Network.setBypassServiceWorker", { bypass: true });
    await rpc(ws, "Emulation.setDeviceMetricsOverride", { width: size.w, height: size.h, deviceScaleFactor: 3, mobile: true });
    await rpc(ws, "Emulation.setTimezoneOverride", { timezoneId: "Europe/London" });
    // Hyde Park, where Sam runs: the live weather is London's.
    await rpc(ws, "Browser.grantPermissions", { origin: ORIGIN, permissions: ["geolocation"] });
    await rpc(ws, "Emulation.setGeolocationOverride", { latitude: 51.5073, longitude: -0.1657, accuracy: 20 });
    await rpc(ws, "Page.addScriptToEvaluateOnNewDocument", { source: CLOCK });

    const url = (v) => ORIGIN + "/index.html?shots=" + v;
    await rpc(ws, "Page.navigate", { url: url(1) }); await sleep(2500);
    console.log("  " + size.dir + ": " + await evaluate(ws, SEED));
    await rpc(ws, "Page.navigate", { url: url(2) }); await sleep(3000);
    await evaluate(ws, "(() => { const wb = document.getElementById('welcomeback'); if (wb) wb.click(); return 1; })()");
    console.log("  " + size.dir + ": " + await evaluate(ws, RUNS));
    await rpc(ws, "Page.navigate", { url: url(3) }); await sleep(3000);
    await evaluate(ws, "(() => { const wb = document.getElementById('welcomeback'); if (wb) wb.click(); return 1; })()");
    console.log("  " + size.dir + ": " + await evaluate(ws, HELPERS));
    // Sunday's Today opens with the weekly review. Sam answers it the way a runner would ("Not now"),
    // and the toast that follows is left to go before anything is captured.
    console.log("  " + size.dir + ": weekly review " + await evaluate(ws, DISMISS_REVIEW));
    await sleep(5000);

    const dir = join(OUT, size.dir);
    mkdirSync(dir, { recursive: true });
    for (const sc of SCENES) {
      const said = await evaluate(ws, sc.js);
      if (sc.ready && !(await waitFor(ws, sc.ready, 12000))) console.log("  ⚠️ " + sc.name + ": not ready (" + sc.ready + ")");
      await sleep(sc.wait);
      const s = await rpc(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const { png, w, h, translucent } = pngToRgb(Buffer.from(s.data, "base64"));
      const ok = w === size.px[0] && h === size.px[1];
      writeFileSync(join(dir, sc.name + ".png"), png);
      console.log("  " + (ok ? "✓" : "✗") + " " + join(dir, sc.name + ".png") + "  " + w + "x" + h + "  RGB" +
        (translucent ? "  ⚠️ " + translucent + " see-through pixels flattened" : "") + "  (" + said + ")");
      if (!ok) throw new Error(sc.name + " came out " + w + "x" + h + ", Apple wants " + size.px.join("x"));
    }
    ws.close();
  } finally {
    chrome.kill();
  }
}

if (import.meta.url === "file://" + process.argv[1]) {
  (async () => {
    try {
      const r = await fetch(ORIGIN + "/index.html");
      if (!r.ok) throw new Error("HTTP " + r.status);
    } catch (e) {
      console.error("Nothing is serving docs/ on " + ORIGIN + " — start: python3 -m http.server " + PORT + " --directory docs");
      process.exit(1);
    }
    let port = 9361;
    for (const size of SIZES) { await shootSize(size, port++); }
    console.log("done → " + OUT);
  })().catch((e) => { console.error(String(e && e.stack || e)); process.exit(1); });
}

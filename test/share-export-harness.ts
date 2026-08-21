/**
 * THE EXPORT GATE'S INSTRUMENT: REAL ENCODED BYTES OUT OF THE REAL RENDERER.
 *
 * ⚠️ NOTHING IN THE SUITE HAD EVER LOOKED AT AN EXPORTED BYTE. The preflight swept all 69 test files
 * and found no assertion about an exported pixel dimension, an encoding, a quality, a filename or a
 * piece of metadata — and `VISUAL_ACCEPTANCE_CHECKLIST.md` section G is a release gate, so it could
 * not be deferred. test/share-render.test.ts asserts the arithmetic (cardGeom answers 1080x1920);
 * this file asserts the artefact (the JPEG's own SOF header says 1080x1920).
 *
 * ⚠️ THE DIFFERENCE IS NOT PEDANTRY. Between the geometry and the file sit canvas.width, the 2D
 * context, toBlob, the encoder's own choices and whatever the platform decides to embed. Every fault
 * this phase exists to catch lives in that gap: an upscaled screen render, a devicePixelRatio in the
 * contract, an encoder handed the source photograph instead of the composed canvas, a colour profile
 * that is not sRGB, a GPS tag riding out of the phone inside a picture the runner posts.
 *
 * ⚠️ NODE HAS NO CANVAS, SO THE RENDERER IS LIFTED INTO A REAL BROWSER. The lift is the same trick
 * test/share-render.test.ts and test/warmup-delivery.test.ts already use — read the built page, cut
 * the app's own script block, take the functions out of it — except that here the host is headless
 * Chrome rather than a recording stub, so document.createElement("canvas") is a canvas and toBlob is
 * an encoder. What is measured is therefore the code that ships, at the size that ships, through the
 * encoder that ships.
 *
 * ⚠️ AND THE CLOSURE IS DERIVED, NEVER LISTED. Naming the functions by hand is how a list goes stale
 * and quietly stops covering the thing it was written for; this walks out from six named roots and
 * collects whatever they actually reach. Two faults it found while being written, both of which a
 * hand-list would have hidden and both of which the browser throws on:
 *   - a const's initialiser can call a function (DEFAULT_PROFILE calls futureIso) exactly as a
 *     function reads a const (SHARE_LADDER reads SHARE_EVEN_SPREAD_S), so the worklist has to carry
 *     both kinds until it stops growing rather than draining one and then the other;
 *   - a dependency need not be call-shaped: shareMetricsFor passes shareMetricUnit to .map as a
 *     VALUE, so a /name\(/ scan missed it.
 *
 * ⚠️ THE CONST STATEMENTS ARE EMITTED IN THE PAGE'S OWN DECLARATION ORDER, and that is a guard rather
 * than tidiness — the same one share-render.test.ts records. Sorted any other way a const that reads
 * a later const throws a temporal-dead-zone ReferenceError, which is what the app itself would do.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";

/* ================================================================================================ *
 * LIFTING THE PIPELINE OUT OF THE BUILT PAGE                                                       *
 * ================================================================================================ */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));

function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function drawShareCard(");
  if (marker < 0) throw new Error("drawShareCard is not in the build");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  if (open < 0 || close < open) throw new Error("the app's own script block could not be bounded");
  return html.slice(open + 8, close);
}
function fnBody(SRC: string, name: string): string | null {
  const at = SRC.indexOf("function " + name + "(");
  if (at < 0) return null;
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constStmt(SRC: string, name: string): string {
  const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
  if (at < 0) throw new Error("const not found in the build: " + name);
  let d = 0;
  for (let i = at; i < SRC.length; i++) {
    const c = SRC[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return SRC.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}
/**
 * ⚠️ COMMENTS ARE STRIPPED BEFORE THE IDENTIFIER SCAN, AND ONLY EVER FROM ONE LIFTED BODY AT A TIME.
 * The scan has to be broad, and this file's subject is documented at length in prose — so a broad
 * scan over the comments picked the word PLAN out of an explanatory sentence and then failed looking
 * for a declaration of it. CLAUDE.md records a 10 KB blind window opened by sweeping the whole app
 * script this way; bounding it to a single function or statement is what makes it safe here.
 */
function decomment(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");
}

/**
 * The six entry points the export actually has. Everything else in the bundle is reached from these,
 * so a template or a helper added later is picked up without touching this file.
 *
 * ⚠️ shareCardModel IS A ROOT ON PURPOSE, so the gate starts at a RUN RECORD rather than at a
 * hand-built model. A privacy switch that changes the picture has to change it through the app's own
 * sharePrivacyFor and runRoutePresentation; asserting that a model with no route draws no route would
 * only prove the renderer reads its argument.
 */
const ROOTS = ["drawShareCard", "shareCardCanvas", "canvasToShareFile", "shareFileName",
  "cardGeom", "shareCardModel"];

/** Globals the app owns; the harness supplies them so the lift cannot depend on app boot order. */
/**
 * ⚠️ SPHOTO IS SUPPLIED WITH A SETTER, AND THAT SETTER IS THE ONLY WAY THIS GATE CAN REACH THE FRAMING
 * STORE. shareCardModel reads the fit and the crop out of SPHOTO.crops through shareCropRead, so a
 * photograph handed in as an option carries no framing at all — every card would be drawn at the default
 * and the gate could only ever measure one of the two fit modes. The seam is entirely in this file: no
 * production identifier exists for a test to poke.
 */
const STUB = new Set(["PHOTODIAG", "state", "PRIVACY", "SHAREPRIV", "profile", "PLAN", "RAW",
  "SHARE_LPROBE", "SHARE_LPROBE_KEY", "SHARE_LIN_LUT", "SHARE_TOPO_C", "SHARE_TOPO_KEY",
  "SPHOTO", "SPHOTO_SEQ", "SHARE_BLUR_C", "SHARE_BLUR_KEY"]);

export type Lifted = { body: string; fns: string[]; consts: number };

export function liftExportPipeline(): Lifted {
  const SRC = appScript();
  const DECL = new Set<string>();
  for (const m of SRC.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)) DECL.add(m[1]!);
  const CONSTAT = new Map<string, number>();
  for (const m of SRC.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*)(?: = |, )/gm)) {
    if (!CONSTAT.has(m[1]!)) CONSTAT.set(m[1]!, m.index!);
  }
  // A multi-declarator statement (`const CARD_W = 1080, CARD_M = 64;`) can only be lifted whole, so
  // every name in one maps to the declarator the statement is found by.
  const OWNER = new Map<string, string>();
  for (const m of SRC.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*) = [^\n]*$/gm)) {
    for (const d of m[0].matchAll(/(?:^(?:const|let) |, )([A-Za-z_$][\w$]*) = /g)) OWNER.set(d[1]!, m[1]!);
  }
  const fns = new Set<string>(), q = [...ROOTS], cq: string[] = [], seenC = new Set<string>();
  const stmts = new Map<string, number>();
  const scan = (text: string) => {
    for (const m of decomment(text).matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (DECL.has(m[1]!)) q.push(m[1]!);
      else if (CONSTAT.has(m[1]!)) cq.push(m[1]!);
    }
  };
  while (q.length || cq.length) {
    while (q.length) {
      const n = q.pop()!;
      if (fns.has(n)) continue;
      const b = fnBody(SRC, n);
      if (b == null) throw new Error("dependency is not a top-level function: " + n);
      fns.add(n); scan(b);
    }
    while (cq.length) {
      const c = cq.pop()!;
      if (seenC.has(c) || STUB.has(c)) continue;
      seenC.add(c);
      const st = constStmt(SRC, OWNER.get(c) || c);
      if (!stmts.has(st)) { stmts.set(st, SRC.indexOf(st)); scan(st); }
    }
  }
  const ordered = [...stmts.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0]);
  const body =
    "let SHARE_LPROBE = null, SHARE_LPROBE_KEY = \"\";\n" +
    "let SHARE_LIN_LUT = null;\n" +
    "let SHARE_TOPO_C = null, SHARE_TOPO_KEY = \"\";\n" +
    "let SHARE_BLUR_C = null, SHARE_BLUR_KEY = \"\";\n" +
    "let SPHOTO = null, SPHOTO_SEQ = 0;\n" +
    ordered.join("\n") + "\n" +
    [...fns].map((n) => fnBody(SRC, n)).join("\n") + "\n" +
    "return { " + [...fns].join(", ") + ", __setPhoto: (p) => { SPHOTO = p; }," +
    // ⚠️ ONE MORE SEAM, AND IT IS THE SAME KIND AS __setPhoto. The scrim's stop count is the field the
    // fade's A/B turns: with it at 1 the emitted gradient is the straight line that shipped before ruling
    // 8, because smootherstep sampled at its two endpoints IS a line. No production identifier exists for
    // a test to poke; the seam is entirely in this file.
    " __scrim: () => SHARE_SCRIM };";
  return { body, fns: [...fns], consts: ordered.length };
}

/* ================================================================================================ *
 * DECODERS — THE BYTES, READ AS BYTES                                                              *
 * ================================================================================================ */

export type Seg = { marker: number; len: number; at: number; body: Buffer };

/** Every JPEG marker segment in order, or null when this is not a JPEG at all. */
export function jpegSegments(buf: Buffer): Seg[] | null {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
  const out: Seg[] = []; let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) break;
    const m = buf[i + 1]!;
    if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7) || m === 0x01 || m === 0xff) { i += 2; continue; }
    if (i + 4 > buf.length) break;
    const L = buf.readUInt16BE(i + 2);
    out.push({ marker: m, len: L, at: i, body: buf.subarray(i + 4, i + 2 + L) });
    if (m === 0xda) break;                 // start of scan: entropy-coded data follows
    i += 2 + L;
  }
  return out;
}
/**
 * The frame header's own pixel dimensions.
 * ⚠️ READ FROM SOFn, NOT FROM ANY WRAPPER. The size a viewer uses is the one in the frame header, so
 * that is the only field a dimension guard may believe.
 */
export function jpegSize(buf: Buffer): [number, number] | null {
  const segs = jpegSegments(buf); if (!segs) return null;
  for (const s of segs) {
    const m = s.marker;
    const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isSof) return [s.body.readUInt16BE(3), s.body.readUInt16BE(1)];
  }
  return null;
}
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export function pngSize(buf: Buffer): [number, number] | null {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
  if (buf.subarray(12, 16).toString("latin1") !== "IHDR") return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}
export function imageSize(buf: Buffer): [number, number] | null { return jpegSize(buf) || pngSize(buf); }
export function imageKind(buf: Buffer): string {
  if (jpegSize(buf)) return "jpeg";
  if (pngSize(buf)) return "png";
  return "unknown";
}
/** The two quantisation tables, which is where a JPEG records the quality it was written at. */
export function jpegQuantTables(buf: Buffer): number[][] {
  const segs = jpegSegments(buf) || [];
  const out: number[][] = [];
  for (const s of segs) {
    if (s.marker !== 0xdb) continue;
    let p = 0;
    while (p < s.body.length) {
      const pq = s.body[p]! >> 4, n = pq ? 128 : 64;
      const t: number[] = [];
      for (let k = 0; k < 64 && p + 1 + (pq ? k * 2 : k) < s.body.length; k++) {
        t.push(pq ? s.body.readUInt16BE(p + 1 + k * 2) : s.body[p + 1 + k]!);
      }
      out.push(t); p += 1 + n;
    }
  }
  return out;
}
export type IccInfo = { present: boolean; space?: string; pcs?: string; klass?: string; desc?: string; size?: number };
/** The embedded colour profile, from the APP2 ICC_PROFILE segment. */

export function iccInfo(buf: Buffer): IccInfo {
  const segs = jpegSegments(buf);
  if (!segs) return { present: false };
  const a = segs.find((s) => s.marker === 0xe2 && s.body.subarray(0, 12).toString("latin1") === "ICC_PROFILE\0");
  if (!a) return { present: false };
  const p = a.body.subarray(14);            // 12-byte identifier + chunk sequence + chunk count
  if (p.length < 132) return { present: true };
  let desc = "";
  const n = p.readUInt32BE(128);
  for (let k = 0; k < n && 132 + k * 12 + 12 <= p.length; k++) {
    const o = 132 + k * 12;
    if (p.subarray(o, o + 4).toString("latin1") !== "desc") continue;
    const off = p.readUInt32BE(o + 4), len = p.readUInt32BE(o + 8);
    if (off + len <= p.length) desc = p.subarray(off, off + len).toString("latin1").replace(/[^\x20-\x7e]/g, "");
  }
  return { present: true, size: p.readUInt32BE(0), klass: p.subarray(12, 16).toString("latin1"),
    space: p.subarray(16, 20).toString("latin1"), pcs: p.subarray(20, 24).toString("latin1"), desc };
}
export type ExifInfo = { app1: boolean; gps: boolean; ifds: string[]; tags: { ifd: string; tag: number }[]; gpsTags: number[] };
/**
 * The Exif block, walked properly rather than grepped for.
 * ⚠️ A SUBSTRING SEARCH FOR "GPS" IS NOT A METADATA TEST. Entropy-coded JPEG data contains arbitrary
 * bytes, so any byte pattern shows up somewhere by chance; the only honest question is whether there
 * is an APP1 Exif block and whether its IFD0 carries the 0x8825 pointer to a GPS IFD.
 */
export function exifInfo(buf: Buffer): ExifInfo {
  const none: ExifInfo = { app1: false, gps: false, ifds: [], tags: [], gpsTags: [] };
  const segs = jpegSegments(buf);
  if (!segs) return none;
  const a = segs.find((s) => s.marker === 0xe1 && s.body.subarray(0, 6).toString("latin1") === "Exif\0\0");
  if (!a) return none;
  const t = a.body.subarray(6);
  if (t.length < 8) return { ...none, app1: true };
  const be = t.subarray(0, 2).toString("latin1") === "MM";
  const r16 = (o: number) => be ? t.readUInt16BE(o) : t.readUInt16LE(o);
  const r32 = (o: number) => be ? t.readUInt32BE(o) : t.readUInt32LE(o);
  const tags: { ifd: string; tag: number }[] = [], ifds: string[] = [];
  const walk = (off: number, name: string, depth: number) => {
    if (depth > 4 || off <= 0 || off + 2 > t.length) return;
    ifds.push(name);
    const n = r16(off);
    for (let k = 0; k < n; k++) {
      const e = off + 2 + k * 12;
      if (e + 12 > t.length) return;
      const tag = r16(e);
      tags.push({ ifd: name, tag });
      if (tag === 0x8825) walk(r32(e + 8), "gps", depth + 1);
      else if (tag === 0x8769) walk(r32(e + 8), "exif", depth + 1);
    }
  };
  walk(r32(4), "ifd0", 0);
  return { app1: true, gps: ifds.includes("gps"), ifds, tags,
    gpsTags: tags.filter((x) => x.ifd === "gps").map((x) => x.tag) };
}
/**
 * A real Exif APP1 carrying a real GPS IFD, so the metadata guard is proven able to SEE one.
 * ⚠️ CONSTRUCTED RATHER THAN COMMITTED. A checked-in photograph would make the guard depend on a
 * binary nobody can read, and the interesting half of this test is that the parser above finds GPS in
 * the SOURCE and not in the export — which is only evidence if the source's tags are known exactly.
 */
export function buildGpsExif(): Buffer {
  const b = Buffer.alloc(512); let p = 0;
  const w16 = (v: number) => { b.writeUInt16BE(v, p); p += 2; };
  const w32 = (v: number) => { b.writeUInt32BE(v, p); p += 4; };
  w16(0x4d4d); w16(0x002a); w32(8);                              // "MM", 42, IFD0 at offset 8
  w16(1);
  w16(0x8825); w16(4); w32(1); w32(0);                           // GPSInfoIFDPointer, LONG, patched below
  const gpsPtrAt = p - 4;
  w32(0);                                                        // no IFD1
  const gpsAt = p;
  b.writeUInt32BE(gpsAt, gpsPtrAt);
  w16(4);
  w16(0x0000); w16(1); w32(4); b[p] = 2; b[p + 1] = 3; b[p + 2] = 0; b[p + 3] = 0; p += 4;  // GPSVersionID
  w16(0x0001); w16(2); w32(2); b.write("N\0", p, "latin1"); p += 4;                          // GPSLatitudeRef
  const latEntry = p;
  w16(0x0002); w16(5); w32(3); w32(0);                                                       // GPSLatitude
  w16(0x0003); w16(2); w32(2); b.write("W\0", p, "latin1"); p += 4;                          // GPSLongitudeRef
  w32(0);
  b.writeUInt32BE(p, latEntry + 8);
  for (const [n, d] of [[54, 1], [46, 1], [48, 10]]) { w32(n!); w32(d!); }
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), b.subarray(0, p)]);
  const seg = Buffer.alloc(4 + payload.length);
  seg.writeUInt16BE(0xffe1, 0); seg.writeUInt16BE(payload.length + 2, 2);
  payload.copy(seg, 4);
  return seg;
}
export function spliceApp1(jpeg: Buffer, app1: Buffer): Buffer {
  if (jpeg.readUInt16BE(0) !== 0xffd8) throw new Error("not a JPEG");
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}
export function sha(buf: Buffer): string { return createHash("sha256").update(buf).digest("hex").slice(0, 16); }

/* ================================================================================================ *
 * THE BROWSER                                                                                      *
 * ================================================================================================ */

/**
 * ⚠️ ABSENT IS A FAILURE, NOT A SKIP, AND THAT IS DELIBERATE. Section G is a release gate; a gate
 * that disappears when its instrument is missing reports the release as verified and has verified
 * nothing. Every guard in this project's history that could not fail was found to be worthless. The
 * message names the fix instead.
 */
const CANDIDATES = [
  process.env.CHROME_PATH || "",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium",
  "/usr/bin/chromium-browser", "/snap/bin/chromium",
];
export function findBrowser(): string | null {
  for (const c of CANDIDATES) if (c && existsSync(c)) return c;
  // the sandbox ships a Playwright chromium under a versioned directory
  for (const root of ["/opt/pw-browsers", process.env.HOME + "/.cache/ms-playwright"]) {
    try {
      for (const d of readdirSafe(root)) {
        for (const rel of ["chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
          const p = root + "/" + d + "/" + rel;
          if (existsSync(p)) return p;
        }
      }
    } catch (e) { /* no such root */ }
  }
  return null;
}
function readdirSafe(p: string): string[] {
  try { return readdirSync(p); } catch (e) { return []; }
}

export type Session = { ev: (expr: string, awaitP?: boolean) => Promise<any>;
  metrics: (w: number, h: number, dpr: number) => Promise<void>; close: () => void };

/** ⚠️ EXPORTED SO A MEASUREMENT PROBE CAN USE THE SAME BROWSER AND THE SAME LIFT AS THE GATE. Two ways
 * of getting the renderer into a browser is two things to keep in step, and the second one is the one
 * nobody updates. */
export async function openBrowser(): Promise<Session> {
  const bin = findBrowser();
  if (!bin) {
    throw new Error(
      "THE EXPORT GATE NEEDS A HEADLESS BROWSER AND FOUND NONE.\n" +
      "This file proves the exported bytes are 1080x1920 / 1080x1350, sRGB, free of GPS metadata and\n" +
      "independent of screen size. node has no canvas, so it cannot be checked without one.\n" +
      "Install Google Chrome or Chromium, or point CHROME_PATH at an existing binary, then re-run.\n" +
      "Tried: " + CANDIDATES.filter(Boolean).join(", "));
  }
  const port = 9200 + (process.pid % 700);
  const proc: ChildProcess = spawn(bin, ["--headless=new", "--disable-gpu", "--no-sandbox",
    "--remote-debugging-port=" + port, "--user-data-dir=" + tmpProfile(), "--no-first-run",
    "--disable-extensions", "about:blank"], { stdio: "ignore" });
  let url: string | null = null;
  for (let i = 0; i < 120 && !url; i++) {
    try {
      const list = JSON.parse(await getJson("127.0.0.1", port, "/json/list")) as any[];
      const page = list.find((t) => t.type === "page");
      if (page) url = page.webSocketDebuggerUrl as string;
    } catch (e) { /* not up yet */ }
    if (!url) await new Promise((r) => setTimeout(r, 150));
  }
  if (!url) { try { proc.kill(); } catch (e) {} throw new Error("the browser never opened a debugging port"); }
  const ws = await wsConnect(url);
  let nextId = 1;
  /**
   * ⚠️ THE TIMEOUT IS CLEARED ON THE REPLY, AND FORGETTING THAT HUNG THE PROCESS FOR TWO MINUTES.
   * An uncleared 120-second timer keeps node's event loop alive on its own — and it does not appear in
   * _getActiveHandles(), so the diagnostic showed only stdout and stderr and read as "nothing is
   * holding this open". Roughly forty calls each left one behind, so the file finished its work and
   * then sat until the last one expired.
   */
  const rpc = (method: string, params?: any) => new Promise<any>((res, rej) => {
    const id = nextId++;
    const timer = setTimeout(() => { off(); rej(new Error(method + " timed out")); }, 120000);
    const off = ws.onMessage((text: string) => {
      let x: any; try { x = JSON.parse(text); } catch (q) { return; }
      if (x.id !== id) return;
      off(); clearTimeout(timer);
      x.error ? rej(new Error(method + ": " + JSON.stringify(x.error))) : res(x.result);
    });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  await rpc("Runtime.enable");
  return {
    ev: async (expr: string, awaitP?: boolean) => {
      const r = await rpc("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: !!awaitP });
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        throw new Error("in the page: " + String((d.exception || {}).description || d.text).slice(0, 1400));
      }
      return r.result.value;
    },
    metrics: async (w: number, h: number, dpr: number) => {
      await rpc("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: true });
    },
    close: () => { try { ws.close(); } catch (e) {} try { proc.kill(); } catch (e) {} },
  };
}

/* ---- a minimal CDP WebSocket client ------------------------------------------------------------ *
 * ⚠️ HAND-ROLLED SO THE SOCKET CAN BE DESTROYED, AND THE TEST RUNNER IS THE WHOLE REASON. node's
 * global WebSocket offers close() and no handle: close() begins a handshake the peer has to answer,
 * and the peer here is a browser this harness has just killed — so the socket stayed open, the event
 * loop never drained, and the process sat there having finished its work. Under `node --test` every
 * file runs in a child the runner waits on, so that is not a slow test, it is a hung suite. With the
 * raw socket in hand, destroy() ends it whatever state the peer is in.
 * ⚠️ AND THE RECEIVE PATH HANDLES 64-BIT LENGTHS AND CONTINUATION FRAMES, because an export's base64
 * is around 470 KB for the poster — far past the 125-byte and 64 KB frame boundaries.
 */
type Sock = { send: (s: string) => void; onMessage: (fn: (s: string) => void) => () => void; close: () => void };
function wsConnect(url: string): Promise<Sock> {
  const u = new URL(url);
  return new Promise((res, rej) => {
    const req = httpRequest({ host: u.hostname, port: u.port, path: u.pathname + u.search,
      agent: false, headers: { Connection: "Upgrade", Upgrade: "websocket",
        "Sec-WebSocket-Key": randomBytes(16).toString("base64"), "Sec-WebSocket-Version": "13" } });
    req.on("error", rej);
    req.on("response", (r: any) => rej(new Error("the debugger refused the upgrade: " + r.statusCode)));
    req.on("upgrade", (_r: any, sock: any, head: Buffer) => {
      sock.setNoDelay(true);
      let buf: Buffer = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
      const listeners: ((s: string) => void)[] = [];
      let frag: Buffer[] = [], fragOp = 0;
      sock.on("data", (d: Buffer) => {
        buf = Buffer.concat([buf, d]);
        for (;;) {
          if (buf.length < 2) return;
          const b0 = buf[0]!, b1 = buf[1]!;
          const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
          let len = b1 & 0x7f, off = 2;
          if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
          else if (len === 127) {
            if (buf.length < 10) return;
            if (buf.readUInt32BE(2)) { sock.destroy(); return; }
            len = buf.readUInt32BE(6); off = 10;
          }
          if (masked) off += 4;
          if (buf.length < off + len) return;
          const pay = buf.subarray(off, off + len);
          buf = buf.subarray(off + len);
          if (op === 0x8) { sock.destroy(); return; }
          if (op === 0x9) { sock.write(wsFrame(0xa, pay)); continue; }
          if (op === 0xa) continue;
          if (op === 0x0) frag.push(pay);
          else { frag = [pay]; fragOp = op; }
          if (!fin) continue;
          const whole = Buffer.concat(frag); frag = [];
          if (fragOp === 0x1) for (const fn of listeners.slice()) fn(whole.toString("utf8"));
        }
      });
      sock.on("error", () => { /* the peer going away is the normal way this ends */ });
      res({
        send: (s: string) => { sock.write(wsFrame(0x1, Buffer.from(s, "utf8"))); },
        onMessage: (fn) => { listeners.push(fn); return () => {
          const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
        close: () => { try { sock.destroy(); } catch (e) {} },
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error("the debugger upgrade timed out")));
    req.end();
  });
}
/** A client frame: always masked, with the length in whichever of the three widths fits. */
function wsFrame(op: number, payload: Buffer): Buffer {
  const mask = randomBytes(4), n = payload.length;
  const head = Buffer.alloc(n < 126 ? 6 : n < 65536 ? 8 : 14);
  head[0] = 0x80 | op;
  if (n < 126) { head[1] = 0x80 | n; mask.copy(head, 2); }
  else if (n < 65536) { head[1] = 0x80 | 126; head.writeUInt16BE(n, 2); mask.copy(head, 4); }
  else { head[1] = 0x80 | 127; head.writeUInt32BE(0, 2); head.writeUInt32BE(n, 6); mask.copy(head, 10); }
  const out = Buffer.concat([head, payload]);
  for (let i = 0; i < n; i++) out[head.length + i] = payload[i]! ^ mask[i & 3]!;
  return out;
}
function tmpProfile(): string {
  const p = tmpdir() + "/interun-export-gate-profile-" + process.pid;
  mkdirSync(p, { recursive: true });
  return p;
}
/**
 * ⚠️ node:http WITH THE SOCKET DESTROYED, NOT global fetch — AND THE TEST RUNNER IS THE REASON.
 * fetch keeps its connections in a pool, so two Sockets stayed referenced after the browser had been
 * killed and the process sat there with nothing to do. Under `node --test` each file runs in a child
 * the runner waits on, so a file that will not exit is not a slow test, it is a hung suite.
 */
function getJson(host: string, port: number, path: string): Promise<string> {
  return new Promise((res, rej) => {
    let sock: any = null;
    const finish = (fn: (v: any) => void, v: any) => { try { sock && sock.destroy(); } catch (e) {} fn(v); };
    const req = httpRequest({ host, port, path, agent: false }, (r: any) => {
      let body = "";
      r.setEncoding("utf8");
      r.on("data", (c: string) => { body += c; });
      r.on("end", () => finish(res, body));
      r.on("error", (e: any) => finish(rej, e));
    });
    // ⚠️ THE REFUSED ATTEMPTS ARE THE ONES THAT LINGER. Polling starts before the browser is
    // listening, so the first connections fail — and a socket left behind by a failure holds the
    // event loop open exactly as a successful one does.
    req.on("socket", (s: any) => { sock = s; });
    req.on("error", (e: any) => finish(rej, e));
    req.setTimeout(2000, () => { req.destroy(new Error("timeout")); });
    req.end();
  });
}

/* ================================================================================================ *
 * THE FIXTURE — ONE RUN RECORD, IN THE SHAPE THE APP STORES                                        *
 * ================================================================================================ */

/**
 * ⚠️ A RUN RECORD, NOT A MODEL. The gate runs the whole pipeline, so this is what localStorage holds:
 * shareCardModel derives the template, the metrics, the verdict, the redacted route, the privacy
 * record and the filename from it exactly as it does on a phone.
 * ⚠️ AND IT CARRIES A THREE-PART PLACE, because coarseLocation must be seen to coarsen. A fixture
 * already carrying "Durham" would certify a privacy rule that had been deleted.
 */
export function gateRun(over: any = {}): any {
  return {
    id: "gate-run-1", t: "36' easy run", d: "Today", dateIso: "2026-08-17",
    dist: "6.31 km", time: "35:42", pace: "5:40 /km", distKm: 6.31, sec: 2142, avgPaceSec: 340,
    route: Array.from({ length: 61 }, (_, i) => {
      const f = i / 60;
      return { lat: 54.682 + f * 0.0182, lng: -1.216 + f * 0.0067 + Math.sin(f * 9) * 0.0016,
        t: Math.round(f * 2142) };
    }),
    splits: [351, 337, 336, 333, 334, 340].map((sec, i) => ({ km: i + 1, sec })),
    elevGain: 28, type: "easy", rpe: 3, rband: { min: 2, max: 4 },
    pband: { minSecPerKm: 320, maxSecPerKm: 370 }, pwin: { s: 0, e: 6310 },
    avgHr: 142, maxHr: 158, kcal: 412, cadence: 162,
    place: "Durham, County Durham, England",
    ...over,
  };
}

/** The eight card states the gate covers, per checklist section I, and why each one is here. */
/**
 * ⚠️ TWO SHAPES — THE PACK'S OWN REQUIRED FORMATS, AND SINCE 2026-08-20 THE ONLY TWO THERE ARE. Square
 * 1:1 was the contract's optional third and the transparent sticker was the owner's own addition; he
 * withdrew both ("i only want the two options if story and feed"), so this list follows SHARE_ASPECTS
 * rather than describing a superset of it — a gate that captures a shape the app cannot produce is a
 * gate measuring a renderer nobody can reach.
 * ⚠️ LISTED ONCE so the shoot loop, the crop seeding and the reflow comparison cannot cover different
 * sets: the reflow test is the one that can silently stop testing a shape, because it reads keys out of
 * the map rather than iterating an aspect list of its own.
 */
export const GATE_ASPECTS = ["story", "feed"];
export const GATE_CASES: { name: string; template: string | null; why: string; run: any;
  priv?: any; photo?: boolean }[] = [
  { name: "moment", template: "moment", why: "the reference composition", run: gateRun() },
  { name: "execution", template: "execution", why: "target adherence", run: gateRun() },
  { name: "progression", template: "progression", why: "split progression", run: gateRun() },
  { name: "route", template: "route", why: "the route as the artwork, over a photograph", run: gateRun() },
  // ⚠️ THE POSTER'S OTHER HALF, AND IT IS A CASE RATHER THAN AN AFTERTHOUGHT. The owner's ruling of
  // 2026-08-20 made the poster photo-OPTIONAL, so the matte topographic ground is now one branch of one
  // template instead of the whole of it — and it is the only card in the gate that draws with no
  // photograph at all, which is what exercises the flat-ground palette and the two no-probe scrim gates.
  { name: "route-bare", template: "route", why: "the poster on its own matte ground",
    run: gateRun(), photo: false },
  { name: "no-verdict", template: "moment", why: "pain suppresses the badge",
    run: gateRun({ pain: true }) },
  { name: "no-route", template: "moment", why: "indoor: no route at all",
    run: gateRun({ route: null }) },
  { name: "no-target", template: "moment", why: "a run by feel: no band to judge",
    run: gateRun({ pband: null, pwin: null }) },
  { name: "few-splits", template: "moment", why: "two kilometres: the ladder cannot progress",
    run: gateRun({ distKm: 2.02, dist: "2.02 km", sec: 690, time: "11:30",
      splits: [341, 349].map((sec, i) => ({ km: i + 1, sec })) }) },
];

/* ================================================================================================ *
 * THE CAPTURE                                                                                      *
 * ================================================================================================ */

export type Shot = {
  key: string; case: string; aspect: string; fit: string; fill: boolean;
  asked: string | null; drawn: string | null;
  bytes: Buffer; file: string; type: string; canvas: [number, number];
  sig: number[];                        // 12x16 grid of mean relative luminance, 0..1
  ink: number;                          // fraction of the grid that is neither floor nor ceiling
  rows: number[];                       // per-row mean luminance, for the reflow comparison
};
export type PrivacyShot = { label: string; sha: string; routeN: number; file: string; sig: number[];
  completedAt: string; place: string; dateLabel: string };
export type Gate = {
  lifted: Lifted;
  shots: Map<string, Shot>;
  quality: { q: number; tables: number[][] }[];
  sourcePhoto: { bytes: Buffer; exif: ExifInfo };
  dprShots: { label: string; sha: string; size: [number, number] | null }[];
  privacyShots: PrivacyShot[];
  modelProbe: any;
  refused: { placeholder: boolean; reason: string };
  /**
   * THE BOTTOM FADE'S OWN EDGE, MEASURED OFF RENDERED PIXELS (owner, ruling 8 item 4, 2026-08-21).
   * "the gradient at the bottom of the card ... needs a more natural fade, i can see the line where it
   * stops on the current one." Each entry is the discrete Laplacian of relative luminance at three lags,
   * taken at the top row of the fade and inside it, on a flat photograph so nothing in the column is the
   * picture. `linear` is the same card with SHARE_SCRIM.stops forced to 1, which reproduces the
   * shipped-before straight line EXACTLY — smootherstep sampled at its two endpoints is a line — so the
   * comparison is an A/B on one field rather than an appeal to history.
   */
  scrimEdge: { ground: string; aspect: string; a: number; fade: number;
    eased: { lag: number; bnd: number; inner: number }[];
    linear: { lag: number; bnd: number; inner: number }[] }[];
  ms: number;
};

const EVIDENCE = tmpdir() + "/interun-export-gate/";

let CACHE: Promise<Gate> | null = null;
/** One browser, one lift, every artefact. Every test in the gate reads this. */
export function gate(): Promise<Gate> { return CACHE || (CACHE = capture()); }

async function capture(): Promise<Gate> {
  const t0 = Date.now();
  const lifted = liftExportPipeline();
  const S = await openBrowser();
  try {
    await S.metrics(430, 932, 3);
    await S.ev("globalThis.PHOTODIAG={err:''};globalThis.state={};globalThis.profile={};" +
      "globalThis.PRIVACY={ends:false,map:false};globalThis.SHAREPRIV={};" +
      "globalThis.CARD=(function(){" + lifted.body + "})();'lifted'");

    // ---- the source photograph, and its GPS metadata ------------------------------------------
    const plainB64 = await S.ev(`(async () => {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 1800;
      const g = c.getContext('2d');
      const q = g.createLinearGradient(0, 0, 0, 1800);
      q.addColorStop(0, '#a6c9ea'); q.addColorStop(0.52, '#dfcfa8'); q.addColorStop(1, '#242c20');
      g.fillStyle = q; g.fillRect(0, 0, 1200, 1800);
      g.fillStyle = '#3b2f27'; g.beginPath(); g.ellipse(600, 940, 190, 440, 0, 0, 7); g.fill();
      g.fillStyle = '#f4efe4'; g.beginPath(); g.ellipse(600, 520, 96, 118, 0, 0, 7); g.fill();
      const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      const u = new Uint8Array(await b.arrayBuffer());
      let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
      return btoa(s); })()`, true);
    const withGps = spliceApp1(Buffer.from(plainB64, "base64"), buildGpsExif());
    await S.ev(`(async () => { const im = new Image();
      await new Promise((res, rej) => { im.onload = res; im.onerror = rej;
        im.src = 'data:image/jpeg;base64,${withGps.toString("base64")}'; });
      globalThis.PHOTO = { w: im.naturalWidth, h: im.naturalHeight, ox: 0.5, oy: 0.5, k: 1,
        id: 'gate-photo', bitmap: im };
      return im.naturalWidth + 'x' + im.naturalHeight; })()`, true);

    // ---- the shared in-page export + signature routine ----------------------------------------
    await S.ev(`globalThis.shoot = async function (run, opts, priv, fill) {
      globalThis.SHAREPRIV = priv || {};
      // ⚠️ THE FRAMING STORE IS SET THE WAY THE EDITOR SETS IT, because that is where the fit lives. A
      // photograph passed as an option carries no framing: shareCardModel reads it out of SPHOTO.crops
      // through shareCropRead, so without this every card in the gate is drawn at the default and the
      // fill-mode half of the ruling is untested.
      const crops = {};
      for (const t of ['moment', 'execution', 'progression', 'route']) {
        for (const a of ['story', 'feed']) crops[t + ':' + a] = { ox: 0.5, oy: 0.5, k: 1, fill: !!fill };
      }
      CARD.__setPhoto(opts.photo ? Object.assign({ crops: crops }, opts.photo) : null);
      const m = CARD.shareCardModel(run, opts);
      const c = CARD.shareCardCanvas(m, 1);
      // ⚠️ CALLED EXACTLY AS prepareShareCard CALLS IT, so the gate exercises the path the app takes
      // rather than a convenience overload of it.
      const f = await CARD.canvasToShareFile(c, CARD.shareFileName(m));
      const u = new Uint8Array(await f.arrayBuffer());
      let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
      // A coarse luminance signature, computed from the CANVAS rather than from the encoded bytes, so
      // it describes the picture and not the encoder.
      const GX = 12, GY = 16, ROWS = 96, g2 = c.getContext('2d');
      const px = g2.getImageData(0, 0, c.width, c.height).data;
      const lum = function (x, y) { const o = (y * c.width + x) * 4;
        return (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255; };
      const sig = [];
      for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
        let sum = 0, n = 0;
        const x0 = Math.floor(gx * c.width / GX), x1 = Math.floor((gx + 1) * c.width / GX);
        const y0 = Math.floor(gy * c.height / GY), y1 = Math.floor((gy + 1) * c.height / GY);
        for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) { sum += lum(x, y); n++; }
        sig.push(n ? sum / n : 0);
      }
      // A FINE row profile, because the reflow comparison has to resample it: at sixteen rows a
      // 70%-tall crop of the story lands between samples and the residual measures the resampling.
      const rows = [];
      for (let r = 0; r < ROWS; r++) {
        let sum = 0, n = 0;
        const y0 = Math.floor(r * c.height / ROWS), y1 = Math.max(y0 + 1, Math.floor((r + 1) * c.height / ROWS));
        for (let y = y0; y < y1; y += 2) for (let x = 0; x < c.width; x += 5) { sum += lum(x, y); n++; }
        rows.push(n ? sum / n : 0);
      }
      return { drawn: m.template, aspect: m.aspect, cw: c.width, ch: c.height, name: f.name,
        type: f.type, b64: btoa(s), sig: sig, rows: rows, routeN: m.route ? m.route.length : 0,
        // ⚠️ THE FIT THE MODEL ACTUALLY RESOLVED, carried out with the bytes: reported from m.photo
        // rather than echoed back from the argument, so a fit that never reaches the card is visible.
        fill: !!(m.photo && m.photo.fill),
        // ⚠️ THE UPSTREAM DATE GATE, CARRIED OUT WITH THE PICTURE. shareCardModel empties completedAt
        // when the date is hidden AND shareFileName refuses to print one, so the filename alone cannot
        // tell which of the two is doing the work — and a break of the upstream one is invisible in it.
        completedAt: m.completedAt, place: m.coarseLocation || "", dateLabel: m.dateLabel };
    }; 'ok'`);

    const opts = (aspect: string, tmpl: string | null, photo: boolean) =>
      JSON.stringify({ aspect, template: tmpl, routeOn: true, metrics: null })
        .replace(/}$/, ',"photo":' + (photo ? "globalThis.PHOTO" : "null") + "}");

    const shots = new Map<string, Shot>();
    // ⚠️ BOTH FIT MODES, BECAUSE THE OWNER'S RULING MADE TWO PICTURES OUT OF ONE. "whole" is the shipped
    // default (the entire photograph plus a blurred reflection of it in the space a tall card leaves) and
    // "fill" is the opt-in cover crop. Every dimension, encoding, metadata and reflow claim has to hold
    // for both, and the keys stay unsuffixed for "whole" so the existing guards keep reading the default.
    for (const c of GATE_CASES) {
      for (const aspect of GATE_ASPECTS) {
        for (const fit of ["whole", "fill"]) {
          // ⚠️ THE POSTER IS SHOT WITH A PHOTOGRAPH TOO, because the owner's ruling of 2026-08-20 made it
          // photo-optional and the byte claims have to hold for the picture-carrying version of every
          // template. Its photo-free rendering is covered by the "route-bare" case below, which is where
          // the matte topographic ground is actually exercised.
          const wantsPhoto = c.photo !== false && c.template !== null;
          const r = await S.ev(`shoot(${JSON.stringify(c.run)}, ${opts(aspect, c.template, wantsPhoto)}, {}, ${fit === "fill"})`, true);
          const bytes = Buffer.from(r.b64, "base64");
          const key = c.name + "/" + aspect + (fit === "fill" ? "/fill" : "");
          shots.set(key, { key, case: c.name, aspect, fit, fill: !!r.fill, asked: c.template,
            drawn: r.drawn, bytes,
            file: r.name, type: r.type, canvas: [r.cw, r.ch], sig: r.sig, rows: r.rows,
            ink: r.sig.filter((v: number) => v > 0.02 && v < 0.98).length / r.sig.length });
        }
      }
    }

    // ---- the encoder's quality ladder, from the very same canvas ------------------------------
    const ladder = await S.ev(`(async () => {
      const m = CARD.shareCardModel(${JSON.stringify(gateRun())},
        ${opts("story", "moment", true)});
      const c = CARD.shareCardCanvas(m, 1);
      const out = [];
      for (const q of [0.80, 0.86, 0.90, 0.92, 0.94, 0.98]) {
        const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
        const u = new Uint8Array(await b.arrayBuffer());
        let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
        out.push({ q: q, b64: btoa(s) });
      }
      return out; })()`, true);
    const quality = ladder.map((e: any) => ({ q: e.q, tables: jpegQuantTables(Buffer.from(e.b64, "base64")) }));

    // ---- the same export under three different screens ----------------------------------------
    const dprShots: Gate["dprShots"] = [];
    for (const [label, w, h, dpr] of [["small 1x", 320, 568, 1], ["phone 3x", 430, 932, 3],
      ["desktop 2x", 1440, 900, 2]] as [string, number, number, number][]) {
      await S.metrics(w, h, dpr);
      const r = await S.ev(`shoot(${JSON.stringify(gateRun())}, ${opts("story", "moment", true)}, {})`, true);
      const b = Buffer.from(r.b64, "base64");
      dprShots.push({ label: label + " dpr=" + dpr, sha: sha(b), size: imageSize(b) });
    }
    await S.metrics(430, 932, 3);

    // ---- the privacy states, driven through the app's own privacy record ----------------------
    const privacyShots: Gate["privacyShots"] = [];
    for (const [label, priv] of [
      ["route, ends shown", { ends: false }],
      ["route, ends hidden", { ends: true }],
      ["route hidden", { map: true }],
      ["location hidden", { ends: true, loc: true }],
      ["date hidden", { ends: true, date: true }],
    ] as [string, any][]) {
      const r = await S.ev(`shoot(${JSON.stringify(gateRun())}, ${opts("story", "moment", true)},` +
        JSON.stringify({ "gate-run-1": priv }) + ")", true);
      const b = Buffer.from(r.b64, "base64");
      privacyShots.push({ label, sha: sha(b), routeN: r.routeN, file: r.name, sig: r.sig,
        completedAt: r.completedAt, place: r.place, dateLabel: r.dateLabel });
    }


    // ---- a self-check on the lift, so a mis-stubbed harness cannot pass quietly ---------------
    const modelProbe = await S.ev(`(() => { globalThis.SHAREPRIV = {};
      const m = CARD.shareCardModel(${JSON.stringify(gateRun())}, ${opts("story", null, false)});
      return { template: m.template, place: m.coarseLocation, dateLabel: m.dateLabel,
        completedAt: m.completedAt, privacy: m.privacy, routeN: m.route ? m.route.length : 0,
        rawRouteN: 61, verdictState: m.verdict && m.verdict.status, pill: !!m.pill,
        metricKeys: (m.metrics || []).map(function (x) { return x.key; }),
        statKeys: (m.stats || []).map(function (x) { return x.key; }),
        distance: m.distance, units: m.units, file: CARD.shareFileName(m),
        bandMin: m.band && m.band.minSecPerKm, n: m.n, inBand: m.inBand }; })()`);

    // ---- and the one card that must never become a file ---------------------------------------
    // ⚠️ REACHING THAT STATE TAKES A RUN THAT FAILS ALL FOUR GATES, and since ruling 7 a missing
    // photograph is not one of them. Written as "no route, no photo" this probe measured a perfectly good
    // Moment card: the three data templates are gated on the SPLITS and the hero, not on the picture.
    const refused = await S.ev(`(() => { globalThis.SHAREPRIV = {};
      const m = CARD.shareCardModel(${JSON.stringify(gateRun({ route: null, splits: [], distKm: 0,
        dist: "0 km", time: "", sec: 0, pband: null, pwin: null }))},
        ${opts("story", null, false)});
      return { placeholder: m.template == null, reason: (m.eligibility && m.eligibility.moment || {}).why || '' }; })()`);

    // ---- the bottom fade's edge, from a rendered column ---------------------------------------
    // ⚠️ A FLAT PHOTOGRAPH, SO ANY STRUCTURE IN THE COLUMN IS THE SCRIM. On a real picture the fade's edge
    // has to be separated from the picture's own vertical structure, which is a judgement; on a flat
    // ground it is the only thing there and the number means one thing.
    // ⚠️ AND THE PROFILE IS SMOOTHED AND DIFFERENCED AT A LAG, because the fade changes alpha by well
    // under 1/255 per row: the delivered bytes step in whole units, so a per-row second difference is a
    // train of quantisation spikes and measures the encoder rather than the edge.
    await S.ev(`globalThis.scrimProfile = function (hex, aspect, blockTop, stops) {
      const gm = CARD.cardGeom(aspect), W = gm.W, H = gm.H;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = hex; g.fillRect(0, 0, W, H);
      const pw = 108, ph = Math.round(pw * H / W);
      const pc = document.createElement('canvas'); pc.width = pw; pc.height = ph;
      const pg = pc.getContext('2d');
      pg.fillStyle = hex; pg.fillRect(0, 0, pw, ph);
      const probe = { w: pw, h: ph, data: pg.getImageData(0, 0, pw, ph).data };
      const keep = CARD.__scrim().stops;
      CARD.__scrim().stops = stops;
      const plan = CARD.shareVeilPlan(probe, gm, { blockTop: blockTop, colours: CARD.shareScrimText() });
      CARD.shareVeilDraw(g, gm, plan);
      CARD.__scrim().stops = keep;
      const px = g.getImageData(0, 0, W, H).data;
      const lin = new Float64Array(256);
      for (let i = 0; i < 256; i++) { const v = i / 255;
        lin[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
      const raw = new Float64Array(H);
      for (let y = 0; y < H; y++) { let sum = 0, n = 0;
        for (let x = 0; x < W; x += 4) { const o = (y * W + x) * 4;
          sum += 0.2126 * lin[px[o]] + 0.7152 * lin[px[o + 1]] + 0.0722 * lin[px[o + 2]]; n++; }
        raw[y] = sum / n; }
      const r = new Float64Array(H);
      for (let y = 0; y < H; y++) { let sum = 0, n = 0;
        for (let j = y - 4; j <= y + 4; j++) if (j >= 0 && j < H) { sum += raw[j]; n++; }
        r[y] = sum / n; }
      const top = plan.fadeTop, bt = plan.blockTop - 10, out = [];
      for (const lag of [4, 8, 16]) {
        const d2 = function (y) { return r[y + lag] - 2 * r[y] + r[y - lag]; };
        let bnd = 0;
        for (let y = top - 1; y <= top + 1; y++) if (Math.abs(d2(y)) > Math.abs(bnd)) bnd = d2(y);
        let inner = 0;
        for (let y = top + lag + 2; y <= bt - lag - 2; y++) if (Math.abs(d2(y)) > Math.abs(inner)) inner = d2(y);
        out.push({ lag: lag, bnd: Math.abs(bnd), inner: Math.abs(inner) });
      }
      return { a: plan.a, fade: plan.blockTop - plan.fadeTop, prof: out };
    }; 'ok'`);
    const scrimEdge: Gate["scrimEdge"] = [];
    for (const [ground, hex] of [["white", "#ffffff"], ["mid", "#808080"], ["magenta", "#e015c8"],
      ["beach", "#d9d2c4"]] as [string, string][]) {
      for (const [aspect, blockTop] of [["story", 1090], ["feed", 680]] as [string, number][]) {
        const eased = await S.ev(`scrimProfile("${hex}", "${aspect}", ${blockTop}, CARD.__scrim().stops)`);
        const linear = await S.ev(`scrimProfile("${hex}", "${aspect}", ${blockTop}, 1)`);
        scrimEdge.push({ ground, aspect, a: eased.a, fade: eased.fade,
          eased: eased.prof, linear: linear.prof });
      }
    }

    const g: Gate = { lifted, shots, scrimEdge,
      quality, dprShots, privacyShots, modelProbe, refused,
      sourcePhoto: { bytes: withGps, exif: exifInfo(withGps) }, ms: Date.now() - t0 };
    writeEvidence(g);
    return g;
  } finally { S.close(); }
}

/**
 * The exports themselves, on disk, because checklist section H asks for attachable evidence and a
 * hash in a test log is not something anybody can look at.
 * ⚠️ OUTSIDE THE REPOSITORY. Sixteen 1080-wide cards are about 2 MB per run of the suite; committing
 * them would put a regenerable image in git, which is the same rule the route-map cache follows.
 */
function writeEvidence(g: Gate): void {
  try {
    mkdirSync(EVIDENCE, { recursive: true });
    // ⚠️ EVERY SLASH, NOT THE FIRST ONE. A key is case/aspect and, since the fit ruling, case/aspect/fill:
    // .replace("/", "-") left "moment-story/fill.jpg", which is a path into a directory that does not
    // exist, so the write threw, the catch below swallowed it and index.json was never written at all.
    // Measured before this: the evidence directory held 16 files and an index describing 16 shots while
    // the gate was capturing 32 — so the courtesy evidence had been silently a phase out of date.
    for (const s of g.shots.values()) {
      writeFileSync(EVIDENCE + s.key.replace(/\//g, "-") + ".jpg", s.bytes);
    }
    writeFileSync(EVIDENCE + "source-photo-with-gps.jpg", g.sourcePhoto.bytes);
    writeFileSync(EVIDENCE + "index.json", JSON.stringify({
      generated: new Date().toISOString(), ms: g.ms,
      lifted: { functions: g.lifted.fns.length, constStatements: g.lifted.consts },
      shots: [...g.shots.values()].map((s) => ({ key: s.key, drawn: s.drawn, size: imageSize(s.bytes),
        kind: imageKind(s.bytes), bytes: s.bytes.length, file: s.file, ink: Number(s.ink.toFixed(3)),
        icc: iccInfo(s.bytes).desc, exif: exifInfo(s.bytes).app1, sha: sha(s.bytes) })),
      dpr: g.dprShots, privacy: g.privacyShots.map((p) => ({ ...p, sig: undefined })),
    }, null, 1));
  } catch (e) { /* evidence is a courtesy; a read-only filesystem must not fail the gate */ }
}
export function evidenceDir(): string { return EVIDENCE; }

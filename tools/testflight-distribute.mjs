#!/usr/bin/env node
/**
 * ADD AN UPLOADED BUILD TO A TESTFLIGHT TESTER GROUP, FROM THE COMMAND LINE.
 *
 * ⚠️ WHY THIS EXISTS. xcodebuild can UPLOAD a build using Xcode's own signed-in session — this project's
 * notes record discovering that after wrongly concluding it was impossible — but that session does not
 * extend to managing tester groups. There is no CLI, no keychain item and no Xcode session that can add
 * a build to a group; the only route is the App Store Connect API, which needs a key. So the owner was
 * being asked to do the last step by hand after every build.
 *
 * ⚠️ IT NEEDS A KEY ONCE, AND THEN NEVER AGAIN. App Store Connect → Users and Access → Integrations →
 * App Store Connect API → generate a key with the App Manager role, download the .p8 (Apple lets you
 * download it exactly once), and put it at:
 *     ~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8
 * The Key ID is in the filename and the Issuer ID is on that same page.
 *
 * ⚠️ AND IT FAILS LOUDLY WITH THE FIX RATHER THAN SKIPPING. A distribution step that silently does
 * nothing reports a build as delivered to testers when it is sitting in App Store Connect untouched,
 * which is the exact class of failure this codebase refuses everywhere else.
 *
 *   node tools/testflight-distribute.mjs            # the newest processed build
 *   node tools/testflight-distribute.mjs 441        # a specific build number
 *   node tools/testflight-distribute.mjs 441 "Internal Testers"
 */
import { createSign } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BUNDLE_ID = "com.interun.app";
const KEY_DIR = join(homedir(), ".appstoreconnect", "private_keys");
const ISSUER_FILE = join(KEY_DIR, "issuer_id.txt");

function die(msg) { console.error("\n" + msg + "\n"); process.exit(1); }

function credentials() {
  let files = [];
  try { files = readdirSync(KEY_DIR).filter((f) => /^AuthKey_.+\.p8$/.test(f)); } catch (e) { files = []; }
  if (!files.length) {
    die("NO APP STORE CONNECT API KEY, SO NOTHING CAN BE DISTRIBUTED FROM HERE.\n" +
      "  1. App Store Connect -> Users and Access -> Integrations -> App Store Connect API\n" +
      "  2. Generate a key with the App Manager role and download the .p8 (once only)\n" +
      "  3. mkdir -p " + KEY_DIR + "\n" +
      "  4. Move it there, keeping Apple's filename: AuthKey_<KEYID>.p8\n" +
      "  5. Put the Issuer ID (same page) in " + ISSUER_FILE + "\n" +
      "Then re-run. Uploading a build does NOT need this; only distributing does.");
  }
  const keyId = /^AuthKey_(.+)\.p8$/.exec(files[0])[1];
  let issuer = process.env.ASC_ISSUER_ID || "";
  if (!issuer) {
    try { issuer = readFileSync(ISSUER_FILE, "utf8").trim(); } catch (e) { issuer = ""; }
  }
  if (!issuer) {
    die("FOUND THE KEY (" + keyId + ") BUT NOT THE ISSUER ID.\n" +
      "It is on the same App Store Connect page as the key. Either:\n" +
      "  echo '<issuer-id>' > " + ISSUER_FILE + "\n" +
      "or export ASC_ISSUER_ID=<issuer-id> before running this.");
  }
  return { keyId, issuer, pem: readFileSync(join(KEY_DIR, files[0]), "utf8") };
}

/** ES256, signed here rather than pulling in a JWT dependency — this repo has no runtime deps. */
function token({ keyId, issuer, pem }) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: keyId, typ: "JWT" });
  // ⚠️ 20 MINUTES IS APPLE'S CEILING and it refuses anything longer outright.
  const body = b64({ iss: issuer, iat: now, exp: now + 1140, aud: "appstoreconnect-v1" });
  const sig = createSign("SHA256").update(head + "." + body).end()
    .sign({ key: pem, dsaEncoding: "der" });
  // DER -> JOSE: two 32-byte integers, which is what ES256 requires and what der gives us wrapped.
  const r = sig[3], off = 4;
  const rBuf = sig.subarray(off, off + r), sLen = sig[off + r + 1];
  const sBuf = sig.subarray(off + r + 2, off + r + 2 + sLen);
  const pad = (b) => Buffer.concat([Buffer.alloc(Math.max(0, 32 - b.length)), b.subarray(Math.max(0, b.length - 32))]);
  return head + "." + body + "." + Buffer.concat([pad(rBuf), pad(sBuf)]).toString("base64url");
}

async function api(jwt, path, init = {}) {
  const res = await fetch("https://api.appstoreconnect.apple.com" + path, {
    ...init,
    headers: { Authorization: "Bearer " + jwt, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = (JSON.parse(text).errors || []).map((e) => e.title + ": " + e.detail).join("; ") || text; } catch (e) {}
    die("App Store Connect refused " + init.method + " " + path + "\n  " + res.status + " " + detail);
  }
  return text ? JSON.parse(text) : {};
}

const want = process.argv[2] || "";
const groupWanted = process.argv[3] || "";
const jwt = token(credentials());

const apps = await api(jwt, "/v1/apps?filter[bundleId]=" + encodeURIComponent(BUNDLE_ID));
if (!apps.data.length) die("No app with bundle id " + BUNDLE_ID + " on this account.");
const app = apps.data[0];

const builds = await api(jwt, "/v1/builds?filter[app]=" + app.id + "&limit=20&sort=-version");
if (!builds.data.length) die("No builds at all for " + BUNDLE_ID + ".");
const build = want
  ? builds.data.find((b) => String(b.attributes.version) === String(want))
  : builds.data[0];
if (!build) {
  die("Build " + want + " is not in App Store Connect yet. The newest ones there are: " +
    builds.data.slice(0, 6).map((b) => b.attributes.version).join(", ") +
    "\nA freshly uploaded build takes a few minutes to appear, and longer to finish processing.");
}
const state = build.attributes.processingState;
// ⚠️ REPORTED, NOT WAITED ON. Apple will refuse the association while a build is still processing, and
// telling the owner that plainly beats a script that appears to hang.
if (state !== "VALID") {
  die("Build " + build.attributes.version + " is " + state + ", not VALID.\n" +
    "App Store Connect will not add a build to a group until it has finished processing. Try again in " +
    "a few minutes.");
}

const groups = await api(jwt, "/v1/betaGroups?filter[app]=" + app.id + "&limit=50");
if (!groups.data.length) die("This app has no TestFlight groups yet. Create one in App Store Connect first.");
const group = groupWanted
  ? groups.data.find((g) => g.attributes.name === groupWanted)
  : groups.data.find((g) => g.attributes.isInternalGroup) || groups.data[0];
if (!group) {
  die("No group called " + JSON.stringify(groupWanted) + ". Groups on this app: " +
    groups.data.map((g) => g.attributes.name).join(", "));
}

// ⚠️ ALREADY-ADDED IS A SUCCESS, NOT AN ERROR — the same rule this project applies to a duplicate Strava
// upload. Re-running after a partial failure must not read as a fresh problem.
const already = await api(jwt, "/v1/betaGroups/" + group.id + "/builds?limit=200");
if (already.data.some((b) => b.id === build.id)) {
  console.log("Build " + build.attributes.version + " is already in \"" + group.attributes.name + "\".");
  process.exit(0);
}

await api(jwt, "/v1/betaGroups/" + group.id + "/relationships/builds", {
  method: "POST",
  body: JSON.stringify({ data: [{ type: "builds", id: build.id }] }),
});
console.log("Build " + build.attributes.version + " added to \"" + group.attributes.name + "\"" +
  (group.attributes.isInternalGroup ? " (internal — no review needed)" : " (external — needs Beta App Review)") + ".");

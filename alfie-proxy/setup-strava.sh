#!/usr/bin/env bash
#
# One command that finishes the Strava setup, so it is not five commands to remember.
#
# It creates the token store, writes its id into wrangler.toml, hands Cloudflare the Strava
# credentials from ../strava-secret.txt, deploys, and then prints the two things you have to paste
# somewhere by hand.
#
# ⚠️ IT NEVER PRINTS A SECRET AND NEVER WRITES ONE TO DISK. The values are piped straight from the
# gitignored file into `wrangler secret put`, which does not echo them. Nothing here ends up in the
# repo, in your shell history, or in this script's output.
#
# Safe to run more than once: an existing token store is reused rather than replaced (replacing it
# would sign out every runner who had connected).
set -euo pipefail

cd "$(dirname "$0")"
WR="./node_modules/.bin/wrangler"
SECRETS="../strava-secret.txt"

say()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m%s\033[0m\n\n' "$1" >&2; exit 1; }

# ---- Checks, before anything is changed ----------------------------------------------------------
[ -x "$WR" ] || fail "Wrangler is not installed. Run:  cd alfie-proxy && npm install"
[ -f "$SECRETS" ] || fail "Cannot find strava-secret.txt in the repo root. It holds your Strava client id and secret."

# ⚠️ CHECK THE OUTPUT, NOT THE EXIT CODE. `wrangler whoami` exits 0 even when it is telling you
# "You are not authenticated" — so an exit-code guard sails straight past and the script fails later
# on a confusing Cloudflare error instead of the one sentence that actually helps.
if ! "$WR" whoami 2>&1 | grep -q "Account Name\|Account ID"; then
  fail "You are not signed in to Cloudflare yet.

Run this, click Allow in the browser that opens, then run me again:

  cd alfie-proxy && ./node_modules/.bin/wrangler login"
fi

CLIENT_ID="$(grep '^STRAVA_CLIENT_ID=' "$SECRETS" | cut -d= -f2- | tr -d '[:space:]')"
CLIENT_SECRET="$(grep '^STRAVA_CLIENT_SECRET=' "$SECRETS" | cut -d= -f2- | tr -d '[:space:]')"
[ -n "$CLIENT_ID" ] || fail "STRAVA_CLIENT_ID is missing from strava-secret.txt"
[ -n "$CLIENT_SECRET" ] || fail "STRAVA_CLIENT_SECRET is missing from strava-secret.txt"

say "1/5  Token store"
# Find it by title rather than parsing the output of `create`, so this works whether it already
# existed or not.
# ⚠️ WRANGLER 4 TITLES IT EXACTLY WHAT YOU ASKED FOR — "STRAVA" — not "<worker name>-<binding>",
# which older versions did and which this script originally assumed. That assumption made it create
# the namespace successfully and then fail to find its own handiwork, reporting "could not create"
# about a thing it had just created. Both spellings are accepted so neither version can break it.
find_kv() {
  "$WR" kv namespace list 2>/dev/null | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      try {
        const j = JSON.parse(s.slice(s.indexOf("[")));
        const m = j.find((n) => n.title === "STRAVA" || n.title === "alfie-proxy-STRAVA");
        if (m) process.stdout.write(m.id);
      } catch {}
    });'
}

KV_ID="$(find_kv)"
if [ -n "$KV_ID" ]; then
  echo "     already exists, reusing it (so nobody gets signed out)"
else
  CREATE_OUT="$("$WR" kv namespace create STRAVA 2>&1 || true)"
  KV_ID="$(find_kv)"
  if [ -z "$KV_ID" ]; then
    printf '%s\n' "$CREATE_OUT" >&2
    fail "Could not create the token store — Cloudflare's own message is just above."
  fi
  echo "     created"
fi

# Write the real id into wrangler.toml in place of the placeholder.
node -e '
  const fs = require("fs");
  const p = "wrangler.toml";
  const before = fs.readFileSync(p, "utf8");
  const after = before.replace(/^id = ".*"$/m, "id = \"" + process.argv[1] + "\"");
  if (before !== after) fs.writeFileSync(p, after);
  console.log(before === after ? "     wrangler.toml already had it" : "     wrangler.toml updated");
' "$KV_ID"

say "2/5  Strava credentials"
# ⚠️ THE VALUE IS PIPED IN, WHICH IS ALSO WHAT MAKES IT NON-INTERACTIVE — wrangler reads stdin and asks
# nothing. It never echoes the value, so nothing reaches this script's output or the shell history.
#
# ⚠️ AND EVERY FAILURE IS REPORTED. The first version wrote `... --force >/dev/null 2>&1 && echo sent`.
# There is no --force flag on `wrangler secret put`, so all three calls failed — and the shape of that
# line hid it twice over: the output was thrown away, and `set -e` does not fire on the left side of
# `&&`, so the script sailed on and DEPLOYED A WORKER WITH NO CREDENTIALS. That Worker answers every
# request with "not configured", which reads as a bug in the app. Never silence a command whose success
# you are about to assume.
put_secret() {
  local name="$1" value="$2" log
  log="$(mktemp)"
  if printf '%s' "$value" | "$WR" secret put "$name" >"$log" 2>&1; then
    rm -f "$log"; echo "     $name sent"
  else
    printf '%s\n' "--- Cloudflare said: ---" >&2; cat "$log" >&2; rm -f "$log"
    fail "Could not set $name. Nothing else has been changed."
  fi
}
put_secret STRAVA_CLIENT_ID "$CLIENT_ID"
put_secret STRAVA_CLIENT_SECRET "$CLIENT_SECRET"
# The native app's own origin (interun://app) is always allowed by the Worker itself, so only the
# public web version needs naming here.
put_secret ALLOWED_ORIGINS "https://padder1980.github.io"

# ⚠️ AND THEN CHECK THEY ARE ACTUALLY THERE. A deploy with no credentials looks identical to a healthy
# one until a runner taps Connect, so the script proves it rather than trusting three exit codes.
MISSING="$("$WR" secret list 2>/dev/null | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    let names=[];
    try { names = JSON.parse(s.slice(s.indexOf("["))).map((x) => x.name); } catch {}
    const want = ["STRAVA_CLIENT_ID","STRAVA_CLIENT_SECRET","ALLOWED_ORIGINS"];
    process.stdout.write(want.filter((w) => !names.includes(w)).join(", "));
  });')"
[ -z "$MISSING" ] || fail "These did not stick, so Strava would fail for every runner: $MISSING"
echo "     all three confirmed on the server"

say "3/5  Deploy"
DEPLOY_LOG="$(mktemp)"
"$WR" deploy 2>&1 | tee "$DEPLOY_LOG" | grep -E "Uploaded|Deployed|https://" || true
URL="$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | head -1 || true)"
rm -f "$DEPLOY_LOG"
[ -n "$URL" ] || fail "It deployed but did not print an address. Run 'cd alfie-proxy && ./node_modules/.bin/wrangler deploy' and look for the https://...workers.dev line."

HOST="${URL#https://}"

# ---- Bake the address into the app, so nobody else ever pastes anything -------------------------
# ⚠️ THIS IS WHAT MAKES STRAVA ONE TAP FOR EVERY OTHER RUNNER. The paste box is a development tool;
# without a shipped default it is the only route to a server, and asking someone who downloaded a
# running app to type in a URL is not a connect flow. The address is not a secret — the client secret
# is, and that never leaves the Worker.
say "4/5  Teach the app where its server is"
cd ..
# ⚠️ "ALREADY CORRECT" IS SUCCESS, NOT FAILURE. The first version treated an unchanged file as "could
# not find the constant" and aborted — so re-running the script after it had already worked reported a
# fault it had itself fixed. Look for the constant first, then compare, then write.
node -e '
  const fs = require("fs");
  const p = "web/app.ts";
  const src = fs.readFileSync(p, "utf8");
  const re = /const STRAVA_SERVER = "([^"]*)";/;
  const found = re.exec(src);
  if (!found) { console.error("     could not find STRAVA_SERVER in web/app.ts — set it by hand"); process.exit(1); }
  if (found[1] === process.argv[1]) { console.log("     web/app.ts already had it"); process.exit(0); }
  fs.writeFileSync(p, src.replace(re, "const STRAVA_SERVER = \"" + process.argv[1] + "\";"));
  console.log("     web/app.ts updated");
' "$URL"
node web/app.ts >/dev/null && echo "     app rebuilt"
# ⚠️ THE BUILD MIRRORS web/voices/ OVER THE COMMITTED docs/voices/, and web/voices/ is gitignored — so
# on a machine whose local copy is stale or partial, simply building here would silently delete most of
# the shipped coach audio (measured once: 250 files rewritten, the manifest cut from 11,908 lines to
# 1,268). This script has no business touching audio, so it puts it straight back.
git checkout -- docs/voices/ 2>/dev/null && echo "     coach audio left untouched" || true
node --test >/dev/null 2>&1 && echo "     tests still pass" || echo "     ⚠️  tests FAILED — tell Claude before committing"
cd alfie-proxy

say "5/5  Two things left, both by hand"
cat <<EOF

  A. Tell Strava it is allowed to send people back here.
     Open:  https://www.strava.com/settings/api
     Find:  Authorization Callback Domain
     Put in EXACTLY this, nothing else — no https://, no slash:

         $HOST

     Then press Save on that page.

  B. Tell the app where its server is.
     In Inte-Run:  Support  ›  Apps & devices  ›  Strava
     Paste:

         $URL

     Tap "Use this server", then "Connect to Strava".

     (Only needed on THIS phone, because its app was built before the address existed.
      Every future build already has it, so everyone else just taps Connect.)

  Then open any run in your Logbook and tap "Send to Strava".

  One last thing: web/app.ts changed, so commit it —
      git add web/app.ts docs web/app.html && git commit -m "Ship the Strava server address"

EOF

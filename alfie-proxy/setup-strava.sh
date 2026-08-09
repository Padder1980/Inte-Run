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

say "1/4  Token store"
# The title Cloudflare gives it is "<worker name>-<binding>". Look it up rather than parsing the
# output of `create`, so this works whether it already existed or not.
KV_TITLE="alfie-proxy-STRAVA"
KV_ID="$("$WR" kv namespace list 2>/dev/null | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try { const j=JSON.parse(s.slice(s.indexOf("["))); const m=j.find(n=>n.title===process.argv[1]);
          if (m) process.stdout.write(m.id); } catch {}
  });' "$KV_TITLE")"

if [ -n "$KV_ID" ]; then
  echo "     already exists, reusing it (so nobody gets signed out)"
else
  "$WR" kv namespace create STRAVA >/dev/null 2>&1 || true
  KV_ID="$("$WR" kv namespace list 2>/dev/null | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      try { const j=JSON.parse(s.slice(s.indexOf("["))); const m=j.find(n=>n.title===process.argv[1]);
            if (m) process.stdout.write(m.id); } catch {}
    });' "$KV_TITLE")"
  [ -n "$KV_ID" ] || fail "Could not create the token store. Run this to see why:
  cd alfie-proxy && ./node_modules/.bin/wrangler kv namespace create STRAVA"
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

say "2/4  Strava credentials"
# ⚠️ Piped, never printed, never echoed by wrangler. --force skips the "overwrite?" prompt so this
# stays a single non-interactive command when it is re-run.
printf '%s' "$CLIENT_ID"     | "$WR" secret put STRAVA_CLIENT_ID     --force >/dev/null 2>&1 && echo "     client id sent"
printf '%s' "$CLIENT_SECRET" | "$WR" secret put STRAVA_CLIENT_SECRET --force >/dev/null 2>&1 && echo "     client secret sent"
# The native app's own origin (interun://app) is always allowed by the Worker itself, so only the
# public web version needs naming here.
printf '%s' "https://padder1980.github.io" | "$WR" secret put ALLOWED_ORIGINS --force >/dev/null 2>&1 && echo "     allowed website set"

say "3/4  Deploy"
DEPLOY_LOG="$(mktemp)"
"$WR" deploy 2>&1 | tee "$DEPLOY_LOG" | grep -E "Uploaded|Deployed|https://" || true
URL="$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | head -1 || true)"
rm -f "$DEPLOY_LOG"
[ -n "$URL" ] || fail "It deployed but did not print an address. Run 'cd alfie-proxy && ./node_modules/.bin/wrangler deploy' and look for the https://...workers.dev line."

HOST="${URL#https://}"

say "4/4  Two things left, both by hand"
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

  Then open any run in your Logbook and tap "Send to Strava".

EOF

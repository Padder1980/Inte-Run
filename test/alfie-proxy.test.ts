import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Ask Alfie's optional remote brain.
 *
 * ⚠️ THE RULE THIS FILE EXISTS TO ENFORCE: a public URL that spends the owner's own money must have a
 * ceiling, and the ceiling must be checked before the money is spent. This is a different risk from
 * the Strava half of the same Worker — a Strava device key is useless to a stranger, whereas an Alfie
 * question costs real money on the owner's Anthropic account, and CORS does not stop curl.
 */
const workerRaw = () => readFileSync(new URL("../alfie-proxy/src/worker.ts", import.meta.url), "utf8");
/**
 * ⚠️ COMMENTS STRIPPED. Three guards in this file matched their own explanatory comments, which quote
 * the very strings they forbid — a guard that fires on the prose describing it is worse than no guard,
 * because the obvious "fix" is to delete the assertion.
 */
const worker = () => workerRaw()
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|\s)\/\/.*$/, "")).join("\n");
const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

function fn(name: string): string {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name);
  const end = html.indexOf("\nfunction ", at + 10);
  return html.slice(at, end > at ? end : at + 4000);
}

test("⚠️ the spend ceiling is checked before the model is called", () => {
  const src = worker();
  const check = src.indexOf("await overLimit(");
  const call = src.indexOf("client.messages.create(");
  assert.ok(check > 0, "there is no rate limit at all — a public URL spending real money");
  assert.ok(call > 0, "the model call has moved; this guard cannot see it");
  assert.ok(check < call, "the limit is checked after the model runs, by which point the money is spent");
  // ⚠️ A GLOBAL CAP IS THE ONE THAT ACTUALLY BOUNDS A STRANGER. Per-device limits bound an honest
  // runner; anyone with a script can mint a fresh device id per request, so a per-device-only design
  // has no ceiling at all.
  assert.match(src, /GLOBAL_DAILY/, "there is no global daily cap, so per-device limits can be bypassed by rotating ids");
  assert.match(src, /rl:all:/, "the global cap is declared but never counted against");
  // Being over the limit must be a non-200, so the app falls back to its on-device answers.
  assert.match(src, /status: 429/, "a throttled question does not return an error the app can fall back from");
});

test("⚠️ max_tokens leaves room for thinking, which now shares it", () => {
  // ⚠️ On the current model, thinking is ON whenever the request omits a thinking field — a silent
  // change from claude-opus-4-8. max_tokens caps thinking AND the answer together, so the 1024 this
  // shipped with would have been spent reasoning and then truncated Alfie mid-sentence.
  const src = worker();
  const max = /const MAX_TOKENS = (\d+)/.exec(src);
  assert.ok(max, "MAX_TOKENS is gone, so nothing states the thinking+answer ceiling");
  assert.ok(Number(max![1]) >= 2048,
    `max_tokens is ${max![1]} — too tight once thinking shares the budget; the answer truncates`);
  // ⚠️ AND THINKING IS NOT DISABLED TO SAVE TOKENS. With thinking off this model can leak its
  // internal <thinking> tags into the visible reply — here, straight into a coaching answer.
  assert.ok(!/thinking:\s*\{\s*type:\s*"disabled"/.test(src),
    "thinking is disabled, which risks internal tags leaking into a runner's answer; lower effort instead");
  assert.match(src, /effort: "low"/, "effort is the cost lever and it is not set");
});

test("⚠️ a refusal hands the question back to the app, not a canned apology", () => {
  const src = worker();
  const at = src.indexOf('stop_reason === "refusal"');
  assert.ok(at > 0, "a refusal is not handled — reading content[0] on one throws, it is empty");
  // Non-200 so alfieLocalAnswer runs: for a running app the curated on-device answer beats an apology.
  const after = src.slice(at, at + 200);
  assert.match(after, /status: 502/, "a refusal returns 200, so the app never falls back to its own answer");
  // ⚠️ And it is checked before the content is read.
  assert.ok(at < src.indexOf("response.content"), "the refusal check runs after content is read");
});

test("⚠️ Alfie's device id is not a credential, and not Strava's", () => {
  const src = fn("alfieDevice");
  assert.match(src, /crypto\.getRandomValues/, "the device id is not from a cryptographic source");
  // ⚠️ REUSING THE STRAVA DEVICE KEY WOULD SEND A REAL CREDENTIAL ON EVERY QUESTION. That key
  // authorises uploads to a runner's Strava account; this one only consumes a question quota.
  assert.ok(!/stravaCfg|stravaDeviceKey/.test(src),
    "Alfie reuses the Strava device key, sending an upload credential with every question");
  assert.match(fn("alfieRemote"), /device: alfieDevice\(\)/, "the device id is never sent, so nothing can be bounded");
});

test("⚠️ one resolver decides whether a server is configured", () => {
  const html = page();
  // ⚠️ THE SUPPORT PAGE'S CONSENT COPY IS DERIVED FROM IT, NOT WRITTEN BY HAND. That page tells the
  // runner whether their questions leave the phone; a hardcoded claim there is the sentence a worried
  // runner reads most carefully, and it must track the code.
  assert.match(html, /const ALFIE_SERVER = "/, "there is no shipped server address for Alfie");
  assert.match(fn("alfieBase"), /alfieCfg\(\)\.proxy \|\| ALFIE_SERVER/,
    "a hand-set override no longer wins over the shipped default");
  const set = /const ALFIE_SERVER = "([^"]*)"/.exec(html);
  if (set && set[1]) {
    assert.match(set![1]!, /^https:\/\/[^\s/]+$/, "the shipped Alfie address must be https with no path");
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sessionIdFor } from "../src/plan/generate-plan.ts";

/**
 * STAGE B3 (2026-10-02) — a time of day for a planned session, carried into the calendar file and the
 * reminders.
 *
 * PLAN.md's own verification: "parse the .ics and the schedule item". Both are built here by the real
 * functions lifted out of the built page, over a two-week fixture around the real today, and read back
 * field by field — a timed session is a timed event ending when the plan says it ends, with an alert half
 * an hour before, and its reminder moves to half an hour before it; everything else is unchanged.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function applySessionTime(");
  assert.ok(marker >= 0, "applySessionTime is not in the build — run node web/app.ts");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  return html.slice(open + 8, close);
}
const SRC = appScript();
function fnBody(name: string): string {
  const at = SRC.indexOf("function " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the build");
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constStmt(name: string): string {
  const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
  assert.ok(at >= 0, "no const " + name + " in the build");
  let d = 0;
  for (let i = at; i < SRC.length; i++) {
    const c = SRC[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return SRC.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}
const decomment = (s: string) =>
  s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ISO(d); };
const TODAY = ISO(new Date());
const TODAY_DOW = (new Date(TODAY + "T00:00:00Z").getUTCDay() + 6) % 7;
const THIS_MON = addDays(TODAY, -TODAY_DOW);
const NEXT_MON = addDays(THIS_MON, 7);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// A session id in the engine's real form: the week's Monday, the day and the type ("2026-10-12-d1-easy").
const ID = (w: number, d: number, t: string) => (w === 1 ? THIS_MON : NEXT_MON) + "-d" + d + "-" + t;

/** Two plan weeks, this one and the next, one 45-minute session a day. */
function fixture() {
  const mk = (w: number) => DAYS.map((dn, d) => ({ id: ID(w, d, "easy"), day: dn, dayIndex: d, type: "easy",
    title: "Easy " + dn, durMin: 45, distKm: 8, pace: "6:00/km" }));
  return { PLAN: { weeks: [THIS_MON, NEXT_MON].map((startIso, wi) => ({ index: wi + 1, startIso, sessions: mk(wi + 1) })) } };
}

const FNS = ["isoAdd", "todayIso", "pad2", "icsDate", "icsStamp", "icsTrigger", "icsEsc", "icsFloat", "buildSessionsIcs",
  "hmMinutes", "hmFromMinutes", "hmValid", "loadTimes", "saveTimes", "sessionTimeAt", "setSessionTime", "planSessionRef",
  "effDay", "genDay", "ovTo", "ovFrom", "reminderSlotsFor", "buildReminderSchedule", "sessionsForIso", "sessionTimeNote",
  "legacySid", "sidKeys"];
const CONSTS = ["TIME_KEY", "NATIVE_NOTIFY_CAP", "PRIMARY_TYPES"];

function sandbox(remind: Record<string, unknown> = { enabled: true, time: "07:30", time2: "" }) {
  const store: Record<string, string> = {};
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const { PLAN } = fixture();
  const state: any = { dayOverride: {} };
  const env: Record<string, unknown> = {
    PLAN, state, localStorage, REMIND: remind, EXTRA: [], RC: { sessionIdFor },
    randomQuote: () => ["Run", ""], extraSession: () => null,
  };
  const src = CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  const api = new Function(...names, src + "\nreturn {" + FNS.join(",") + "};")(...names.map((n) => env[n]));
  return { api, store, state, PLAN };
}
/** The .ics, split into events keyed by their session id. */
function events(ics: string) {
  assert.ok(ics.endsWith("\r\n"), "the calendar file's lines are not CRLF-terminated");
  const out: Record<string, string[]> = {};
  const blocks = ics.split("BEGIN:VEVENT\r\n").slice(1);
  for (const b of blocks) {
    const lines = b.split("END:VEVENT")[0]!.split("\r\n").filter(Boolean);
    const uid = lines.find((l) => l.startsWith("UID:"))!;
    out[/interun-\d+-(.+)@interun\.app/.exec(uid)![1]!] = lines;
  }
  return out;
}
const line = (lines: string[], key: string) => lines.find((l) => l.startsWith(key)) || null;
const compact = (iso: string) => iso.split("-").join("");

/* ------------------------------------------------------------------------------------------------ */

test("a time is the platform's own HH:MM, normalised, and anything else is no time at all", () => {
  const { api } = sandbox();
  assert.equal(api.hmValid("07:30"), "07:30");
  assert.equal(api.hmValid("7:05"), "07:05");
  assert.equal(api.hmValid("23:59"), "23:59");
  for (const bad of ["24:00", "12:60", "", "abc", "7", "07:30:00"]) assert.equal(api.hmValid(bad), "", JSON.stringify(bad) + " was accepted");
  assert.equal(api.hmFromMinutes(17 * 60 + 30), "17:30");
  assert.equal(api.hmFromMinutes(-20), "00:00", "a reminder before midnight wrapped into a time that does not exist");
});

test("BLOCKER: a session's time is matched on its week and id — a drag keeps it, another week never borrows it", () => {
  const { api, state } = sandbox();
  const tue = addDays(NEXT_MON, 1);
  api.setSessionTime(ID(2, 1, "easy"), tue, "18:00");
  assert.equal(api.sessionTimeAt(tue, ID(2, 1, "easy")), "18:00");
  // Dragged to Thursday of the same week: the session keeps the time the runner gave it.
  state.dayOverride[ID(2, 1, "easy")] = { to: 3, from: 1 };
  assert.equal(api.sessionTimeAt(addDays(NEXT_MON, 3), ID(2, 1, "easy")), "18:00", "a dragged session lost its time");
  // The same id asked about in a different week (a different plan's week 2, say) has no time.
  assert.equal(api.sessionTimeAt(addDays(THIS_MON, 1), ID(2, 1, "easy")), "", "a time leaked to another week");
  // ⚠️ AND THE CASE THAT NEEDS THE DATE: a time set for ID(2, 1, "easy") in a plan whose week 2 fell a fortnight
  // later. This plan's week 2 holds an id of that name too — and must not inherit a time set for another day.
  const other = sandbox();
  other.api.setSessionTime(ID(2, 1, "easy"), addDays(NEXT_MON, 15), "06:00");
  assert.equal(other.api.sessionTimeAt(addDays(NEXT_MON, 1), ID(2, 1, "easy")), "", "a time set in another plan's week was borrowed by id alone");
  // Clearing removes it.
  api.setSessionTime(ID(2, 1, "easy"), tue, "");
  assert.equal(api.sessionTimeAt(tue, ID(2, 1, "easy")), "");
  // A rubbish value is refused rather than stored.
  api.setSessionTime(ID(2, 2, "easy"), addDays(NEXT_MON, 2), "99:99");
  assert.deepEqual(api.loadTimes(), {}, "an impossible time was stored");
});

test("BLOCKER: the calendar file — a timed session is a timed event with the plan's length and a 30-minute alert", () => {
  const { api } = sandbox();
  const wed = addDays(NEXT_MON, 2), sun = addDays(NEXT_MON, 6);
  api.setSessionTime(ID(2, 2, "easy"), wed, "18:00");
  api.setSessionTime(ID(2, 6, "easy"), sun, "23:30");
  const ev = events(api.buildSessionsIcs());
  const timed = ev[ID(2, 2, "easy")]!;
  assert.equal(line(timed, "DTSTART"), "DTSTART:" + compact(wed) + "T180000", "the timed session does not start at its time");
  assert.equal(line(timed, "DTEND"), "DTEND:" + compact(wed) + "T184500", "the event does not last the plan's 45 minutes");
  assert.equal(line(timed, "TRIGGER"), "TRIGGER:-PT30M", "the alert is not half an hour before");
  assert.ok(!timed.some((l) => /DTSTART;VALUE=DATE/.test(l)), "a timed session is still an all-day event");
  // ⚠️ FLOATING TIME: no Z and no TZID, so 18:00 is 18:00 on whatever phone opens it.
  assert.ok(!/Z$|TZID/.test(line(timed, "DTSTART")!), "the start carries a timezone");
  // ⚠️ AND MIDNIGHT IS CROSSED AS A CALENDAR, NOT A CLOCK: 23:30 + 45 min ends 00:15 the next day.
  assert.equal(line(ev[ID(2, 6, "easy")]!, "DTEND"), "DTEND:" + compact(addDays(sun, 1)) + "T001500");
  // Everything else is the all-day event it always was, alarmed at the morning reminder time.
  const plain = ev[ID(2, 0, "easy")]!;
  assert.equal(line(plain, "DTSTART"), "DTSTART;VALUE=DATE:" + compact(NEXT_MON));
  assert.equal(line(plain, "DTEND"), null, "an all-day event grew an end time");
  assert.equal(line(plain, "TRIGGER"), "TRIGGER;RELATED=START:PT7H30M");
});

test("BLOCKER: the reminder schedule — slot a moves to 30 minutes before a timed session, and says when", () => {
  const { api } = sandbox({ enabled: true, time: "07:30", time2: "20:00" });
  const wed = addDays(NEXT_MON, 2);
  api.setSessionTime(ID(2, 2, "easy"), wed, "18:00");
  const items = api.buildReminderSchedule();
  const p = wed.split("-").map(Number);
  const forDay = items.filter((x: any) => x.y === p[0] && x.mo === p[1] && x.d === p[2]);
  const a = forDay.find((x: any) => /-a$/.test(x.id)), b = forDay.find((x: any) => /-b$/.test(x.id));
  assert.ok(a && b, "the timed day lost a reminder");
  assert.deepEqual([a.h, a.mi], [17, 30], "the main reminder is not half an hour before the session");
  assert.deepEqual([b.h, b.mi], [20, 0], "the second reminder moved, and the runner never asked it to");
  assert.match(a.title, /^Today at 18:00: Easy Wed$/, "the reminder does not say when the session is");
  // An untimed day keeps the morning reminder and the old title.
  const thu = addDays(NEXT_MON, 3).split("-").map(Number);
  const plain = items.find((x: any) => x.y === thu[0] && x.mo === thu[1] && x.d === thu[2] && /-a$/.test(x.id));
  assert.deepEqual([plain.h, plain.mi], [7, 30]);
  assert.match(plain.title, /^Today: Easy Thu$/);
  // And the one definition is what the in-page timers read too.
  assert.match(decomment(fnBody("initReminders")), /reminderSlotsFor\(todayIso\(\), sessionsForIso\(todayIso\(\)\)\[0\]\)/,
    "the Home Screen app's timers do not read the same slots as the native schedule");
  assert.match(decomment(fnBody("buildReminderSchedule")), /const slots = reminderSlotsFor\(iso, s\);/);
});

test("BLOCKER: a time is pruned only a week after its day — never because a break took its session out", () => {
  // seedDone is the pruner (PLAN.md). Lifted with everything it calls, the plan's own sessions included.
  const store: Record<string, string> = {};
  const localStorage = { getItem: (k: string) => (k in store ? store[k]! : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } };
  const { PLAN } = fixture();
  // ⚠️ THE SESSION THIS TIME BELONGS TO IS NOT IN THE PLAN — a holiday or a skip took it out. Its time
  // must survive, so cancelling the break brings the session back as the runner left it.
  PLAN.weeks[1]!.sessions = PLAN.weeks[1]!.sessions.filter((s) => s.id !== ID(2, 2, "easy"));
  const state: any = { done: {}, dayOverride: {}, heatAdapt: {} };
  const names = ["isoAdd", "todayIso", "doneKey", "effDay", "genDay", "ovTo", "ovFrom", "loadLinks", "tickSession",
    "planSessionRef", "loadTimes", "saveTimes", "seedDone", "legacySid", "sidKeys", "xwDir"];
  const src = ["LINK_KEY", "TIME_KEY", "PRIMARY_TYPES", "XWEEK"].map(constStmt).join("\n") + "\n" + names.map(fnBody).join("\n");
  const env: Record<string, unknown> = { PLAN, RAW: { weeks: [{ sessions: [] }, { sessions: [] }] }, state, localStorage, EXTRA: [],
    saveDayOverride: () => {}, saveHeatAdapt: () => {}, loadSwaps: () => ({}), saveSwaps: () => {}, loadSdone: () => [],
    RC: { sessionIdFor } };
  const keys = Object.keys(env);
  const seedDone = new Function(...keys, src + "\nreturn seedDone;")(...keys.map((k) => env[k]));
  store["interun_time_v1"] = JSON.stringify({
    [ID(2, 2, "easy")]: { t: "18:00", iso: addDays(NEXT_MON, 2) },      // session out of the plan for now
    "old-1": { t: "06:00", iso: addDays(TODAY, -8) },              // a week and a day ago: gone
    "edge": { t: "06:00", iso: addDays(TODAY, -7) },               // exactly a week: kept
  });
  seedDone();
  assert.deepEqual(Object.keys(JSON.parse(store["interun_time_v1"])).sort(), ["edge", ID(2, 2, "easy")].sort(),
    "a time was pruned for a session a break took out, or an old one was kept");
});

test("BLOCKER: the sheet offers a time from today on, saves on change only, and patches itself rather than rebuilding", () => {
  const sheet = decomment(fnBody("sessionSheetHtml"));
  assert.match(sheet, /const tRef = sess\.type !== "rest" && sIso >= todayIso\(\) \? planSessionRef\(sIso, sess\.id\) : null;/,
    "the time is offered on a rest day, a past day, or a session the plan does not hold");
  assert.match(sheet, /<input class="sel" id="sdTime" type="time"/, "the time is not the platform's own picker");
  // B4's "Move to another week" row sits between them: it belongs with moving the session.
  assert.match(sheet, /moveBlock \+\s*xwRowHtml\(sess, week\) \+\s*timeBlock \+\s*addLink/, "the time is not beside Move to another day");
  const wire = decomment(fnBody("wireSheet"));
  assert.match(wire, /sdTime\.onchange = \(\) => applySessionTime\(ss, iso, sdTime\.value\)/, "the time input saves nothing");
  assert.ok(!/sdTime\.oninput/.test(wire), "the time saves on every turn of the wheel");
  assert.match(wire, /sdTimeClear\.onclick = \(\) => applySessionTime\(ss, iso, ""\)/, "Clear does nothing");
  const apply = decomment(fnBody("applySessionTime"));
  assert.match(apply, /initReminders\(\)/, "the reminders keep firing at the old time");
  assert.ok(!/reopenSessionSheet\(|sessionSheetHtml\(/.test(apply), "the sheet is rebuilt under the runner, throwing them to its top");
  // The input is focusable text: 16px or iOS zooms (input.sel is 16px; nothing here shrinks it).
  const html = readFileSync(PAGE, "utf8");
  assert.ok(!/\.sd-time \.sel \{[^}]*font-size/.test(html), "the time input's font was shrunk below the zoom floor");
  // ⚠️ FOUND IN THE BROWSER: .mini-btn's own display beats the browser's [hidden] rule, so the hidden
  // Clear still showed beside an empty time. The rule that restores it must exist.
  assert.match(html, /\.sd-time \.mini-btn\[hidden\] \{ display: none; \}/, "a hidden Clear button still shows");
  assert.match(sheet, /id="sdTimeClear"' \+ \(tNow \? "" : " hidden"\)|id="sdTimeClear"[^>]*hidden/, "Clear is not hidden when there is no time");
});

test("the note says what the time does — and promises a reminder only while reminders are on", () => {
  const on = sandbox({ enabled: true, time: "07:30" }).api, off = sandbox({ enabled: false, time: "07:30" }).api;
  assert.equal(on.sessionTimeNote("18:00"), "Your calendar shows it at 18:00, and your reminder comes at 17:30.");
  assert.equal(off.sessionTimeNote("18:00"), "Your calendar shows it at 18:00.", "a reminder was promised with reminders off");
  assert.match(on.sessionTimeNote(""), /^Optional\./);
});

test("the time shows wherever the session is read: Today's card and the plan's own rows", () => {
  assert.match(decomment(fnBody("todayDecision")), /\(at \? " \\u00b7 " \+ at : ""\)|\(at \? " · " \+ at : ""\)/,
    "Today's card does not show the session's time");
  assert.match(decomment(fnBody("weekDetail")), /const meta = \[sessionTimeAt\(riso, s\.id\),/, "the plan's rows do not lead with the time");
  // And the calendar sheet says what the file now does with one.
  assert.match(decomment(fnBody("remindersSheetHtml")), /given a time goes in at that time, with an alert half an hour before/);
});

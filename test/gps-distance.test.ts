import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ THE PHONE RECORDED 0.00 km FOR A WHOLE RUN, AND NOTHING CAUGHT IT.
 *
 * `onGpsPos` gates distance behind a noise floor of half the fix's own accuracy, to stop GPS jitter
 * piling up while the runner stands still. That floor was applied to EVERY fix, including the ones where
 * the device tells us its speed — so at the ±14 m the owner's phone reported, a fix had to move more than
 * 7 metres to count. With fixes about a second apart that is 7 m/s, a 2:22/km pace. At his actual
 * 1.03 m/s every fix was discarded: no distance, no route, and a debrief with nothing in it. Even a good
 * 8 m fix demanded 4 m/s.
 *
 * The floor is a PROXY for "is this real movement?", needed only when `speed` is absent. These tests pin
 * both halves: real slow movement must accumulate, and both drift cases must still be thrown away.
 *
 * Reads the BUILT web/app.html because `onGpsPos` is web-layer code — same precedent as
 * warmup-delivery and home-screen-chrome. Run `node web/app.ts` first.
 */
function lift(names: string[]) {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  return names.map((fn) => {
    const at = html.indexOf("function " + fn + "(");
    assert.ok(at >= 0, "not found in the build: " + fn);
    let d = 0;
    for (let i = html.indexOf("{", at); i < html.length; i++) {
      if (html[i] === "{") d++;
      else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
    }
    throw new Error("unbalanced braces in " + fn);
  }).join("\n");
}

type Fix = { accuracy: number; speed: number | null };

/** Feed `count` fixes `stepMetres` apart (north) and return the metres and route points accrued. */
function feed(fix: Fix, stepMetres: number, count: number, jitter = false) {
  const src = lift(["haversine", "onGpsPos"]);
  const LIVE: any = {
    mode: "gps", dist: 0, route: [], elevGain: 0,
    lastLat: null, lastLon: null, lastAlt: null, devSpeed: null, acc: null,
    rt: { getStatus: () => "active" },
  };
  const run = new Function("LIVE", src + "; return onGpsPos;")(LIVE);
  let lat = 53.48;
  const dLat = stepMetres / 111320;
  for (let i = 0; i < count; i++) {
    lat += jitter ? (i % 2 ? dLat : -dLat) : dLat;
    run({ coords: { latitude: lat, longitude: -2.24, accuracy: fix.accuracy, speed: fix.speed, altitude: null } });
  }
  return { metres: LIVE.dist, points: LIVE.route.length };
}

test("a slow runner on a mediocre fix still accrues distance", () => {
  // The owner's exact conditions: 1.03 m/s (16:07/km) at ±14 m, one fix a second.
  const { metres, points } = feed({ accuracy: 14, speed: 1.03 }, 1.03, 60);
  assert.ok(metres > 50, `60 seconds at 1.03 m/s accrued only ${metres.toFixed(1)} m — the floor is eating real movement`);
  assert.ok(points > 50, `only ${points} route points — the route is gated with the distance, so the map would be empty`);
});

test("and so does a walker, at the worst accuracy we accept", () => {
  // 1.1 m/s at ±35 m, the loosest fix `good` allows. Under the old rule the floor was 17.5 m.
  const { metres } = feed({ accuracy: 35, speed: 1.1 }, 1.1, 60);
  assert.ok(metres > 50, `a walker on a poor fix accrued ${metres.toFixed(1)} m`);
});

test("a phone lying still, reporting a standstill speed, accrues nothing", () => {
  // ⚠️ The half of the guard that must survive the fix. Below 0.7 m/s we do not believe the movement
  // whatever the positions say — this is how a watch on a table once logged 0.2 km and drew a map.
  const { metres, points } = feed({ accuracy: 14, speed: 0.2 }, 1, 120, true);
  assert.equal(metres, 0, `phantom distance while standing: ${metres.toFixed(2)} m`);
  assert.equal(points, 0, "route points recorded while standing still");
});

test("nor does one whose speed is unknown and is only jittering", () => {
  // The indoor / cold-start case: CLLocation.speed is -1, so the accuracy floor is all we have and it
  // must still hold. 2 m of jitter against a 7 m floor.
  const { metres } = feed({ accuracy: 14, speed: -1 }, 2, 120, true);
  assert.equal(metres, 0, `jitter with unknown speed accrued ${metres.toFixed(2)} m`);
});

test("a teleport is still rejected, however fast the device claims to be going", () => {
  // The 80 m ceiling: a single fix jumping a city block is an error, not a sprint.
  const { metres } = feed({ accuracy: 14, speed: 4 }, 200, 10);
  assert.equal(metres, 0, `accepted 200 m jumps between fixes: ${metres.toFixed(1)} m`);
});

test("the noise floor is conditional on the device withholding its speed", () => {
  // Guards the shape of the fix rather than only its effect: if someone reinstates an unconditional
  // floor, the slow-runner tests above go red — but this one names WHY, in one line, at the top of
  // the failure list.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("function onGpsPos(");
  const body = html.slice(at, html.indexOf("function currentGpsPace", at));
  assert.match(body, /LIVE\.devSpeed != null \?/,
    "the distance floor is no longer conditional on devSpeed — a slow runner will record 0.00 km");
});

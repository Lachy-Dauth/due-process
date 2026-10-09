import test from "node:test";
import assert from "node:assert/strict";
import {
  createCase,
  mutateCase,
  elapsed,
  nextDueDate,
  verdict,
  profile,
  validateDate,
} from "../lib/court.ts";
import {
  AI_MODEL,
  AI_EFFORT,
  AI_MAX_OUTPUT_TOKENS,
  AI_PRODUCTION_BUDGET_CENTS,
  AI_LOCAL_BUDGET_CENTS,
  budgetLimit,
  estimatedCostMicros,
} from "../lib/ai-policy.ts";
const start = Date.parse("2026-10-09T00:00:00Z");
const mutate = (c, a, at = start) =>
  mutateCase(c, a, at, "2026-10-09").caseFile;

test("pause and resume exclude recess time; refresh can reconstruct elapsed", () => {
  let c = createCase({ title: "Fold laundry" }, start);
  c = mutate(c, { action: "start" }, start);
  c = mutate(c, { action: "pause" }, start + 40000);
  assert.equal(elapsed(c.session, start + 60000), 40);
  c = mutate(c, { action: "resume" }, start + 60000);
  const restored = JSON.parse(JSON.stringify(c));
  assert.equal(elapsed(restored.session, start + 80000), 60);
  c = mutate(c, { action: "progress" }, start + 80000);
  assert.equal(c.totalSeconds, 60);
  assert.equal(c.session, null);
  assert.equal(c.sessionCount, 1);
  assert.equal(c.status, "open");
});
test("reaching zero never completes a case; elapsed is capped at sentence", () => {
  const c = mutate(
    createCase({ title: "Reply to email" }, start),
    { action: "start" },
    start,
  );
  assert.equal(elapsed(c.session, start + 999999), 300);
  assert.equal(c.status, "open");
  assert.equal(elapsed(c.session, start - 1000), 0);
});
test("progress does not issue a certificate or generate a recurring occurrence", () => {
  const c = mutate(
    createCase(
      { title: "Fold laundry", repeat: "weekly", dueDate: "2026-10-02" },
      start,
    ),
    { action: "start" },
    start,
  );
  const result = mutateCase(
    c,
    { action: "progress" },
    start + 10000,
    "2026-10-09",
  );
  assert.equal(result.caseFile.status, "open");
  assert.equal(result.caseFile.closedAt, null);
  assert.equal(result.nextCase, undefined);
});
test("resolution records focus once and generates exactly one future recurrence", () => {
  const c = mutate(
    createCase(
      { title: "Fold laundry", repeat: "weekly", dueDate: "2026-09-18" },
      start,
    ),
    { action: "start" },
    start,
  );
  const result = mutateCase(
    c,
    { action: "resolve", note: "Laundry done" },
    start + 15000,
    "2026-10-09",
  );
  assert.equal(result.caseFile.status, "closed");
  assert.equal(result.caseFile.totalSeconds, 15);
  assert.equal(result.caseFile.sessionCount, 1);
  assert.equal(result.nextCase.dueDate, "2026-10-16");
  assert.equal(result.caseFile.nextCaseId, result.nextCase.id);
  assert.throws(
    () => mutateCase(result.caseFile, { action: "resolve" }, start + 16000),
    /closed/,
  );
  assert.throws(
    () => mutateCase(result.caseFile, { action: "reopen" }, start + 17000),
    /next occurrence/,
  );
});
test("calendar recurrence handles leap days, year boundaries, early completion and no date", () => {
  assert.equal(nextDueDate("2028-02-28", "daily", "2028-02-28"), "2028-02-29");
  assert.equal(nextDueDate("2026-12-31", "daily", "2026-12-31"), "2027-01-01");
  assert.equal(nextDueDate("2026-10-16", "weekly", "2026-10-09"), "2026-10-23");
  assert.equal(nextDueDate(null, "weekly", "2026-10-09"), "2026-10-16");
  assert.equal(nextDueDate("2026-10-04", "daily", "2026-10-05"), "2026-10-06");
});
test("objections produce a smaller sentence and preserve the task", () => {
  const normal = verdict("Fold the laundry", "tomorrow");
  const tiny = verdict("Fold the laundry", "big");
  assert.equal(normal.minutes, 5);
  assert.equal(tiny.minutes, 2);
  assert.match(tiny.step, /one item/);
  const energy = verdict("Write proposal", "energy");
  assert.equal(energy.minutes, 2);
  assert.match(energy.step, /one.*bullet/i);
  const blocked = verdict("Book trip", "blocked");
  assert.equal(blocked.blocked, true);
  assert.match(blocked.step, /one thing/);
});
test("waiting cases can receive evidence and return to a usable first step", () => {
  let c = createCase({ title: "Reply to email" }, start);
  c = mutate(c, { action: "plead", reason: "blocked" });
  c = mutate(c, { action: "wait" });
  assert.equal(c.status, "awaiting");
  c = mutate(c, { action: "unblock" });
  assert.equal(c.status, "open");
  assert.equal(c.plan.blocked, false);
});
test("title, date, duration and state transition validation", () => {
  assert.throws(() => createCase({ title: "   " }), /title/);
  assert.throws(() => validateDate("2026-02-30"), /calendar/);
  const c = createCase({ title: "Study" }, start);
  assert.throws(() => mutate(c, { action: "pause" }), /running/);
  assert.throws(
    () => mutate(c, { action: "plan", step: "One page", minutes: 0 }),
    /minute/,
  );
  const running = mutate(c, { action: "start" });
  assert.throws(
    () => mutate(running, { action: "edit", title: "Read" }),
    /session/,
  );
  assert.throws(() => mutate(running, { action: "start" }), /active/);
});
test("task profiles distinguish washing from folding; unknown tasks get a physical action", () => {
  assert.match(profile("Do laundry").first, /machine/);
  assert.match(profile("Fold laundry").first, /Fold three/);
  assert.match(profile("Quantum banana").first, /Open the place/);
  assert.equal(profile("Washing dishes").icon, "🍽️");
  assert.equal(profile("Book dentist appointment").icon, "☎️");
  assert.equal(profile("Book flights to Auckland").icon, "🔎");
});
test("AI contract cannot exceed the requested model, effort or budget", () => {
  assert.equal(AI_MODEL, "claude-haiku-5-5");
  assert.equal(AI_EFFORT, "low");
  assert.equal(AI_MAX_OUTPUT_TOKENS, 1200);
  assert.equal(AI_PRODUCTION_BUDGET_CENTS + AI_LOCAL_BUDGET_CENTS, 20000);
  assert.equal(budgetLimit("999999"), 19900);
  assert.equal(budgetLimit("-1"), 0);
  assert.equal(budgetLimit("oops"), 0);
  assert.equal(estimatedCostMicros(6000, 1200), 1200); // $0.0012; a one-cent reservation covers it.
});

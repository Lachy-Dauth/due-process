// Run against the local preview only. A live Claude call requires COURT_LIVE_AI_TEST=1.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { createCase } from "../lib/court.ts";
const origin = "http://127.0.0.1:5173";
const fixtureIds = [];
function sqlFile(sql, name) {
  mkdirSync(".sites-runtime", { recursive: true });
  const file = `.sites-runtime/${name}.sql`;
  writeFileSync(file, sql);
  execFileSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--file",
      file,
    ],
    { stdio: "pipe" },
  );
}
const anonymous = await fetch(origin + "/api/cases");
assert.equal(anonymous.status, 401);
const forged = await fetch(origin + "/api/cases", {
  headers: {
    "oai-authenticated-user-id": "invented",
    "oai-authenticated-user-email": "fake@example.invalid",
  },
});
assert.equal(forged.status, 401);
console.log("PASS anonymous and forged identity requests rejected");
const signIn = await fetch(origin + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
const cookie = signIn.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
assert.ok(cookie);
async function request(path, method = "GET", body, otherHeaders = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
      ...otherHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { status: response.status, data };
}
async function file(title, repeat = "once") {
  const id = randomUUID();
  fixtureIds.push(id);
  const input = {
    id,
    title,
    repeat,
    dueDate: "2026-10-09",
    notes: "Local QA fixture",
  };
  const response = await request("/api/cases", "POST", input);
  assert.equal(response.status, 201);
  const duplicate = await request("/api/cases", "POST", input);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data.caseFile.id, id);
  return response.data.caseFile;
}
async function patch(c, action) {
  return request("/api/cases/" + c.id, "PATCH", {
    ...action,
    version: c.version,
    today: "2026-10-09",
  });
}
try {
  const foreign = createCase({ title: "Foreign owner secret fixture" });
  fixtureIds.push(foreign.id);
  const data = JSON.stringify(foreign).replaceAll("'", "''");
  sqlFile(
    `INSERT INTO case_files (id,owner_id,data,version,created_at,updated_at) VALUES ('${foreign.id}','different-owner','${data}',0,${Date.now()},${Date.now()});`,
    "foreign-fixture",
  );
  const docket = await request("/api/cases");
  assert.equal(docket.status, 200);
  assert.ok(!docket.data.cases.some((c) => c.id === foreign.id));
  const foreignWrite = await patch(foreign, { action: "resolve" });
  assert.equal(foreignWrite.status, 404);
  console.log("PASS foreign owner records excluded and writes rejected");
  const closedFixtures = [];
  for (let i = 0; i < 501; i++) {
    const item = createCase({ title: "QA archived recurrence" });
    item.status = "closed";
    item.closedAt = 1700000000000 + i;
    item.createdAt = 1600000000000 + i;
    fixtureIds.push(item.id);
    closedFixtures.push(item);
  }
  const oldActive = createCase({ title: "QA old unresolved task" });
  oldActive.createdAt = 1;
  fixtureIds.push(oldActive.id);
  sqlFile(
    [...closedFixtures, oldActive]
      .map(
        (item) =>
          `INSERT INTO case_files (id,owner_id,data,version,created_at,updated_at) VALUES ('${item.id}','local_seedy','${JSON.stringify(item).replaceAll("'", "''")}',0,${item.createdAt},${item.createdAt});`,
      )
      .join("\n"),
    "archive-fixtures",
  );
  const firstPage = await request("/api/cases");
  assert.ok(firstPage.data.cases.some((item) => item.id === oldActive.id));
  assert.ok(firstPage.data.archiveCursor);
  const archivedSeen = new Set(
    firstPage.data.cases
      .filter((item) => closedFixtures.some((f) => f.id === item.id))
      .map((item) => item.id),
  );
  let archiveCursor = firstPage.data.archiveCursor;
  while (archiveCursor) {
    const page = await request(
      "/api/cases?archiveCursor=" + encodeURIComponent(archiveCursor),
    );
    assert.equal(page.status, 200);
    for (const item of page.data.cases)
      if (closedFixtures.some((f) => f.id === item.id))
        archivedSeen.add(item.id);
    archiveCursor = page.data.archiveCursor;
  }
  assert.equal(archivedSeen.size, 501);
  console.log(
    "PASS 501 archived cases neither hide unresolved tasks nor prevent filing; all archive pages accessible",
  );

  let c = await file("QA recurring laundry", "weekly");
  const stale = await patch(
    { ...c, version: 99 },
    { action: "plan", step: "Fold one item", minutes: 2 },
  );
  assert.equal(stale.status, 409);
  const badOrigin = await request(
    "/api/cases/" + c.id,
    "PATCH",
    { action: "resolve", version: c.version },
    { Origin: "https://untrusted.example" },
  );
  assert.equal(badOrigin.status, 403);
  let r = await patch(c, { action: "start" });
  assert.equal(r.status, 200);
  c = r.data.caseFile;
  assert.equal(c.session.state, "running");
  r = await patch(c, { action: "pause" });
  assert.equal(r.status, 200);
  c = r.data.caseFile;
  assert.equal(c.session.state, "paused");
  const refreshed = await request("/api/cases");
  const persisted = refreshed.data.cases.find((item) => item.id === c.id);
  assert.deepEqual(persisted.session, c.session);
  r = await patch(c, { action: "progress", note: "Folded one sock" });
  assert.equal(r.status, 200);
  c = r.data.caseFile;
  assert.equal(c.status, "open");
  assert.equal(c.sessionCount, 1);
  assert.equal(r.data.nextCase, undefined);
  const [first, second] = await Promise.all([
    patch(c, { action: "resolve" }),
    patch(c, { action: "resolve" }),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  const successful = first.status === 200 ? first : second;
  assert.equal(successful.data.caseFile.status, "closed");
  assert.equal(successful.data.nextCase.dueDate, "2026-10-16");
  fixtureIds.push(successful.data.nextCase.id);
  const finalDocket = await request("/api/cases");
  assert.equal(
    finalDocket.data.cases.filter(
      (item) => item.title === c.title && item.status === "open",
    ).length,
    1,
  );
  console.log(
    "PASS idempotent filing, persisted timer, progress, stale writes, origin checks and atomic recurrence",
  );
  if (process.env.COURT_LIVE_AI_TEST === "1") {
    let aiCase = await file("Find the missing Tupperware lids");
    const result = await patch(aiCase, {
      action: "plead",
      reason: "energy",
      defense: "The lids have formed a breakaway republic.",
    });
    assert.equal(result.status, 200);
    assert.ok(result.data.caseFile.plan.step);
    assert.equal(result.data.caseFile.plan.minutes, 2);
    console.log(
      "LIVE JUDGE RESULT",
      JSON.stringify({
        line: result.data.caseFile.plan.line,
        step: result.data.caseFile.plan.step,
      }),
    );
  }
} finally {
  // Only exact, newly created QA fixture IDs are removed. Personal case files are preserved.
  if (fixtureIds.length)
    sqlFile(
      `DELETE FROM case_files WHERE id IN (${fixtureIds.map((id) => `'${id}'`).join(",")});`,
      "cleanup-fixtures",
    );
}

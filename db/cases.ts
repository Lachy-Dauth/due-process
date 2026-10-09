import { env } from "cloudflare:workers";
import type { CaseFile } from "@/lib/court";
export function caseDb() {
  if (!env.DB) throw new Error("The court archive is unavailable.");
  return env.DB;
}
export async function listCases(ownerId: string, cursor: string | null = null) {
  const db = caseDb();
  let beforeTime: number | null = null,
    beforeId: string | null = null;
  if (cursor) {
    const match = /^(\d{1,16})\.([a-f0-9-]{36})$/i.exec(cursor);
    if (!match) throw new Error("Invalid archive cursor");
    beforeTime = Number(match[1]);
    beforeId = match[2];
  }
  const active = cursor
    ? []
    : (
        await db
          .prepare(
            "SELECT data FROM case_files WHERE owner_id = ? AND json_extract(data, '$.status') != 'closed' ORDER BY created_at DESC",
          )
          .bind(ownerId)
          .all<{ data: string }>()
      ).results;
  const closedWhere =
    beforeTime == null
      ? ""
      : " AND (json_extract(data, '$.closedAt') < ? OR (json_extract(data, '$.closedAt') = ? AND id < ?))";
  const query = db.prepare(
    "SELECT data, id, json_extract(data, '$.closedAt') AS closed_at FROM case_files WHERE owner_id = ? AND json_extract(data, '$.status') = 'closed'" +
      closedWhere +
      " ORDER BY json_extract(data, '$.closedAt') DESC, id DESC LIMIT 101",
  );
  const archived = await (
    beforeTime == null
      ? query.bind(ownerId)
      : query.bind(ownerId, beforeTime, beforeTime, beforeId)
  ).all<{ data: string; id: string; closed_at: number }>();
  const page = archived.results.slice(0, 100),
    last = page.at(-1);
  const stats = await db
    .prepare(
      "SELECT COALESCE(SUM(json_extract(data, '$.totalSeconds')), 0) AS totalSeconds, COALESCE(SUM(CASE WHEN json_extract(data, '$.status') = 'closed' THEN 1 ELSE 0 END), 0) AS closed FROM case_files WHERE owner_id = ?",
    )
    .bind(ownerId)
    .first<{ totalSeconds: number; closed: number }>();
  return {
    cases: [...active, ...page].map((row) => JSON.parse(row.data) as CaseFile),
    archiveCursor:
      archived.results.length > 100 && last
        ? `${last.closed_at}.${last.id}`
        : null,
    stats: stats ?? { totalSeconds: 0, closed: 0 },
  };
}
export async function readCase(ownerId: string, id: string) {
  const row = await caseDb()
    .prepare("SELECT data FROM case_files WHERE id = ? AND owner_id = ?")
    .bind(id, ownerId)
    .first<{ data: string }>();
  return row ? (JSON.parse(row.data) as CaseFile) : null;
}

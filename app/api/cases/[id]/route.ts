import { getChatGPTUser } from "@/app/chatgpt-auth";
import { caseDb, readCase } from "@/db/cases";
import { mutateCase, CourtError, validateDate, type Action } from "@/lib/court";
import { personalizeVerdict } from "@/lib/ai-judge";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to update your case." },
      { status: 401 },
    );
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json(
      { error: "This action must come from your court." },
      { status: 403 },
    );
  try {
    const { id } = await params;
    const original = await readCase(user.userId, id);
    if (!original)
      return Response.json(
        { error: "This case is not in your docket." },
        { status: 404 },
      );
    const body = (await request.json()) as Action & {
      version: number;
      today: string;
    };
    if (!body || body.version !== original.version)
      return Response.json(
        {
          error:
            "This case changed in another window. The docket has been refreshed; please retry.",
        },
        { status: 409 },
      );
    const today =
      validateDate(body.today) ?? new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const { caseFile, nextCase } = mutateCase(original, body, now, today);
    if (
      (body.action === "plead" || body.action === "appeal") &&
      caseFile.plan
    ) {
      const crafted = caseFile.plan;
      caseFile.plan = await personalizeVerdict(
        user.userId,
        `${id}.${original.version}.${body.action}`,
        caseFile.title,
        body.reason,
        crafted,
        body.action === "plead" ? (body.defense ?? "") : "",
      );
      const last = caseFile.history.at(-1);
      if (last) last.text = last.text.replace(crafted.line, caseFile.plan.line);
    }
    const db = caseDb();
    const statements = [];
    if (nextCase)
      statements.push(
        db
          .prepare(
            "INSERT INTO case_files (id, owner_id, data, version, created_at, updated_at) SELECT ?, ?, ?, 0, ?, ? WHERE EXISTS (SELECT 1 FROM case_files WHERE id = ? AND owner_id = ? AND version = ?)",
          )
          .bind(
            nextCase.id,
            user.userId,
            JSON.stringify(nextCase),
            now,
            now,
            id,
            user.userId,
            original.version,
          ),
      );
    const startGuard =
      body.action === "start"
        ? " AND NOT EXISTS (SELECT 1 FROM case_files AS other WHERE other.owner_id = ? AND other.id != ? AND json_extract(other.data, '$.session.state') IN ('running','paused'))"
        : "";
    const query = db.prepare(
      "UPDATE case_files SET data = ?, version = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND version = ?" +
        startGuard,
    );
    const binds = [
      JSON.stringify(caseFile),
      caseFile.version,
      now,
      id,
      user.userId,
      original.version,
    ];
    if (body.action === "start") binds.push(user.userId, id);
    statements.push(query.bind(...binds));
    const results = await db.batch(statements);
    if (!results[results.length - 1].meta.changes)
      return Response.json(
        {
          error:
            body.action === "start"
              ? "Another session is active, or this case changed. Return to the docket and record that session first."
              : "This case changed in another window. The docket has been refreshed; please retry.",
        },
        { status: 409 },
      );
    return Response.json({ caseFile, ...(nextCase ? { nextCase } : {}) });
  } catch (error) {
    if (error instanceof CourtError)
      return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof SyntaxError)
      return Response.json(
        { error: "This action is unreadable. Please try again." },
        { status: 400 },
      );
    console.error("Case update failed", error);
    return Response.json(
      {
        error:
          "The court could not record that action. Please retry; your case is unchanged.",
      },
      { status: 503 },
    );
  }
}

import { getChatGPTUser } from "@/app/chatgpt-auth";
import { caseDb, listCases } from "@/db/cases";
import { createCase, CourtError, type CaseInput } from "@/lib/court";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to open your personal docket." },
      { status: 401 },
    );
  const cursor = new URL(request.url).searchParams.get("archiveCursor");
  if (cursor && !/^(\d{1,16})\.([a-f0-9-]{36})$/i.test(cursor))
    return Response.json(
      { error: "That archive page is not valid." },
      { status: 400 },
    );
  try {
    return Response.json(await listCases(user.userId, cursor), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Case archive read failed", error);
    return Response.json(
      { error: "The court archive is unavailable. Please try again." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to save your case." },
      { status: 401 },
    );
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json(
      { error: "This filing must come from your court." },
      { status: 403 },
    );
  try {
    const body = (await request.json()) as CaseInput & { id?: string };
    if (!body || typeof body !== "object")
      throw new CourtError("Give the court a task to file.");
    const caseId = body.id;
    if (typeof caseId !== "string" || !/^[a-f0-9-]{36}$/i.test(caseId))
      throw new CourtError(
        "This filing needs a valid reference. Please retry.",
      );
    const c = createCase(body, Date.now(), caseId);
    const db = caseDb();
    const prior = await db
      .prepare("SELECT data FROM case_files WHERE id = ? AND owner_id = ?")
      .bind(c.id, user.userId)
      .first<{ data: string }>();
    if (prior)
      return Response.json(
        { caseFile: JSON.parse(prior.data) },
        { status: 200 },
      );
    const inserted = await db
      .prepare(
        "INSERT OR IGNORE INTO case_files (id, owner_id, data, version, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM case_files WHERE owner_id = ? AND json_extract(data, '$.status') != 'closed') < 500",
      )
      .bind(
        c.id,
        user.userId,
        JSON.stringify(c),
        0,
        c.createdAt,
        c.createdAt,
        user.userId,
      )
      .run();
    if (!inserted.meta.changes) {
      const existing = await db
        .prepare("SELECT data FROM case_files WHERE id = ? AND owner_id = ?")
        .bind(c.id, user.userId)
        .first<{ data: string }>();
      if (existing)
        return Response.json({ caseFile: JSON.parse(existing.data) });
      throw new CourtError(
        "The court holds up to 500 active cases. Resolve one before filing another. Your archive remains available.",
      );
    }
    return Response.json({ caseFile: c }, { status: 201 });
  } catch (error) {
    if (error instanceof CourtError)
      return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof SyntaxError)
      return Response.json(
        { error: "This filing is unreadable. Please try again." },
        { status: 400 },
      );
    console.error("Case filing failed", error);
    return Response.json(
      {
        error:
          "The case could not be saved. Your draft is still here. Please retry.",
      },
      { status: 503 },
    );
  }
}

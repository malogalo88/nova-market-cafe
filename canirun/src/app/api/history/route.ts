import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(1, Math.min(500, parseInt(limitParam, 10))) : 50;

    const rows = db
      .prepare("SELECT * FROM history ORDER BY createdAt DESC LIMIT ?")
      .all(limit) as (Record<string, unknown>)[];

    const history = rows.map((row) => ({
      ...row,
      results: JSON.parse(row.results as string),
    }));

    return Response.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    return Response.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

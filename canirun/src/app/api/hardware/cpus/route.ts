import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q");
    const brand = searchParams.get("brand");

    let query = "SELECT * FROM cpus WHERE 1=1";
    const params: (string | number)[] = [];

    if (q) {
      query += " AND (name LIKE ? OR brand LIKE ? OR series LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (brand) {
      query += " AND brand = ?";
      params.push(brand);
    }

    query += " ORDER BY performanceScore DESC";

    const cpus = db.prepare(query).all(...params);
    return Response.json(cpus);
  } catch (error) {
    console.error("Error fetching CPUs:", error);
    return Response.json({ error: "Failed to fetch CPUs" }, { status: 500 });
  }
}

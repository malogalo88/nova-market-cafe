import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q");
    const brand = searchParams.get("brand");
    const isLaptop = searchParams.get("isLaptop");

    let query = "SELECT * FROM gpus WHERE 1=1";
    const params: (string | number)[] = [];

    if (q) {
      query += " AND (name LIKE ? OR brand LIKE ? OR series LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (brand) {
      query += " AND brand = ?";
      params.push(brand);
    }

    if (isLaptop === "true") {
      query += " AND isLaptop = 1";
    } else if (isLaptop === "false") {
      query += " AND isLaptop = 0";
    }

    query += " ORDER BY performanceScore DESC";

    const gpus = db
      .prepare(query)
      .all(...params)
      .map((r) => ({
        ...(r as Record<string, unknown>),
        isLaptop: Boolean((r as Record<string, unknown>).isLaptop),
      }));

    return Response.json(gpus);
  } catch (error) {
    console.error("Error fetching GPUs:", error);
    return Response.json({ error: "Failed to fetch GPUs" }, { status: 500 });
  }
}

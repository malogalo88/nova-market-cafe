import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q");
    const brand = searchParams.get("brand");

    let query = `
      SELECT l.*, c.name as cpuName, c.brand as cpuBrand, c.performanceScore as cpuScore,
             g.name as gpuName, g.brand as gpuBrand, g.performanceScore as gpuScore, g.vram as gpuVram
      FROM laptops l
      LEFT JOIN cpus c ON l.cpuId = c.id
      LEFT JOIN gpus g ON l.gpuId = g.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (q) {
      query += " AND (l.name LIKE ? OR l.brand LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    if (brand) {
      query += " AND l.brand = ?";
      params.push(brand);
    }

    query += " ORDER BY l.year DESC, l.name ASC";

    const laptops = db.prepare(query).all(...params);
    return Response.json(laptops);
  } catch (error) {
    console.error("Error fetching laptops:", error);
    return Response.json({ error: "Failed to fetch laptops" }, { status: 500 });
  }
}

import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type");
    const q = searchParams.get("q");
    const brand = searchParams.get("brand");
    const isLaptop = searchParams.get("isLaptop");

    const results: Record<string, unknown>[] = [];

    if (!type || type === "cpu") {
      let cpuQuery = "SELECT * FROM cpus WHERE 1=1";
      const cpuParams: string[] = [];
      if (q) {
        cpuQuery += " AND (name LIKE ? OR brand LIKE ? OR series LIKE ?)";
        cpuParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      if (brand) {
        cpuQuery += " AND brand = ?";
        cpuParams.push(brand);
      }
      const cpus = db.prepare(cpuQuery).all(...cpuParams) as Record<string, unknown>[];
      for (const r of cpus) {
        results.push({ ...r, type: "cpu" });
      }
    }

    if (!type || type === "gpu") {
      let gpuQuery = "SELECT * FROM gpus WHERE 1=1";
      const gpuParams: string[] = [];
      if (q) {
        gpuQuery += " AND (name LIKE ? OR brand LIKE ? OR series LIKE ?)";
        gpuParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      if (brand) {
        gpuQuery += " AND brand = ?";
        gpuParams.push(brand);
      }
      if (isLaptop === "true") {
        gpuQuery += " AND isLaptop = 1";
      } else if (isLaptop === "false") {
        gpuQuery += " AND isLaptop = 0";
      }
      const gpus = db.prepare(gpuQuery).all(...gpuParams);
      for (const r of gpus) {
        const row = r as Record<string, unknown>;
        results.push({ ...row, isLaptop: Boolean(row.isLaptop), type: "gpu" });
      }
    }

    if (!type || type === "laptop") {
      let laptopQuery = `SELECT l.*, c.name as cpuName, g.name as gpuName
        FROM laptops l
        LEFT JOIN cpus c ON l.cpuId = c.id
        LEFT JOIN gpus g ON l.gpuId = g.id
        WHERE 1=1`;
      const laptopParams: string[] = [];
      if (q) {
        laptopQuery += " AND (l.name LIKE ? OR l.brand LIKE ?)";
        laptopParams.push(`%${q}%`, `%${q}%`);
      }
      if (brand) {
        laptopQuery += " AND l.brand = ?";
        laptopParams.push(brand);
      }
      const laptops = db.prepare(laptopQuery).all(...laptopParams) as Record<string, unknown>[];
      for (const r of laptops) {
        results.push({ ...r, type: "laptop" });
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error("Error fetching hardware:", error);
    return Response.json({ error: "Failed to fetch hardware" }, { status: 500 });
  }
}

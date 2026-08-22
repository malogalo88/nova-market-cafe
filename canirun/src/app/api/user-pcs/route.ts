import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json([]);
    }

    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM user_pcs WHERE userId = ? ORDER BY isDefault DESC, createdAt DESC")
      .all(session.user.id) as Record<string, unknown>[];

    const pcs = rows.map((row) => ({
      ...row,
      isDefault: Boolean(row.isDefault),
      gpuIntegrated: Boolean(row.gpuIntegrated),
    }));

    return Response.json(pcs);
  } catch (error) {
    console.error("Error fetching user PCs:", error);
    return Response.json({ error: "Failed to fetch PCs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const id = uuidv4();
    const now = new Date().toISOString();

    if (body.isDefault) {
      const db = getDb();
      db.prepare("UPDATE user_pcs SET isDefault = 0 WHERE userId = ?").run(session.user.id);
    }

    const db = getDb();
    db.prepare(`
      INSERT INTO user_pcs (
        id, userId, name, isDefault, cpuId, cpuManufacturer, cpuModel, cpuGeneration,
        cpuCores, cpuThreads, cpuBaseClock, cpuBoostClock, cpuArchitecture,
        gpuId, gpuManufacturer, gpuModel, gpuIntegrated, gpuVram, gpuVramType,
        gpuArchitecture, gpuDirectX,
        ramTotalGB, ramType, ramSpeed, ramSticks, ramChannels,
        storageType, storageCapacityGB, storageFreeGB,
        displayResolution, displayRefreshRate, displayAspectRatio,
        osVersion, osArch, systemType, laptopBrand, laptopModel, batteryInfo,
        createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `).run(
      id, session.user.id, body.name || "My PC", body.isDefault ? 1 : 0,
      body.cpuId || "", body.cpuManufacturer || "", body.cpuModel || "", body.cpuGeneration || "",
      body.cpuCores || 0, body.cpuThreads || 0, body.cpuBaseClock || 0, body.cpuBoostClock || 0, body.cpuArchitecture || "",
      body.gpuId || "", body.gpuManufacturer || "", body.gpuModel || "", body.gpuIntegrated ? 1 : 0,
      body.gpuVram || 0, body.gpuVramType || "", body.gpuArchitecture || "", body.gpuDirectX || "",
      body.ramTotalGB || 8, body.ramType || "DDR4", body.ramSpeed || 3200, body.ramSticks || 1, body.ramChannels || "Dual",
      body.storageType || "SSD", body.storageCapacityGB || 512, body.storageFreeGB || 256,
      body.displayResolution || "1920x1080", body.displayRefreshRate || 60, body.displayAspectRatio || "16:9",
      body.osVersion || "Windows 11", body.osArch || "64-bit", body.systemType || "desktop",
      body.laptopBrand || "", body.laptopModel || "", body.batteryInfo || "",
      now, now
    );

    return Response.json({ id, ...body, createdAt: now, updatedAt: now }, { status: 201 });
  } catch (error) {
    console.error("Error creating PC:", error);
    return Response.json({ error: "Failed to create PC" }, { status: 500 });
  }
}

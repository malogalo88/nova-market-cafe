import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM user_pcs WHERE id = ? AND userId = ?")
      .get(id, session.user.id) as Record<string, unknown> | undefined;

    if (!row) {
      return Response.json({ error: "PC not found" }, { status: 404 });
    }

    return Response.json({
      ...row,
      isDefault: Boolean(row.isDefault),
      gpuIntegrated: Boolean(row.gpuIntegrated),
    });
  } catch (error) {
    console.error("Error fetching PC:", error);
    return Response.json({ error: "Failed to fetch PC" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const body = await request.json();
    const db = getDb();

    const existing = db
      .prepare("SELECT id FROM user_pcs WHERE id = ? AND userId = ?")
      .get(id, session.user.id) as { id: string } | undefined;

    if (!existing) {
      return Response.json({ error: "PC not found" }, { status: 404 });
    }

    if (body.isDefault) {
      db.prepare("UPDATE user_pcs SET isDefault = 0 WHERE userId = ?").run(session.user.id);
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE user_pcs SET
        name = ?, isDefault = ?,
        cpuId = ?, cpuManufacturer = ?, cpuModel = ?, cpuGeneration = ?,
        cpuCores = ?, cpuThreads = ?, cpuBaseClock = ?, cpuBoostClock = ?, cpuArchitecture = ?,
        gpuId = ?, gpuManufacturer = ?, gpuModel = ?, gpuIntegrated = ?,
        gpuVram = ?, gpuVramType = ?, gpuArchitecture = ?, gpuDirectX = ?,
        ramTotalGB = ?, ramType = ?, ramSpeed = ?, ramSticks = ?, ramChannels = ?,
        storageType = ?, storageCapacityGB = ?, storageFreeGB = ?,
        displayResolution = ?, displayRefreshRate = ?, displayAspectRatio = ?,
        osVersion = ?, osArch = ?, systemType = ?,
        laptopBrand = ?, laptopModel = ?, batteryInfo = ?,
        updatedAt = ?
      WHERE id = ? AND userId = ?
    `).run(
      body.name || "My PC", body.isDefault ? 1 : 0,
      body.cpuId || "", body.cpuManufacturer || "", body.cpuModel || "", body.cpuGeneration || "",
      body.cpuCores || 0, body.cpuThreads || 0, body.cpuBaseClock || 0, body.cpuBoostClock || 0, body.cpuArchitecture || "",
      body.gpuId || "", body.gpuManufacturer || "", body.gpuModel || "", body.gpuIntegrated ? 1 : 0,
      body.gpuVram || 0, body.gpuVramType || "", body.gpuArchitecture || "", body.gpuDirectX || "",
      body.ramTotalGB || 8, body.ramType || "DDR4", body.ramSpeed || 3200, body.ramSticks || 1, body.ramChannels || "Dual",
      body.storageType || "SSD", body.storageCapacityGB || 512, body.storageFreeGB || 256,
      body.displayResolution || "1920x1080", body.displayRefreshRate || 60, body.displayAspectRatio || "16:9",
      body.osVersion || "Windows 11", body.osArch || "64-bit", body.systemType || "desktop",
      body.laptopBrand || "", body.laptopModel || "", body.batteryInfo || "",
      now,
      id, session.user.id
    );

    return Response.json({ id, ...body, updatedAt: now });
  } catch (error) {
    console.error("Error updating PC:", error);
    return Response.json({ error: "Failed to update PC" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const db = getDb();

    const existing = db
      .prepare("SELECT id FROM user_pcs WHERE id = ? AND userId = ?")
      .get(id, session.user.id) as { id: string } | undefined;

    if (!existing) {
      return Response.json({ error: "PC not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM user_pcs WHERE id = ? AND userId = ?").run(id, session.user.id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting PC:", error);
    return Response.json({ error: "Failed to delete PC" }, { status: 500 });
  }
}

import { getDb } from "@/lib/db";

export async function GET(_request: Request, ctx: RouteContext<"/api/profiles/[id]">) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);

    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    return Response.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return Response.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: Request, ctx: RouteContext<"/api/profiles/[id]">) {
  try {
    const { id } = await ctx.params;
    const db = getDb();

    const existing = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
    if (!existing) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, type, cpuId, gpuId, ramGB, ramSpeed, storageType, storageCapacity, displayResolution } = body;

    const now = new Date().toISOString();

    db.prepare(
      `UPDATE profiles SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        cpuId = COALESCE(?, cpuId),
        gpuId = COALESCE(?, gpuId),
        ramGB = COALESCE(?, ramGB),
        ramSpeed = COALESCE(?, ramSpeed),
        storageType = COALESCE(?, storageType),
        storageCapacity = COALESCE(?, storageCapacity),
        displayResolution = COALESCE(?, displayResolution),
        updatedAt = ?
       WHERE id = ?`,
    ).run(name ?? null, type ?? null, cpuId ?? null, gpuId ?? null, ramGB ?? null, ramSpeed ?? null, storageType ?? null, storageCapacity ?? null, displayResolution ?? null, now, id);

    const updated = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
    return Response.json(updated);
  } catch (error) {
    console.error("Error updating profile:", error);
    return Response.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/profiles/[id]">) {
  try {
    const { id } = await ctx.params;
    const db = getDb();

    const existing = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
    if (!existing) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
    return Response.json({ message: "Profile deleted" });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return Response.json({ error: "Failed to delete profile" }, { status: 500 });
  }
}

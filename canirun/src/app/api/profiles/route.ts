import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const db = getDb();
    const profiles = db.prepare("SELECT * FROM profiles ORDER BY createdAt DESC").all();
    return Response.json(profiles);
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return Response.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, cpuId, gpuId, ramGB, ramSpeed, storageType, storageCapacity, displayResolution } = body;

    if (!name || !type || !cpuId || !gpuId || !ramGB || !ramSpeed || !storageType || !storageCapacity || !displayResolution) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO profiles (id, name, type, cpuId, gpuId, ramGB, ramSpeed, storageType, storageCapacity, displayResolution, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, type, cpuId, gpuId, ramGB, ramSpeed, storageType, storageCapacity, displayResolution, now, now);

    const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
    return Response.json(profile, { status: 201 });
  } catch (error) {
    console.error("Error creating profile:", error);
    return Response.json({ error: "Failed to create profile" }, { status: 500 });
  }
}

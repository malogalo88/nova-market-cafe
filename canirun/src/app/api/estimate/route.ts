import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { runFullEstimate } from "@/lib/fps-engine";
import type { SavedProfile } from "@/types/index";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cpuId, gpuId, ramGB, gameId } = body;

    if (!cpuId || !gpuId || !ramGB || !gameId) {
      return Response.json(
        { error: "Missing required fields: cpuId, gpuId, ramGB, gameId" },
        { status: 400 },
      );
    }

    const db = getDb();

    const cpu = db.prepare("SELECT name FROM cpus WHERE id = ?").get(cpuId) as { name: string } | undefined;
    const gpu = db.prepare("SELECT name FROM gpus WHERE id = ?").get(gpuId) as { name: string } | undefined;
    const game = db.prepare("SELECT title FROM games WHERE id = ?").get(gameId) as { title: string } | undefined;

    if (!cpu || !gpu || !game) {
      return Response.json(
        { error: "Invalid CPU, GPU, or Game ID" },
        { status: 400 },
      );
    }

    const profile: SavedProfile = {
      id: "",
      name: `${cpu.name} + ${gpu.name}`,
      type: "desktop",
      cpuId,
      gpuId,
      ramGB,
      ramSpeed: 0,
      storageType: "NVMe",
      storageCapacity: 0,
      displayResolution: "1920x1080",
      createdAt: "",
      updatedAt: "",
    };

    const result = runFullEstimate(profile, gameId);

    db.prepare(
      `INSERT INTO history (id, profileId, profileName, gameId, gameTitle, results, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      uuidv4(),
      "",
      `${cpu.name} + ${gpu.name} (${ramGB}GB RAM)`,
      gameId,
      game.title,
      JSON.stringify(result),
      new Date().toISOString(),
    );

    return Response.json(result);
  } catch (error) {
    console.error("Error calculating estimate:", error);
    return Response.json(
      { error: "Failed to calculate FPS estimate" },
      { status: 500 },
    );
  }
}

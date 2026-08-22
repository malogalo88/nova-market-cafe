import { getDb } from "@/lib/db";
import { runFullEstimate } from "@/lib/fps-engine";
import type { CompareEntry } from "@/types/index";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileIds, gameId } = body;

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return Response.json(
        { error: "profileIds must be a non-empty array" },
        { status: 400 },
      );
    }

    const db = getDb();
    const entries: CompareEntry[] = [];

    for (const pid of profileIds) {
      const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(pid) as Record<string, unknown> | undefined;
      if (!profile) continue;

      const cpuRow = db.prepare("SELECT * FROM cpus WHERE id = ?").get(profile.cpuId) as Record<string, unknown> | undefined;
      const gpuRow = db.prepare("SELECT * FROM gpus WHERE id = ?").get(profile.gpuId) as Record<string, unknown> | undefined;

      if (!cpuRow || !gpuRow) continue;

      const entry: CompareEntry = {
        profile: profile as unknown as CompareEntry["profile"],
        cpu: cpuRow as unknown as CompareEntry["cpu"],
        gpu: { ...gpuRow, isLaptop: Boolean(gpuRow.isLaptop) } as unknown as CompareEntry["gpu"],
      };

      if (gameId) {
        try {
          entry.fpsEstimate = runFullEstimate(
            entry.profile,
            gameId as string,
          );
          entry.gameId = gameId as string;
        } catch {
          // Skip FPS estimate if calculation fails
        }
      }

      entries.push(entry);
    }

    return Response.json(entries);
  } catch (error) {
    console.error("Error comparing profiles:", error);
    return Response.json(
      { error: "Failed to compare profiles" },
      { status: 500 },
    );
  }
}

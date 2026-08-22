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
      .prepare(`
        SELECT f.id, f.userId, f.gameId, f.createdAt,
               g.title, g.genre, g.tags, g.developer, g.engine, g.releaseDate
        FROM favorites f
        JOIN games g ON g.id = f.gameId
        WHERE f.userId = ?
        ORDER BY f.createdAt DESC
      `)
      .all(session.user.id) as Record<string, unknown>[];

    const favorites = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      gameId: row.gameId,
      createdAt: row.createdAt,
      game: {
        id: row.gameId,
        title: row.title,
        genre: row.genre,
        tags: JSON.parse((row.tags as string) || "[]"),
        developer: row.developer,
        engine: row.engine,
        releaseDate: row.releaseDate,
      },
    }));

    return Response.json(favorites);
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return Response.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { gameId } = body;

    if (!gameId) {
      return Response.json({ error: "gameId is required" }, { status: 400 });
    }

    const db = getDb();

    const game = db.prepare("SELECT id FROM games WHERE id = ?").get(gameId) as { id: string } | undefined;
    if (!game) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }

    const existing = db
      .prepare("SELECT id FROM favorites WHERE userId = ? AND gameId = ?")
      .get(session.user.id, gameId) as { id: string } | undefined;

    if (existing) {
      return Response.json({ error: "Already in favorites" }, { status: 409 });
    }

    const id = uuidv4();
    db.prepare(
      "INSERT INTO favorites (id, userId, gameId, createdAt) VALUES (?, ?, ?, ?)"
    ).run(id, session.user.id, gameId, new Date().toISOString());

    return Response.json({ id, userId: session.user.id, gameId }, { status: 201 });
  } catch (error) {
    console.error("Error adding favorite:", error);
    return Response.json({ error: "Failed to add favorite" }, { status: 500 });
  }
}

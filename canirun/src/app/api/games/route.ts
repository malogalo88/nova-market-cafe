import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q");
    const genre = searchParams.get("genre");
    const freeToPlay = searchParams.get("freeToPlay");
    const multiplayer = searchParams.get("multiplayer");
    const singlePlayer = searchParams.get("singlePlayer");
    const controllerSupport = searchParams.get("controllerSupport");
    const lowEndFriendly = searchParams.get("lowEndFriendly");
    const aaa = searchParams.get("aaa");
    const platform = searchParams.get("platform");
    const sort = searchParams.get("sort");

    let query = "SELECT * FROM games WHERE 1=1";
    const params: (string | number)[] = [];

    if (q) {
      query += " AND (title LIKE ? OR developer LIKE ? OR publisher LIKE ? OR engine LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (genre) {
      query += " AND genre = ?";
      params.push(genre);
    }

    if (freeToPlay === "1" || freeToPlay === "true") {
      query += " AND freeToPlay = 1";
    }

    if (multiplayer === "1" || multiplayer === "true") {
      query += " AND multiplayer = 1";
    }

    if (singlePlayer === "1" || singlePlayer === "true") {
      query += " AND singlePlayer = 1";
    }

    if (controllerSupport === "1" || controllerSupport === "true") {
      query += " AND controllerSupport = 1";
    }

    if (lowEndFriendly === "1" || lowEndFriendly === "true") {
      query += " AND lowEndFriendly = 1";
    }

    if (aaa === "1" || aaa === "true") {
      query += " AND aaa = 1";
    }

    if (platform) {
      query += " AND platforms LIKE ?";
      params.push(`%${platform}%`);
    }

    if (sort === "name") {
      query += " ORDER BY title ASC";
    } else if (sort === "popularity") {
      query += " ORDER BY releaseDate DESC";
    } else if (sort === "performance") {
      query += " ORDER BY minRamGB ASC";
    } else {
      query += " ORDER BY title ASC";
    }

    const rows = db.prepare(query).all(...params) as (Record<string, unknown>)[];

    const games = rows.map((row) => ({
      ...row,
      tags: JSON.parse(row.tags as string || "[]"),
      freeToPlay: Boolean(row.freeToPlay),
      multiplayer: Boolean(row.multiplayer),
      singlePlayer: Boolean(row.singlePlayer),
      controllerSupport: Boolean(row.controllerSupport),
      lowEndFriendly: Boolean(row.lowEndFriendly),
      aaa: Boolean(row.aaa),
    }));

    return Response.json(games);
  } catch (error) {
    console.error("Error fetching games:", error);
    return Response.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}

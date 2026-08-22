import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

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
      .prepare("SELECT id FROM favorites WHERE id = ? AND userId = ?")
      .get(id, session.user.id) as { id: string } | undefined;

    if (!existing) {
      return Response.json({ error: "Favorite not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM favorites WHERE id = ? AND userId = ?").run(id, session.user.id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error removing favorite:", error);
    return Response.json({ error: "Failed to remove favorite" }, { status: 500 });
  }
}

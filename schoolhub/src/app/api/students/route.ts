import { authedRoute, jsonOk } from "@/server/api";
import { listStudentsForActor } from "@/server/services";

export const GET = authedRoute(async ({ req, actor }) => {
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return jsonOk(await listStudentsForActor(actor, q));
}, ["ADMIN", "TEACHER"]);

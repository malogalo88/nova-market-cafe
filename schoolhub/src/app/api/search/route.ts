import { ApiError } from "@/lib/errors";
import { authedRoute, jsonOk } from "@/server/api";
import { globalSearch } from "@/server/services";

export const GET = authedRoute(async ({ req, actor }) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length > 80) throw ApiError.badRequest("Query too long.");
  return jsonOk(await globalSearch(actor, q));
});

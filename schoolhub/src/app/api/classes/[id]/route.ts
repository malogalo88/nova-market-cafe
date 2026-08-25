import { authedRoute, jsonOk } from "@/server/api";
import { getClassDetail } from "@/server/services";

export const GET = authedRoute<{ id: string }>(async ({ actor, params }) =>
  jsonOk(await getClassDetail(actor, params.id))
);

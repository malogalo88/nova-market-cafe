import { authedRoute, jsonOk } from "@/server/api";
import { listTeachersDetailed } from "@/server/services";

export const GET = authedRoute(async () => jsonOk(await listTeachersDetailed()), ["ADMIN"]);

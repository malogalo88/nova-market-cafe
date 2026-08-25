import { authedRoute, jsonOk } from "@/server/api";
import { listClassesForActor } from "@/server/services";

export const GET = authedRoute(async ({ actor }) => jsonOk(await listClassesForActor(actor)));

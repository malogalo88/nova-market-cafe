import { authedRoute, jsonOk } from "@/server/api";
import { getDashboard } from "@/server/services";

export const GET = authedRoute(async ({ actor }) => jsonOk(await getDashboard(actor)));

import { authedRoute, jsonOk } from "@/server/api";
import { getStudentProfile } from "@/server/services";

export const GET = authedRoute<{ id: string }>(async ({ actor, params }) =>
  jsonOk(await getStudentProfile(actor, params.id))
);

import { getSessionUser } from "@/server/session";
import { jsonOk, route } from "@/server/api";

export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return jsonOk({ user: null });
  return jsonOk({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
});

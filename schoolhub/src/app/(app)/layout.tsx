import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";
import { AppShell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      me={{
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as "ADMIN" | "TEACHER" | "STUDENT" | "PARENT",
        studentId: user.studentId ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}

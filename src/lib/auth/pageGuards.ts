import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";

/** Server-component guard: defense in depth alongside middleware.ts. */
export async function requireSessionForPage(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export async function requireHrForPage(): Promise<SessionPayload> {
  const session = await requireSessionForPage();
  if (session.role !== "HR") redirect("/dashboard");
  return session;
}

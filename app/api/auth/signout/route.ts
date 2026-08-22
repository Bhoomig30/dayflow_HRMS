import { withApiHandler, ok } from "@/lib/api/handler";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const POST = withApiHandler(async () => {
  const res = ok({ success: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
});

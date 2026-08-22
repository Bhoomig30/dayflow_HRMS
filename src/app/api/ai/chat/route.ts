import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { chatWithDayflowAI } from "@/lib/ai/service";
import { isAIConfigured } from "@/lib/ai/provider";
import { checkAIRateLimit } from "@/lib/ai/rateLimit";

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .optional(),
});

export const POST = withApiHandler(async (req: NextRequest) => {
  // Session is re-verified against the DB on every request (requireSession),
  // and rate limiting keys off that server-verified employeeId — never
  // anything the client could spoof (e.g. a header or body field).
  const session = await requireSession();
  checkAIRateLimit(session.employeeId);
  const body = await req.json();
  const { message, history } = schema.parse(body);
  const result = await chatWithDayflowAI(session, message, history ?? []);
  return ok(result);
});

export const GET = withApiHandler(async () => {
  await requireSession();
  return ok({ available: isAIConfigured() });
});
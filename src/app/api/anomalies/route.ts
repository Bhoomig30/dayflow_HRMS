import { withApiHandler, ok } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { detectAnomaliesForWindow } from "@/lib/services/anomaly.service";

export const GET = withApiHandler(async () => {
  await requireRole("HR");
  const anomalies = await detectAnomaliesForWindow(30);
  return ok({ anomalies });
});

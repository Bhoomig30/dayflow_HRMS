import type { SessionPayload } from "@/lib/auth/session";
import { getAIProvider, type AIChatMessage } from "./provider";
import { buildToolsForSession, executeTool } from "./tools";
import { todayISO } from "@/lib/utils/date";

const MAX_TOOL_ITERATIONS = 4;

export interface AIChatResult {
  available: boolean;
  reply: string;
  toolsUsed: string[];
}

function systemPrompt(session: SessionPayload): string {
  return [
    `You are Dayflow AI, the assistant embedded in the Dayflow HRMS.`,
    `Today's date is ${todayISO()}.`,
    `You are speaking with ${session.fullName} (Employee ID ${session.employeeCode}), whose role is ${session.role}.`,
    `You can ONLY answer using data returned by the tools available to you in this conversation. Never state a specific number, date, name or status unless you retrieved it via a tool call in this conversation.`,
    `If a tool returns no data (empty list, null), say so plainly rather than guessing — e.g. "You have no leave requests on file."`,
    session.role === "EMPLOYEE"
      ? `You only have tools that return this user's own data. You have no way to see any other employee's information, and you must never claim otherwise.`
      : `You have HR-level tools that return aggregate/organization-wide data. You do not have a tool to look up one specific employee's individual payroll or personal leave records — if asked for that, say this assistant does not currently support per-employee lookups and suggest checking Employee 360 in the HR Command Center.`,
    `Keep answers concise and specific. Use the actual numbers/dates from tool results.`,
  ].join("\n");
}

export async function chatWithDayflowAI(session: SessionPayload, userMessage: string, priorTurns: AIChatMessage[] = []): Promise<AIChatResult> {
  const provider = getAIProvider();
  if (!provider) {
    return {
      available: false,
      reply: "Dayflow AI is currently unavailable. Please check the AI configuration (AI_PROVIDER / AI_API_KEY / AI_MODEL).",
      toolsUsed: [],
    };
  }

  const tools = buildToolsForSession(session);
  const messages: AIChatMessage[] = [
    { role: "system", content: systemPrompt(session) },
    ...sanitizePriorTurns(priorTurns),
    { role: "user", content: userMessage },
  ];

  const toolsUsed: string[] = [];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await provider.chat(messages, tools);

      if (response.toolCalls.length === 0) {
        return { available: true, reply: response.content?.trim() || "I couldn't find anything to say about that — could you rephrase?", toolsUsed };
      }

      messages.push({ role: "assistant", content: response.content || "", toolCalls: response.toolCalls });

      for (const call of response.toolCalls) {
        toolsUsed.push(call.name);
        const result = await executeTool(session, call.name, call.arguments || {});
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify(result),
        });
      }
    }

    return {
      available: true,
      reply: "I wasn't able to finish gathering the data needed to answer that. Please try a more specific question.",
      toolsUsed,
    };
  } catch (err) {
    console.error("[dayflow-ai] provider error:", err);
    return {
      available: false,
      reply: "Dayflow AI ran into a problem reaching the configured AI provider. Please try again shortly.",
      toolsUsed,
    };
  }
}

/** Keep only role/content from client-supplied history — never trust toolCalls/ids coming from the client. */
function sanitizePriorTurns(turns: AIChatMessage[]): AIChatMessage[] {
  return turns
    .filter((t) => t.role === "user" || t.role === "assistant")
    .slice(-8)
    .map((t) => ({ role: t.role, content: String(t.content || "").slice(0, 4000) }));
}

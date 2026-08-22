/**
 * AI provider abstraction.
 *
 *   UI → /api/ai/chat → AI Service (lib/ai/service.ts) → Controlled Tools
 *        (lib/ai/tools.ts) → Authorized domain services → Database
 *
 * Nothing here is hardcoded to a specific vendor. The active provider is
 * selected entirely by environment variables, checked in this order:
 *
 *   1. Groq — powers "Dayflow AI" (the default going forward):
 *        GROQ_API_KEY   secret key from console.groq.com (server-side only,
 *                       NEVER a NEXT_PUBLIC_* var, never sent to the browser)
 *        GROQ_MODEL     model id; falls back to GROQ_DEFAULT_MODEL below if
 *                       GROQ_API_KEY is set but GROQ_MODEL is not
 *
 *   2. Legacy OpenAI/Anthropic path — kept for backward compatibility, only
 *      consulted when GROQ_API_KEY is unset:
 *        AI_PROVIDER   "openai" | "anthropic"   (which HTTP API to call)
 *        AI_API_KEY    secret key for that provider
 *        AI_MODEL      model id, e.g. "gpt-4o-mini" or "claude-sonnet-4-5"
 *
 * If none of the above are configured, getAIProvider() returns null and the
 * AI service reports a clear "unavailable" state — Dayflow never fabricates
 * an AI response, and the rest of the app keeps working normally.
 */

import Groq from "groq-sdk";

// Verified current (not deprecated), tool-calling-capable Groq model with a
// 131k-token context window. Only used when GROQ_API_KEY is set but
// GROQ_MODEL is left unset — set GROQ_MODEL explicitly to override.
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-20b";

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export type AIChatRole = "system" | "user" | "assistant" | "tool";

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
  // Present on assistant messages that requested tool calls.
  toolCalls?: AIToolCall[];
  // Present on role:"tool" messages — which call this is a result for.
  toolCallId?: string;
  name?: string;
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIProviderResponse {
  content: string | null;
  toolCalls: AIToolCall[];
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  chat(messages: AIChatMessage[], tools: AIToolDefinition[]): Promise<AIProviderResponse>;
}

class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  constructor(private apiKey: string, readonly model: string) {}

  async chat(messages: AIChatMessage[], tools: AIToolDefinition[]): Promise<AIProviderResponse> {
    const body = {
      model: this.model,
      messages: messages.map((m) => {
        if (m.role === "tool") {
          return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
        }
        if (m.role === "assistant" && m.toolCalls?.length) {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          };
        }
        return { role: m.role, content: m.content };
      }),
      tools: tools.length
        ? tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }))
        : undefined,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    const choice = json.choices?.[0]?.message;
    const toolCalls: AIToolCall[] = (choice?.tool_calls ?? []).map((tc: { id: string; function: { name: string; arguments: string } }) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParseJson(tc.function.arguments),
    }));
    return { content: choice?.content ?? null, toolCalls };
  }
}

class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  constructor(private apiKey: string, readonly model: string) {}

  async chat(messages: AIChatMessage[], tools: AIToolDefinition[]): Promise<AIProviderResponse> {
    const system = messages.find((m) => m.role === "system")?.content;
    const rest = messages.filter((m) => m.role !== "system");

    const anthropicMessages = rest.map((m) => {
      if (m.role === "tool") {
        return {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }],
        };
      }
      if (m.role === "assistant" && m.toolCalls?.length) {
        const blocks: Record<string, unknown>[] = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        for (const tc of m.toolCalls) blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
        return { role: "assistant", content: blocks };
      }
      return { role: m.role, content: m.content };
    });

    const body = {
      model: this.model,
      max_tokens: 1024,
      system,
      messages: anthropicMessages,
      tools: tools.length ? tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) : undefined,
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    const content: string[] = [];
    const toolCalls: AIToolCall[] = [];
    for (const block of json.content ?? []) {
      if (block.type === "text") content.push(block.text);
      else if (block.type === "tool_use") toolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
    }
    return { content: content.join("\n") || null, toolCalls };
  }
}

// Groq's Chat Completions API is OpenAI-compatible, so message/tool shaping
// mirrors OpenAIProvider above — but this uses the official `groq-sdk`
// client (typed request/response shapes, built-in retry on rate-limit /
// connection errors) instead of a raw fetch() call.
class GroqProvider implements AIProvider {
  readonly name = "groq";
  private client: Groq;
  constructor(apiKey: string, readonly model: string) {
    this.client = new Groq({ apiKey });
  }

  async chat(messages: AIChatMessage[], tools: AIToolDefinition[]): Promise<AIProviderResponse> {
    const groqMessages = messages.map((m) => {
      if (m.role === "tool") {
        return { role: "tool" as const, tool_call_id: m.toolCallId!, content: m.content };
      }
      if (m.role === "assistant" && m.toolCalls?.length) {
        return {
          role: "assistant" as const,
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        };
      }
      if (m.role === "system") return { role: "system" as const, content: m.content };
      if (m.role === "user") return { role: "user" as const, content: m.content };
      return { role: "assistant" as const, content: m.content };
    });

    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.model,
        messages: groqMessages,
        tools: tools.length
          ? tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }))
          : undefined,
      });
    } catch (err) {
      // Re-thrown as a plain Error with a safe, non-leaking message — the
      // caller (service.ts) logs the original server-side and never surfaces
      // raw provider internals (or the API key, which never appears in any
      // Groq SDK error message/body) to the client.
      if (err instanceof Groq.RateLimitError) {
        throw new Error("Groq API rate limit exceeded");
      }
      if (err instanceof Groq.AuthenticationError) {
        throw new Error("Groq API authentication failed — check GROQ_API_KEY");
      }
      if (err instanceof Groq.APIError) {
        throw new Error(`Groq API error ${err.status ?? ""}: ${err.name}`);
      }
      throw new Error("Groq API request failed");
    }

    const choice = completion.choices?.[0]?.message;
    const toolCalls: AIToolCall[] = (choice?.tool_calls ?? [])
      .filter((tc): tc is typeof tc & { type: "function" } => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: safeParseJson(tc.function.arguments),
      }));
    return { content: choice?.content ?? null, toolCalls };
  }
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function getAIProvider(): AIProvider | null {
  // Groq takes priority — this is the primary path going forward.
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    const groqModel = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
    return new GroqProvider(groqApiKey, groqModel);
  }

  // Fall back to the legacy openai/anthropic path — unchanged behavior for
  // any deployment already configured with AI_PROVIDER/AI_API_KEY/AI_MODEL.
  const providerName = (process.env.AI_PROVIDER || "").toLowerCase();
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!providerName || !apiKey || !model) return null;

  if (providerName === "openai") return new OpenAIProvider(apiKey, model);
  if (providerName === "anthropic") return new AnthropicProvider(apiKey, model);
  return null;
}

export function isAIConfigured(): boolean {
  return getAIProvider() !== null;
}

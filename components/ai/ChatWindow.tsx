"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Bot, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { api, ClientApiError } from "@/lib/client/api";
import { cn } from "@/lib/utils/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatWindow({ suggestions }: { suggestions: string[] }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<{ available: boolean }>("/api/ai/chat")
      .then((res) => setAvailable(res.available))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setError(null);
    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post<{ available: boolean; reply: string }>("/api/ai/chat", { message: text, history: messages });
      if (!res.available) setAvailable(false);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  if (available === false) {
    return (
      <Alert tone="warning">
        Dayflow AI is currently unavailable. Please check the AI configuration (AI_PROVIDER / AI_API_KEY / AI_MODEL) in your environment. The
        rest of Dayflow works normally without it.
      </Alert>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col rounded-[var(--df-radius-lg)] border border-[var(--df-border)] bg-[var(--df-surface)]">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-[var(--df-accent-soft)] text-[var(--df-accent)]">
              <Sparkles className="size-5" />
            </div>
            <p className="text-sm font-medium text-[var(--df-text-primary)]">Ask Dayflow AI</p>
            <p className="max-w-xs text-xs text-[var(--df-text-muted)]">Answers are grounded only in data you&apos;re authorized to see.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-[var(--df-border-strong)] px-3 py-1.5 text-xs text-[var(--df-text-secondary)] hover:bg-white/5 hover:text-[var(--df-text-primary)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex items-start gap-2.5", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                m.role === "user" ? "bg-[var(--df-primary)] text-white" : "bg-[var(--df-accent-soft)] text-[var(--df-accent)]"
              )}
            >
              {m.role === "user" ? <UserIcon className="size-3.5" /> : <Bot className="size-3.5" />}
            </div>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-[var(--df-radius-md)] px-3.5 py-2.5 text-sm",
                m.role === "user" ? "bg-[var(--df-primary)] text-white" : "bg-[var(--df-bg-elevated)] text-[var(--df-text-primary)]"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-[var(--df-accent-soft)] text-[var(--df-accent)]">
              <Bot className="size-3.5" />
            </div>
            <div className="rounded-[var(--df-radius-md)] bg-[var(--df-bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--df-text-muted)]">Thinking…</div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-5">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-[var(--df-border)] p-3"
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your attendance, leave, or payroll…" disabled={available === null} />
        <Button type="submit" disabled={!input.trim() || loading} loading={loading}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

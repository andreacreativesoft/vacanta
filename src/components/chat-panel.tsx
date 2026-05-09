"use client";

import * as React from "react";
import { Send, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/dto";

export function ChatPanel({
  searchId,
  initialMessages,
}: {
  searchId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ searchId, message: text }),
      });
      const data = (await res.json()) as
        | { ok: true; reply: ChatMessage; userMessageId: string }
        | { ok: false; error: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        const errMsg = "error" in data ? data.error : "Chat failed";
        setMessages((m) => [
          ...m,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `Error: ${errMsg}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages((m) =>
          m
            .map((msg) =>
              msg.id === optimistic.id ? { ...msg, id: data.userMessageId } : msg,
            )
            .concat(data.reply),
        );
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Network"}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="space-y-3 p-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ask anything about this search — &ldquo;which trip is cheapest?&rdquo;,
              &ldquo;refresh prices&rdquo;, &ldquo;compare with my Italy
              search&rdquo;.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Thinking…
            </div>
          )}
        </div>
      </ScrollArea>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t p-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask Claude…"
          rows={2}
          className="resize-none"
        />
        <Button type="submit" size="icon" disabled={pending}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

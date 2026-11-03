import { useRef, useState, useCallback, useEffect } from "react";
import { useAppStore } from "../store/useStore";
import { StoreAssistant } from "../lib/aiAssistant";
import { fmtMoney } from "../lib/format";
import { Button, IconButton, Input, toast } from "./ui";
import { Bot, Send, X, Clock } from "lucide-react";

interface AIChatProps {
  open: boolean;
  onClose: () => void;
}

export function AIChat({ open, onClose }: AIChatProps): JSX.Element | null {
  const db = useAppStore((s) => s.db);
  const symbol = db.settings.currencySymbol;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string; time: string }>>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const assistant = new StoreAssistant({ db, symbol, today: new Date().toISOString().slice(0, 10) });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && messages.length === 0) {
      addAssistantMessage("Hi! I'm your store assistant. Ask me about sales, stock, products, or customers.");
    }
  }, [open, messages.length]);

  const addAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: "assistant", text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { role: "user", text: trimmed, time }]);
    setInput("");
    setLoading(true);

    // Simulate a brief "thinking" delay then answer
    setTimeout(() => {
      try {
        const answer = assistant.answer(trimmed);
        addAssistantMessage(answer);
      } catch (err) {
        addAssistantMessage("Sorry, I had trouble answering that. Try asking about sales, stock, or products.");
        toast.error("Assistant error");
      } finally {
        setLoading(false);
      }
    }, 600);
  }, [input, loading, addAssistantMessage]);

  const quickQuestions = [
    "What's my revenue today?",
    "Which products are low on stock?",
    "What's my best selling product?",
    "How many sales today?",
  ];

  if (!open) return null;

  return (
    <div className="chat-enter fixed bottom-4 right-4 z-[100] flex flex-col w-[420px] h-[560px] sm:w-[480px] sm:h-[640px]">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-2xl border border-b-0 px-4 py-3 shadow-lg"
           style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <Bot size={18} />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Nova Assistant</div>
            <div className="text-[11px] text-muted">Ask about your store</div>
          </div>
        </div>
        <IconButton label="Close chat" onClick={onClose} className="!p-1.5">
          <X size={16} />
        </IconButton>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: "var(--bg)" }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                m.role === "user"
                  ? "bg-accent text-accent-ink self-end"
                  : "bg-surface text-ink border border-border self-start"
              }`}
              style={{ borderColor: "var(--border)" }}
            >
              {m.text}
            </div>
            <span className={`self-end mt-0.5 text-[10px] text-muted`}>{m.time}</span>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="bg-surface text-ink border border-border rounded-xl px-3.5 py-2.5 text-[13px] self-start animate-pulse" style={{ borderColor: "var(--border)" }}>
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce"></span>
                <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0.15s" }}></span>
                <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0.3s" }}></span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick chips */}
      <div className="p-3 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-[11px] text-muted mb-2">Try asking:</p>
        <div className="flex flex-wrap gap-1.5">
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => {
                setInput(q);
                handleSend();
              }}
              className="rounded-lg border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent-strong hover:border-accent"
              style={{ borderColor: "var(--border)", whiteSpace: "nowrap" }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex items-end gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about sales, stock, products…"
            className="!bg-transparent !border-none !py-1.5 !px-0 text-[13px] min-w-0"
            disabled={loading}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={loading || !input.trim()}
            onClick={handleSend}
            className="!px-3 !py-2"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

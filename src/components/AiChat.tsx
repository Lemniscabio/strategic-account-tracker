"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "model";
  content: string;
}

interface Props {
  accountId: string;
  onClose: () => void;
  onKeywordsAccepted: (keywords: string[]) => void;
}

function parseSuggestedKeywords(text: string): string[] | null {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const match = cleaned.match(/\{"suggestedKeywords"\s*:\s*\[[\s\S]*?\]\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed.suggestedKeywords)) {
      return parsed.suggestedKeywords.filter((k: unknown) => typeof k === "string");
    }
  } catch {
    // Silent fail — show as plain text
  }
  return null;
}

export default function AiChat({ accountId, onClose, onKeywordsAccepted }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const quickActions = [
    "Brief me on this account",
    "Suggest keywords",
    "What should I do next?",
  ];

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming) return;

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    const assistantMsg: Message = { role: "model", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch(`/api/accounts/${accountId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          if (data.startsWith("[ERROR]")) {
            fullText += "\n\n⚠️ " + data.slice(8);
            break;
          }
          fullText += data;
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "model", content: fullText };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "model",
          content: "Sorry, I couldn't process that request. Please try again.",
        };
        return updated;
      });
    }

    setStreaming(false);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[400px] flex-col border-l border-gray-800 bg-gray-950 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-sm font-bold text-white">AI Assistant</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Quick actions:</p>
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => sendMessage(action)}
                className="block w-full rounded-lg border border-gray-800 px-3 py-2 text-left text-sm text-gray-400 hover:border-purple-600 hover:text-white"
              >
                {action}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === "user" ? "text-right" : ""}`}>
            <div
              className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-900 text-gray-300"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.role === "model" && !streaming && (() => {
                const keywords = parseSuggestedKeywords(msg.content);
                if (!keywords) return null;
                return (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-800 pt-2">
                    {keywords.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => onKeywordsAccepted([kw])}
                        className="rounded-full bg-purple-900/40 px-2 py-0.5 text-xs text-purple-300 hover:bg-purple-800"
                      >
                        + {kw}
                      </button>
                    ))}
                    <button
                      onClick={() => onKeywordsAccepted(keywords)}
                      className="rounded-full bg-purple-600 px-2 py-0.5 text-xs text-white hover:bg-purple-700"
                    >
                      Add all
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="text-xs text-gray-600">Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask about this account..."
            disabled={streaming}
            className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface Source {
  title: string;
  url: string;
}

interface Message {
  role: "user" | "model";
  content: string;
  sources?: Source[];
}

interface Props {
  accountId: string;
  onClose: () => void;
  onKeywordsAccepted: (keywords: string[]) => void;
}

function cleanCitations(text: string): string {
  return text
    .replace(/\s*\[cite:\s*[^\]]*\]/g, "")
    .replace(/\s*\[search_\d+\]/g, "")
    .replace(/\s*\[\d+,\s*cite:\s*[^\]]*\]/g, "")
    .replace(/  +/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

/** Post-process AI response to ensure proper markdown formatting */
function ensureMarkdown(text: string): string {
  // Known section headers that Gemini outputs as plain text
  const sectionHeaders = [
    "Status", "Recent Activity", "Top Signals", "Top Signal",
    "Risk", "Risk/Opportunity", "Risks", "Opportunity",
    "Suggested Actions", "Action Plan", "Next Steps",
    "Signal Analysis", "Summary", "Overview", "Assessment",
    "Touchpoint History", "Key Signals", "Recommendations",
  ];

  let result = text;

  // Convert plain-text section headers to ## markdown headers
  // Match lines that are just a header word/phrase (possibly with trailing colon)
  for (const header of sectionHeaders) {
    // Match header at start of line, optionally followed by colon, then newline
    const pattern = new RegExp(`^(${header}):?\\s*$`, "gmi");
    result = result.replace(pattern, `\n## $1\n`);
  }

  // Detect bullet-like patterns that Gemini outputs without dash prefix:
  // Lines starting with bold text followed by colon are likely list items
  // e.g., "**Merger completed:** Some text" → "- **Merger completed:** Some text"
  result = result.replace(/^(\*\*[^*]+:\*\*\s)/gm, "- $1");

  // Also handle bold without asterisks at line start followed by colon
  // e.g., "Merger completed: Some text" when it looks like a list item
  // Only do this inside sections (after a ## header)
  const lines = result.split("\n");
  let inSection = false;
  const processed: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      inSection = true;
      processed.push(line);
    } else if (inSection && line.match(/^[A-Z][^.!?\n]{2,30}:\s/) && !line.startsWith("-") && !line.startsWith("#")) {
      // Looks like a label: description pattern — convert to bullet with bold label
      const colonIdx = line.indexOf(":");
      const label = line.slice(0, colonIdx);
      const rest = line.slice(colonIdx);
      processed.push(`- **${label}**${rest}`);
    } else {
      processed.push(line);
    }
  }

  result = processed.join("\n");

  // Ensure blank lines around headers
  result = result.replace(/([^\n])\n(## )/g, "$1\n\n$2");
  result = result.replace(/(## [^\n]+)\n([^\n])/g, "$1\n\n$2");

  // Ensure suggested next step stands out
  result = result.replace(/^(\*\*Suggested next step:\*\*)/gm, "\n---\n\n$1");

  // Clean up excessive blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
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
    // Silent fail
  }
  return null;
}

export default function AiChat({ accountId, onClose, onKeywordsAccepted }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<{ _id: string; title: string; updatedAt: string }[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showThreadList, setShowThreadList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchThreads = useCallback(async () => {
    const res = await fetch(`/api/accounts/${accountId}/chats`);
    if (res.ok) {
      const data = await res.json();
      setThreads(data);
    }
  }, [accountId]);

  const loadThread = async (threadId: string) => {
    const res = await fetch(`/api/accounts/${accountId}/chats/${threadId}`);
    if (res.ok) {
      const thread = await res.json();
      setMessages(thread.messages.map((m: { role: string; content: string; sources?: { title: string; url: string }[] }) => ({
        ...m,
        content: m.role === "model" ? ensureMarkdown(cleanCitations(m.content)) : m.content,
      })));
      setActiveThreadId(threadId);
      setShowThreadList(false);
    }
  };

  const saveToThread = async (threadId: string, msgs: Message[]) => {
    await fetch(`/api/accounts/${accountId}/chats/${threadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: msgs.map((m) => ({ role: m.role, content: m.content, sources: m.sources || [] })),
      }),
    });
  };

  useEffect(() => {
    fetchThreads().then(() => {});
  }, [fetchThreads]);

  useEffect(() => {
    if (threads.length > 0 && !activeThreadId && messages.length === 0) {
      loadThread(threads[0]._id);
    }
  }, [threads]);

  const quickActions = [
    "Brief me on this account",
    "Suggest keywords",
    "What should I do next?",
  ];

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/accounts/${accountId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map((m) => ({ role: m.role, content: m.content })) }),
      });

      const data = await res.json();

      const aiMsg: Message = {
        role: "model",
        content: ensureMarkdown(cleanCitations(data.text || "No response received.")),
        sources: data.sources || [],
      };
      const allMessages = [...newMessages, aiMsg];
      setMessages(allMessages);

      // Persist to thread
      if (activeThreadId) {
        await saveToThread(activeThreadId, allMessages);
        fetchThreads();
      } else {
        // Create new thread with first message as title
        const createRes = await fetch(`/api/accounts/${accountId}/chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: content.slice(0, 50) }),
        });
        if (createRes.ok) {
          const thread = await createRes.json();
          setActiveThreadId(thread._id);
          await saveToThread(thread._id, allMessages);
          fetchThreads();
        }
      }
    } catch {
      setMessages([...newMessages, {
        role: "model",
        content: "Sorry, something went wrong. Please try again.",
      }]);
    }

    setLoading(false);
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowThreadList(!showThreadList)}
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
            title="Chat history"
          >
            {threads.length > 0 ? `${threads.length} chats` : "History"}
          </button>
          <button
            onClick={() => {
              setActiveThreadId(null);
              setMessages([]);
              setShowThreadList(false);
            }}
            className="rounded px-2 py-1 text-xs text-purple-400 hover:bg-purple-900/30 hover:text-purple-300"
          >
            + New
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">
            ✕
          </button>
        </div>
      </div>

      {/* Thread list */}
      {showThreadList && threads.length > 0 && (
        <div className="border-b border-gray-800 max-h-48 overflow-y-auto">
          {threads.map((t) => (
            <button
              key={t._id}
              onClick={() => loadThread(t._id)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-900 ${
                activeThreadId === t._id ? "bg-gray-900 border-l-2 border-purple-500" : ""
              }`}
            >
              <span className="text-xs text-gray-300 truncate max-w-[240px]">{t.title}</span>
              <span className="text-[10px] text-gray-600 ml-2 shrink-0">
                {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Quick actions:</p>
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => sendMessage(action)}
                className="block w-full rounded-lg border border-gray-800 px-3 py-2 text-left text-sm text-gray-400 hover:border-purple-600 hover:text-white transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white max-w-[80%]"
                  : "bg-gray-900 text-gray-300 w-full"
              }`}
            >
              {msg.role === "model" ? (
                <>
                  {/* Markdown content */}
                  <div className="prose prose-sm prose-invert max-w-none
                    prose-p:my-3 prose-p:leading-relaxed
                    prose-headings:mt-5 prose-headings:mb-2 prose-headings:text-white
                    prose-h2:text-base prose-h2:font-bold prose-h2:border-b prose-h2:border-gray-800 prose-h2:pb-1
                    prose-h3:text-sm prose-h3:font-bold
                    prose-ul:my-2.5 prose-ul:pl-5 prose-ul:list-disc
                    prose-ol:my-2.5 prose-ol:pl-5 prose-ol:list-decimal
                    prose-li:my-1.5 prose-li:leading-relaxed
                    prose-strong:text-white prose-strong:font-semibold
                    prose-a:text-blue-400 prose-a:no-underline hover:prose-a:text-blue-300
                    prose-hr:my-4 prose-hr:border-gray-800
                    [&_ul_ul]:mt-1 [&_ul_ul]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 border-t border-gray-800 pt-2">
                      <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1.5">Sources</div>
                      <div className="space-y-1">
                        {msg.sources.map((src, j) => (
                          <a
                            key={j}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <span className="shrink-0">↗</span>
                            <span className="truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keyword suggestions */}
                  {(() => {
                    const keywords = parseSuggestedKeywords(msg.content);
                    if (!keywords) return null;
                    return (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-800 pt-2">
                        {keywords.map((kw) => (
                          <button
                            key={kw}
                            onClick={() => onKeywordsAccepted([kw])}
                            className="rounded-full bg-purple-900/40 px-2.5 py-1 text-xs text-purple-300 hover:bg-purple-800 transition-colors"
                          >
                            + {kw}
                          </button>
                        ))}
                        <button
                          onClick={() => onKeywordsAccepted(keywords)}
                          className="rounded-full bg-purple-600 px-2.5 py-1 text-xs text-white hover:bg-purple-700 transition-colors"
                        >
                          Add all
                        </button>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div>{msg.content}</div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="bg-gray-900 rounded-lg px-3 py-3 w-full">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              Thinking...
            </div>
          </div>
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
            disabled={loading}
            className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

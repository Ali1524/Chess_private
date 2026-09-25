import { useState, useEffect, useRef } from "react";
import type { AppSocket } from "../../services/socket";
import type { ChatMessage } from "../../types/game";

interface ChatPanelProps {
  socket: AppSocket;
  myPlayerId: string | null;
}

export default function ChatPanel({ socket, myPlayerId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("chat:message", onMessage);
    return () => { socket.off("chat:message", onMessage); };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    socket.emit("chat:message", { message: text });
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-panel rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-text-secondary text-xs font-medium uppercase tracking-wider">Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-text-secondary text-xs text-center mt-4 opacity-60">
            Say hello to your opponent
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.playerId === myPlayerId;
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
            >
              <span className="text-text-secondary text-xs px-1">
                {isMe ? "You" : msg.displayName}
              </span>
              <div
                className={`px-3 py-2 rounded-lg text-sm max-w-[85%] break-words ${
                  isMe
                    ? "bg-accent text-bg"
                    : "bg-bg border border-border text-text-primary"
                }`}
              >
                {/* dangerouslySetInnerHTML NOT used - server already sanitized, we display as text */}
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-border p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Message…"
          className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-3 py-2 bg-accent hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed text-bg rounded-lg text-sm font-medium transition-colors"
        >
          →
        </button>
      </form>
    </div>
  );
}

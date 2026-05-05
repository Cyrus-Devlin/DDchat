"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import ChatInput from "./ChatInput";
import FeedbackPanel from "./FeedbackPanel";

interface StreamingMessage {
  text: string;
  toolsCalled: string[];
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface Props {
  onSwitchToCoach: (message: string) => void;
}

export default function ChatPage({ onSwitchToCoach }: Props) {
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDefault = useMutation(api.conversations.getDefault);
  const clearConversation = useMutation(api.messages.clearConversation);
  const getOrCreateCoach = useMutation(api.coachConversations.getOrCreate);
  const saveFounderMessage = useMutation(api.coachMessages.saveFounderMessage);
  const recordFeedback = useMutation(api.feedback.record);

  useEffect(() => {
    getDefault({}).then((id) => setConversationId(id));
  }, []);

  const messages = useQuery(
    api.messages.list,
    conversationId ? { conversationId } : "skip"
  );

  const showToast = (message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const handleClear = async () => {
    if (!conversationId) return;
    await clearConversation({ conversationId });
  };

  const handleSend = async (text: string) => {
    if (!conversationId) return;

    setStreaming({ text: "", toolsCalled: [] });

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, text }),
    });

    if (!res.body) {
      setStreaming(null);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6)) as
            | { type: "delta"; text: string }
            | { type: "tool"; name: string }
            | { type: "done" }
            | { type: "error"; message: string };

          if (json.type === "delta") {
            setStreaming((prev) =>
              prev ? { ...prev, text: prev.text + json.text } : null
            );
          } else if (json.type === "tool") {
            setStreaming((prev) =>
              prev ? { ...prev, toolsCalled: [...prev.toolsCalled, json.name] } : null
            );
          } else if (json.type === "done" || json.type === "error") {
            setStreaming(null);
          }
        } catch {
          // malformed SSE line, skip
        }
      }
    }

    setStreaming(null);
  };

  const handleFeedbackSubmit = async (feedbackText: string): Promise<void> => {
    if (!conversationId) throw new Error("No conversation");

    const res = await fetch("/api/feedback-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, feedbackText }),
    });

    if (!res.ok) {
      showToast("✗ Update failed — try again", "error");
      throw new Error("Update failed");
    }

    setFeedbackOpen(false);
    showToast("✓ Prompt updated", "success");
    await clearConversation({ conversationId });
  };

  const handleMessageFeedback = async (messageId: string, messageText: string, feedbackText: string) => {
    await recordFeedback({
      messageId: messageId as Id<"messages">,
      conversationId: conversationId ?? undefined,
      text: feedbackText,
      sentiment: "negative",
      resolution: "pending",
    });

    const coachConvId = await getOrCreateCoach({});
    await saveFounderMessage({
      coachConversationId: coachConvId,
      text: `🚩 Flagged AI reply for review:\n\n"${messageText}"\n\nMy feedback: ${feedbackText}`,
    });

    const contextMessage = `🚩 Flagged AI reply for review:\n\n"${messageText}"\n\nFounder's feedback: ${feedbackText}`;
    onSwitchToCoach(contextMessage);
  };

  const hasMessages = (messages ?? []).length > 0;

  return (
    <div className="flex flex-col h-full bg-[#e5ddd5]">
      <ChatHeader />
      <div className="flex-1 overflow-hidden relative">
        <MessageThread
          messages={messages ?? []}
          streamingMessage={streaming}
          onFeedback={handleMessageFeedback}
        />
        {toast && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full text-sm text-white shadow-lg whitespace-nowrap ${
            toast.type === "success" ? "bg-[#128c7e]" : "bg-red-500"
          }`}>
            {toast.message}
          </div>
        )}
        {feedbackOpen && (
          <FeedbackPanel
            onSubmit={handleFeedbackSubmit}
            onCancel={() => setFeedbackOpen(false)}
          />
        )}
      </div>
      <ChatInput
        onSend={handleSend}
        onClear={handleClear}
        disabled={!conversationId}
      />
      <div className="bg-[#f0f0f0] px-4 pb-3 pt-1 flex-shrink-0">
        <button
          onClick={() => setFeedbackOpen(true)}
          disabled={!conversationId || !hasMessages}
          className="w-full py-2.5 rounded-full text-sm font-medium bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          Give feedback / Clear
        </button>
      </div>
    </div>
  );
}

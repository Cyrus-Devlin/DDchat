"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import ChatInput from "./ChatInput";

interface StreamingMessage {
  text: string;
  toolsCalled: string[];
}

interface Props {
  onSwitchToCoach: (message: string) => void;
}

export default function ChatPage({ onSwitchToCoach }: Props) {
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);

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

  const handleFeedback = async (messageId: string, messageText: string, feedbackText: string) => {
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

  return (
    <div className="flex flex-col h-full bg-[#e5ddd5]">
      <ChatHeader onFeedback={() => {}} feedbackDisabled={!conversationId} />
      <MessageThread
        messages={messages ?? []}
        streamingMessage={streaming}
        onFeedback={handleFeedback}
      />
      <ChatInput
        onSend={handleSend}
        onClear={handleClear}
        disabled={!conversationId}
      />
    </div>
  );
}

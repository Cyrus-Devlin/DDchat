"use client";

import { useState } from "react";
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
  onFlagForCoach: (messageId: string) => void;
}

export default function ChatPage({ onFlagForCoach }: Props) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<Id<"customers"> | null>(null);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const customers = useQuery(api.customers.list);
  const messages = useQuery(
    api.messages.list,
    conversationId ? { conversationId } : "skip"
  );

  const getOrCreate = useMutation(api.conversations.getOrCreate);

  const handleSelectCustomer = async (customerId: Id<"customers">) => {
    setSelectedCustomerId(customerId);
    const convId = await getOrCreate({ customerId });
    setConversationId(convId);
  };

  const handleSend = async (text: string) => {
    if (!conversationId || !selectedCustomerId) return;

    setStreaming({ text: "", toolsCalled: [] });

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        customerId: selectedCustomerId,
        text,
      }),
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

  return (
    <div className="flex flex-col h-full bg-[#e5ddd5]">
      <ChatHeader
        customers={customers ?? []}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={handleSelectCustomer}
      />
      <MessageThread
        messages={messages ?? []}
        streamingMessage={streaming}
        onFlag={onFlagForCoach}
      />
      <ChatInput onSend={handleSend} disabled={!conversationId} />
    </div>
  );
}

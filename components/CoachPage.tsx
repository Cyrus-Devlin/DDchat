"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import CoachHeader from "./CoachHeader";
import CoachMessageThread from "./CoachMessageThread";
import CoachInput, { FileInfo } from "./CoachInput";

interface Props {
  flaggedMessageId: string | null;
  onFlaggedMessageConsumed: () => void;
}

interface StreamingMessage {
  text: string;
  toolsCalled: string[];
}

export default function CoachPage({ flaggedMessageId, onFlaggedMessageConsumed }: Props) {
  const [conversationId, setConversationId] = useState<Id<"coachConversations"> | null>(null);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);

  const getOrCreate = useMutation(api.coachConversations.getOrCreate);
  const saveFounderMessage = useMutation(api.coachMessages.saveFounderMessage);

  useEffect(() => {
    getOrCreate({}).then((id) => setConversationId(id));
  }, []);

  const messages = useQuery(
    api.coachMessages.list,
    conversationId ? { coachConversationId: conversationId } : "skip"
  );

  const handleSend = async (text: string, fileInfo?: FileInfo) => {
    if (!conversationId) return;

    await saveFounderMessage({
      coachConversationId: conversationId,
      text,
      ...(flaggedMessageId ? { flaggedMessageId: flaggedMessageId as Id<"messages"> } : {}),
      ...(fileInfo ? { attachedFileId: fileInfo.fileId } : {}),
    });

    if (flaggedMessageId) onFlaggedMessageConsumed();

    setStreaming({ text: "", toolsCalled: [] });

    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coachConversationId: conversationId,
        text,
        flaggedMessageId: flaggedMessageId ?? undefined,
        fileId: fileInfo?.fileId,
        fileName: fileInfo?.fileName,
        fileType: fileInfo?.fileType,
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
              prev
                ? { ...prev, toolsCalled: [...prev.toolsCalled, json.name] }
                : null
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
    <div className="flex flex-col h-full bg-[#f5f3ff]">
      <CoachHeader />
      <CoachMessageThread messages={messages ?? []} streamingMessage={streaming} />
      <CoachInput onSend={handleSend} disabled={!conversationId} />
    </div>
  );
}

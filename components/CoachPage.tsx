"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import CoachHeader from "./CoachHeader";
import CoachMessageThread from "./CoachMessageThread";
import CoachInput from "./CoachInput";

interface Props {
  flaggedMessageId: string | null;
  onFlaggedMessageConsumed: () => void;
}

interface StreamingMessage {
  text: string;
}

export default function CoachPage({ flaggedMessageId, onFlaggedMessageConsumed }: Props) {
  const [conversationId, setConversationId] = useState<Id<"coachConversations"> | null>(null);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);

  const getOrCreate = useMutation(api.coachConversations.getOrCreate);
  const saveFounderMessage = useMutation(api.coachMessages.saveFounderMessage);
  const saveCoachReply = useMutation(api.coachMessages.saveCoachReply);

  useEffect(() => {
    getOrCreate({}).then((id) => setConversationId(id));
  }, []);

  const messages = useQuery(
    api.coachMessages.list,
    conversationId ? { coachConversationId: conversationId } : "skip"
  );

  const handleSend = async (text: string) => {
    if (!conversationId) return;

    await saveFounderMessage({
      coachConversationId: conversationId,
      text,
      ...(flaggedMessageId
        ? { flaggedMessageId: flaggedMessageId as Id<"messages"> }
        : {}),
    });

    if (flaggedMessageId) onFlaggedMessageConsumed();

    // Stage C2: placeholder reply until /api/coach is wired in Stage C3
    setStreaming({ text: "" });
    await new Promise((r) => setTimeout(r, 600));
    setStreaming({ text: "Coach Claude is being wired up — coming soon! 🎓" });
    await new Promise((r) => setTimeout(r, 800));

    await saveCoachReply({
      coachConversationId: conversationId,
      text: "Coach Claude is being wired up — coming soon! 🎓",
    });

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

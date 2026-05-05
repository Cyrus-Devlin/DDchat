"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ChatHeader from "./ChatHeader";
import MessageThread from "./MessageThread";
import ChatInput from "./ChatInput";

interface Props {
  onFlagForCoach: (messageId: string) => void;
}

export default function ChatPage({ onFlagForCoach }: Props) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<Id<"customers"> | null>(null);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const customers = useQuery(api.customers.list);
  const messages = useQuery(
    api.messages.list,
    conversationId ? { conversationId } : "skip"
  );

  const getOrCreate = useMutation(api.conversations.getOrCreate);
  const sendMessage = useMutation(api.messages.send);

  const handleSelectCustomer = async (customerId: Id<"customers">) => {
    setSelectedCustomerId(customerId);
    const convId = await getOrCreate({ customerId });
    setConversationId(convId);
  };

  const handleSend = async (text: string) => {
    if (!conversationId || !selectedCustomerId) return;
    await sendMessage({ conversationId, customerId: selectedCustomerId, text });
  };

  return (
    <div className="flex flex-col h-full bg-[#e5ddd5]">
      <ChatHeader
        customers={customers ?? []}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={handleSelectCustomer}
      />
      <MessageThread messages={messages ?? []} onFlag={onFlagForCoach} />
      <ChatInput onSend={handleSend} disabled={!conversationId} />
    </div>
  );
}

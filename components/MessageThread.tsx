"use client";

import { useEffect, useRef } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import MessageBubble from "./MessageBubble";

interface Props {
  messages: Doc<"messages">[];
}

export default function MessageThread({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 text-sm">
            Select a customer to start chatting
          </p>
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg._id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

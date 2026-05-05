"use client";

import { useEffect, useRef } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import MessageBubble from "./MessageBubble";

interface StreamingMessage {
  text: string;
  toolsCalled: string[];
}

interface Props {
  messages: Doc<"messages">[];
  streamingMessage: StreamingMessage | null;
  onFlag?: (messageId: string) => void;
}

export default function MessageThread({ messages, streamingMessage, onFlag }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingMessage?.text]);

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
        <MessageBubble key={msg._id} message={msg} onFlag={onFlag} />
      ))}
      {streamingMessage && (
        <div className="flex flex-col items-start mb-1">
          <div className="max-w-[75%] rounded-lg px-3 py-2 shadow-sm bg-white rounded-tl-sm">
            {streamingMessage.toolsCalled.length > 0 && (
              <p className="text-[11px] text-gray-400 mb-1">
                🔧 {streamingMessage.toolsCalled.join(", ")}
              </p>
            )}
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {streamingMessage.text || (
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">•</span>
                  <span className="animate-bounce [animation-delay:150ms]">•</span>
                  <span className="animate-bounce [animation-delay:300ms]">•</span>
                </span>
              )}
            </p>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

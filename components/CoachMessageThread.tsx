"use client";

import { useEffect, useRef } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import CoachMessageBubble from "./CoachMessageBubble";

interface StreamingMessage {
  text: string;
  toolsCalled: string[];
}

interface Props {
  messages: Doc<"coachMessages">[];
  streamingMessage: StreamingMessage | null;
  isActive: boolean;
}

export default function CoachMessageThread({ messages, streamingMessage, isActive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const raf = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [isActive, messages.length, streamingMessage?.text]);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1 bg-[#f5f3ff]">
      {messages.length === 0 && !streamingMessage && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-2xl mb-2">🎓</p>
            <p className="text-gray-500 text-sm font-medium">Coach Claude</p>
            <p className="text-gray-400 text-xs mt-1 max-w-xs">
              Tell me a business rule, upload a document, or flag an AI reply to get started.
            </p>
          </div>
        </div>
      )}
      {messages.map((msg) => (
        <CoachMessageBubble key={msg._id} message={msg} />
      ))}
      {streamingMessage && (
        <div className="flex flex-col items-start mb-1">
          <span className="text-xs text-[#6366f1] font-medium mb-0.5 ml-1">
            Coach Claude
          </span>
          <div className="max-w-[75%] rounded-lg px-3 py-2 shadow-sm bg-white rounded-tl-sm border border-[#e0e7ff]">
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
      <div />
    </div>
  );
}

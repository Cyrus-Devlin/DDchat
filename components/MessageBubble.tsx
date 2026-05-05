"use client";

import { useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";

interface Props {
  message: Doc<"messages">;
  onFeedback?: (messageId: string, messageText: string, feedbackText: string) => Promise<void>;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message, onFeedback }: Props) {
  const isCustomer = message.sender === "customer";
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() || !onFeedback) return;
    setSubmitting(true);
    await onFeedback(message._id, message.text, feedbackText.trim());
    setFeedbackText("");
    setShowFeedback(false);
    setSubmitting(false);
  };

  return (
    <div className={`flex flex-col mb-1 ${isCustomer ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
          isCustomer ? "bg-[#d9fdd3] rounded-tr-sm" : "bg-white rounded-tl-sm"
        }`}
      >
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
          {message.text}
        </p>
        <p className="text-[11px] text-gray-400 text-right mt-0.5">
          {formatTime(message.createdAt)}
        </p>
      </div>

      {!isCustomer && onFeedback && !showFeedback && (
        <button
          onClick={() => setShowFeedback(true)}
          className="mt-1 px-3 py-1 rounded-full text-[11px] font-medium bg-white border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500 shadow-sm transition-colors"
          title="Send feedback to Coach Claude"
        >
          🚩 Flag for coach
        </button>
      )}

      {!isCustomer && showFeedback && (
        <div className="mt-1 ml-1 bg-white border border-gray-200 rounded-xl p-3 shadow-md w-72">
          <p className="text-xs font-medium text-gray-700 mb-1">What was wrong with this reply?</p>
          <div className="text-[11px] text-gray-400 italic bg-gray-50 rounded-lg px-2 py-1.5 mb-2 line-clamp-2">
            "{message.text}"
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Describe what went wrong or what should change…"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 resize-none outline-none focus:border-[#6366f1] leading-5"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim() || submitting}
              className="flex-1 text-xs bg-[#6366f1] hover:bg-[#4f46e5] text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {submitting ? "Sending…" : "Send to Coach"}
            </button>
            <button
              onClick={() => { setShowFeedback(false); setFeedbackText(""); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

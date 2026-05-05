"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  onSubmit: (feedbackText: string) => Promise<void>;
  onCancel: () => void;
}

export default function FeedbackPanel({ onSubmit, onCancel }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      // Success: ChatPage closes panel by unmounting — no need to reset here
    } catch {
      // Failed: keep panel open so founder can retry
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl rounded-t-2xl p-4 z-10">
      <p className="text-sm font-medium text-gray-700 mb-2">What should change?</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="The AI confirmed the postcode too explicitly — it should just continue naturally…"
        disabled={submitting}
        rows={3}
        autoFocus
        className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#128c7e] leading-5"
      />
      <div className="flex justify-end gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="bg-[#128c7e] hover:bg-[#0e7065] text-white"
        >
          {submitting ? "Updating…" : "Submit feedback"}
        </Button>
      </div>
    </div>
  );
}

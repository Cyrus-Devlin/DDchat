"use client";

import { useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send, Trash2, MessageSquarePlus } from "lucide-react";

interface Props {
  onSend: (text: string) => Promise<void>;
  onClear: () => void;
  onFeedback: () => void;
  feedbackDisabled: boolean;
  disabled: boolean;
}

export default function ChatInput({ onSend, onClear, onFeedback, feedbackDisabled, disabled }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  const getText = () => divRef.current?.innerText.trim() ?? "";

  const clearInput = () => {
    if (divRef.current) {
      divRef.current.innerText = "";
    }
  };

  const handleSend = async () => {
    const text = getText();
    if (!text || disabled || sendingRef.current) return;
    sendingRef.current = true;
    clearInput();
    await onSend(text);
    sendingRef.current = false;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-[#f0f0f0] px-3 py-2 flex items-end gap-2 flex-shrink-0 border-t border-gray-200">
      <button
        type="button"
        onClick={onClear}
        title="Clear chat"
        className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full text-gray-400 hover:text-red-400 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onFeedback}
        disabled={feedbackDisabled}
        title="Give feedback"
        className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full text-gray-400 hover:text-[#128c7e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <MessageSquarePlus className="h-4 w-4" />
      </button>
      <div
        ref={divRef}
        contentEditable={!disabled}
        onKeyDown={handleKeyDown}
        onInput={() => {
          // cap height at ~96px
          const el = divRef.current;
          if (!el) return;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
        }}
        data-placeholder={disabled ? "Starting chat…" : "Type a message"}
        className="flex-1 min-h-[38px] max-h-24 overflow-y-auto rounded-2xl px-4 py-2 text-base bg-white border border-gray-200 outline-none focus:border-gray-300 leading-5 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        style={{ wordBreak: "break-word" }}
      />
      <Button
        onClick={handleSend}
        disabled={disabled}
        size="icon"
        className="rounded-full bg-[#00a884] hover:bg-[#008f71] text-white flex-shrink-0 h-9 w-9"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

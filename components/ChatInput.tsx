"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface Props {
  onSend: (text: string) => Promise<void>;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [text]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || sending) return;
    setSending(true);
    setText("");
    await onSend(trimmed);
    setSending(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-[#f0f0f0] px-3 py-2 flex items-end gap-2 flex-shrink-0 border-t border-gray-200">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Select a customer first…" : "Type a message"}
        disabled={disabled || sending}
        rows={1}
        className="flex-1 resize-none rounded-2xl px-4 py-2 text-sm bg-white border border-gray-200 outline-none focus:border-gray-300 overflow-y-auto leading-5"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !text.trim() || sending}
        size="icon"
        className="rounded-full bg-[#00a884] hover:bg-[#008f71] text-white flex-shrink-0 h-9 w-9"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

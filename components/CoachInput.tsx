"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, X } from "lucide-react";

export interface FileInfo {
  fileId: string;
  fileName: string;
  fileType: string;
}

interface Props {
  onSend: (text: string, fileInfo?: FileInfo) => Promise<void>;
  disabled: boolean;
}

export default function CoachInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.coachFiles.generateUploadUrl);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(Math.min(el.scrollHeight, 96), 38)}px`;
  }, [text]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !pendingFile) || disabled || sending) return;
    setSending(true);

    let fileInfo: FileInfo | undefined;
    if (pendingFile) {
      setUploading(true);
      try {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": pendingFile.type || "application/octet-stream" },
          body: pendingFile,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const { storageId } = await res.json() as { storageId: string };
        fileInfo = { fileId: storageId, fileName: pendingFile.name, fileType: pendingFile.type };
        setPendingFile(null);
      } catch (err) {
        console.error("File upload failed:", err);
        setUploading(false);
        setSending(false);
        return; // Don't send if upload failed
      }
      setUploading(false);
    }

    setText("");
    await onSend(trimmed || `[Attached: ${fileInfo?.fileName ?? "file"}]`, fileInfo);
    setSending(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const busy = sending || uploading;

  return (
    <div className="bg-[#f0f0f0] px-3 py-2 flex flex-col gap-1.5 flex-shrink-0 border-t border-gray-200">
      {pendingFile && (
        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-600 border border-gray-200">
          <Paperclip className="h-3 w-3 text-[#6366f1] flex-shrink-0" />
          <span className="flex-1 truncate">{pendingFile.name}</span>
          <button onClick={() => setPendingFile(null)} className="flex-shrink-0">
            <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPendingFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || busy}
          title="Attach a document"
          className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full text-gray-400 hover:text-[#6366f1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            uploading
              ? "Uploading…"
              : pendingFile
              ? "Add a note or just press send…"
              : "Message Coach Claude…"
          }
          disabled={disabled || busy}
          rows={1}
          className="flex-1 resize-none rounded-2xl px-4 py-2 text-sm bg-white border border-gray-200 outline-none focus:border-[#6366f1] overflow-y-auto leading-5"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !pendingFile) || busy}
          size="icon"
          className="rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white flex-shrink-0 h-9 w-9"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

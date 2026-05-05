"use client";

import { useState, useEffect } from "react";
import PasswordGate from "@/components/PasswordGate";
import ChatPage from "@/components/ChatPage";
import CoachPage from "@/components/CoachPage";

type Tab = "customer" | "coach";

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("customer");
  const [flaggedMessageId, setFlaggedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem("dripdash_unlocked") === "true") {
      setUnlocked(true);
    }
    setChecking(false);
  }, []);

  const handleFlagForCoach = (messageId: string) => {
    setFlaggedMessageId(messageId);
    setActiveTab("coach");
  };

  if (checking) return null;
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="flex flex-col h-dvh">
      <nav className="flex border-b border-gray-200 bg-white flex-shrink-0 shadow-sm">
        <button
          onClick={() => setActiveTab("customer")}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "customer"
              ? "border-[#128c7e] text-[#128c7e]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Customer Chat
        </button>
        <button
          onClick={() => setActiveTab("coach")}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "coach"
              ? "border-[#6366f1] text-[#6366f1]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🎓 Train the AI
        </button>
      </nav>
      <div className="flex-1 overflow-hidden">
        <div className={`h-full overflow-hidden ${activeTab === "customer" ? "" : "hidden"}`}>
          <ChatPage onFlagForCoach={handleFlagForCoach} />
        </div>
        <div className={`h-full overflow-hidden ${activeTab === "coach" ? "" : "hidden"}`}>
          <CoachPage
            flaggedMessageId={flaggedMessageId}
            onFlaggedMessageConsumed={() => setFlaggedMessageId(null)}
          />
        </div>
      </div>
    </div>
  );
}

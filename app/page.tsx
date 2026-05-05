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
  const [autoTriggerCoachMessage, setAutoTriggerCoachMessage] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem("dripdash_unlocked") === "true") {
      setUnlocked(true);
    }
    setChecking(false);
  }, []);

  if (checking) return null;
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="flex flex-col h-dvh">
      {/* Single unified header */}
      <div className="bg-[#128c7e] px-4 py-3 flex items-center justify-between shadow-md flex-shrink-0">
        <span className="text-white font-semibold text-sm">Dripdash</span>
        <div className="flex bg-black/20 rounded-full p-0.5">
          <button
            onClick={() => setActiveTab("customer")}
            className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${
              activeTab === "customer"
                ? "bg-white text-[#128c7e]"
                : "text-white/80 hover:text-white"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("coach")}
            className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${
              activeTab === "coach"
                ? "bg-white text-[#6366f1]"
                : "text-white/80 hover:text-white"
            }`}
          >
            Coach
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className={`h-full overflow-hidden ${activeTab === "customer" ? "" : "hidden"}`}>
          <ChatPage onSwitchToCoach={(msg) => { setAutoTriggerCoachMessage(msg); setActiveTab("coach"); }} />
        </div>
        <div className={`h-full overflow-hidden ${activeTab === "coach" ? "" : "hidden"}`}>
          <CoachPage
            flaggedMessageId={null}
            onFlaggedMessageConsumed={() => {}}
            isActive={activeTab === "coach"}
            autoTriggerMessage={autoTriggerCoachMessage}
            onAutoTriggerConsumed={() => setAutoTriggerCoachMessage(null)}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import PasswordGate from "@/components/PasswordGate";
import ChatPage from "@/components/ChatPage";

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("dripdash_unlocked") === "true") {
      setUnlocked(true);
    }
    setChecking(false);
  }, []);

  if (checking) return null;
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <ChatPage />;
}

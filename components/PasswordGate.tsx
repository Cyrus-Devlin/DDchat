"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  onUnlock: () => void;
}

export default function PasswordGate({ onUnlock }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      localStorage.setItem("dripdash_unlocked", "true");
      onUnlock();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#e5ddd5]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-80">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Dripdash</h1>
          <p className="text-sm text-gray-500 mt-1">Booking Assistant Prototype</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={error ? "border-red-400" : ""}
            autoFocus
          />
          {error && (
            <p className="text-red-500 text-xs text-center">Incorrect password</p>
          )}
          <Button type="submit" className="w-full bg-[#128c7e] hover:bg-[#0e7065]" disabled={loading}>
            {loading ? "Checking..." : "Enter"}
          </Button>
        </form>
      </div>
    </div>
  );
}

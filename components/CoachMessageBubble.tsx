import { Doc } from "@/convex/_generated/dataModel";

interface Props {
  message: Doc<"coachMessages">;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CoachMessageBubble({ message }: Props) {
  const isFounder = message.sender === "founder";

  return (
    <div className={`flex flex-col mb-1 ${isFounder ? "items-end" : "items-start"}`}>
      {!isFounder && (
        <span className="text-xs text-[#6366f1] font-medium mb-0.5 ml-1">
          Coach Claude
        </span>
      )}
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
          isFounder
            ? "bg-[#e0e7ff] rounded-tr-sm"
            : "bg-white rounded-tl-sm border border-[#e0e7ff]"
        }`}
      >
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
          {message.text}
        </p>
        <p className="text-[11px] text-gray-400 text-right mt-0.5">
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

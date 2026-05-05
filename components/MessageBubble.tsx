import { Doc } from "@/convex/_generated/dataModel";

interface Props {
  message: Doc<"messages">;
  onFlag?: (messageId: string) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message, onFlag: _onFlag }: Props) {
  const isCustomer = message.sender === "customer";

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
    </div>
  );
}

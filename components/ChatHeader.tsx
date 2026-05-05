interface Props {
  onFeedback: () => void;
  feedbackDisabled: boolean;
}

export default function ChatHeader({ onFeedback, feedbackDisabled }: Props) {
  return (
    <div className="bg-[#128c7e] px-4 py-3 flex items-center justify-between shadow-md flex-shrink-0">
      <span className="text-white font-semibold text-sm">Dripdash Booking Assistant</span>
      <button
        onClick={onFeedback}
        disabled={feedbackDisabled}
        title="Give feedback on this conversation"
        className="text-white/80 hover:text-white text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        💬 Give feedback
      </button>
    </div>
  );
}

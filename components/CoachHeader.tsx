export default function CoachHeader() {
  return (
    <div className="bg-[#6366f1] px-4 py-3 flex items-center gap-3 shadow-md flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎓</span>
        <div>
          <h2 className="text-white font-semibold text-sm">Train the AI</h2>
          <p className="text-white/60 text-xs">Coach Claude — your AI training partner</p>
        </div>
      </div>
    </div>
  );
}

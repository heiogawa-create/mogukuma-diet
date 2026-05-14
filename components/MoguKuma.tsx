type MoguKumaProps = {
  message: string;
  compact?: boolean;
};

export function MoguKuma({ message, compact = false }: MoguKumaProps) {
  return (
    <div className="flex items-end gap-3">
      <div className={`${compact ? "h-20 w-20" : "h-28 w-28"} shrink-0 drop-shadow-lg`} aria-label="もぐクマ AIコーチ">
        <svg viewBox="0 0 160 160" role="img" className="h-full w-full">
          <title>丸くてかわいいAIコーチのもぐクマ</title>
          <circle cx="48" cy="42" r="25" fill="#B47A5B" />
          <circle cx="112" cy="42" r="25" fill="#B47A5B" />
          <circle cx="48" cy="42" r="13" fill="#FFD8B6" />
          <circle cx="112" cy="42" r="13" fill="#FFD8B6" />
          <circle cx="80" cy="86" r="58" fill="#C98A64" />
          <circle cx="80" cy="96" r="36" fill="#FFE4C8" />
          <circle cx="58" cy="76" r="7" fill="#5B382B" />
          <circle cx="102" cy="76" r="7" fill="#5B382B" />
          <circle cx="55" cy="84" r="9" fill="#FFB6C9" opacity="0.75" />
          <circle cx="105" cy="84" r="9" fill="#FFB6C9" opacity="0.75" />
          <path d="M74 93c3 4 9 4 12 0" stroke="#5B382B" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M80 86c-6 0-9-4-7-8 2-4 12-4 14 0 2 4-1 8-7 8Z" fill="#5B382B" />
          <path d="M44 124c15 15 57 17 76 0" stroke="#FFE4C8" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.8" />
          <path d="M116 23c9 4 15 11 17 21" stroke="#FFF5D6" strokeWidth="5" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      <div className="relative mb-2 rounded-[28px] bg-white/90 px-5 py-4 text-sm font-bold leading-relaxed text-cocoa shadow-soft">
        <span className="absolute -left-2 bottom-5 h-5 w-5 rotate-45 bg-white/90" />
        <p className="relative">{message}</p>
      </div>
    </div>
  );
}

// Opens WhatsApp (app on phones, web on desktop) with a ready-to-send message.
export default function WhatsAppShareButton({ text }: { text: string }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface px-6 py-3 font-bold text-text ring-1 ring-black/15 active:scale-[0.99]"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"
          fill="none"
          stroke="#25D366"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 8.5c.2 2.8 3 5.8 6 6.3l1-1.3-1.8-.9-.8.8c-1-.4-2.2-1.6-2.6-2.6l.8-.8-.9-1.8L9 8.5z"
          fill="#25D366"
        />
      </svg>
      Share on WhatsApp
    </a>
  );
}

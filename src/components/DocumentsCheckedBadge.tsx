// Shown once an admin has checked the organiser's supporting documents. The
// documents themselves are never public.
export default function DocumentsCheckedBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent/10 font-semibold text-accent ${
        small ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      <svg viewBox="0 0 20 20" className={small ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="currentColor" />
        <path d="m6.5 10.2 2.3 2.3 4.7-4.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Documents checked
    </span>
  );
}

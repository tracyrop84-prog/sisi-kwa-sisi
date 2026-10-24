// Errors use a warning icon on a soft pink background — never the brand red.
export default function ErrorMessage({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-2 rounded-lg bg-error-bg px-3 py-2 text-sm text-text">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
        <path d="M10 2 1 18h18L10 2z" fill="none" stroke="#1F1F1F" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M10 8v4.5" stroke="#1F1F1F" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="15" r="1" fill="#1F1F1F" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

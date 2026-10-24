// Mark: three linked circles — people coming together for a harambee.
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
        <circle cx="13" cy="15" r="8" fill="none" stroke="#C1121F" strokeWidth="3.5" />
        <circle cx="27" cy="15" r="8" fill="none" stroke="#1D4ED8" strokeWidth="3.5" />
        <circle cx="20" cy="27" r="8" fill="none" stroke="#1F1F1F" strokeWidth="3.5" />
      </svg>
      <span className="text-xl font-extrabold tracking-tight text-text">
        Sisi kwa Sisi
      </span>
    </span>
  );
}

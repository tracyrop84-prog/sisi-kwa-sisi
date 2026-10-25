// Shown once the beneficiary has confirmed the harambee by SMS (see
// supabase/beneficiary_verification.sql). Their number stays private.
export default function BeneficiaryVerifiedBadge({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent/10 font-semibold text-accent ${
        small ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      <svg viewBox="0 0 20 20" className={small ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="currentColor" />
        <path d="m6.5 10.2 2.3 2.3 4.7-4.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {small ? "Verified" : <>Verified · Confirmed by {name}</>}
    </span>
  );
}

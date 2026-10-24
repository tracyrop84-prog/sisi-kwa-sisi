"use client";

import { useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import PasswordInput from "@/components/PasswordInput";
import { PASSWORD_RULES, type AuthErrors } from "@/lib/validation";

type Props = { label: string; errors: AuthErrors };

// Password + confirm fields for sign-up and reset, ticking off the rules as the user types.
export default function NewPasswordFields({ label, errors }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const matches = confirm.length > 0 && confirm === password;

  return (
    <>
      <div>
        <label htmlFor="password" className="font-semibold">{label}</label>
        <PasswordInput
          name="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "password-rules password-error" : "password-rules"}
        />
        <ul id="password-rules" className="mt-2 flex flex-col gap-1 text-sm">
          {PASSWORD_RULES.map((rule) => (
            <Rule key={rule.label} met={rule.test(password)}>{rule.label}</Rule>
          ))}
        </ul>
        {errors.password && <ErrorMessage id="password-error">{errors.password}</ErrorMessage>}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="font-semibold">Confirm password</label>
        <PasswordInput
          name="confirmPassword"
          id="confirmPassword"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
        />
        {matches && (
          <ul className="mt-2 text-sm">
            <Rule met>Passwords match</Rule>
          </ul>
        )}
        {errors.confirmPassword && !matches && (
          <ErrorMessage id="confirmPassword-error">{errors.confirmPassword}</ErrorMessage>
        )}
      </div>
    </>
  );
}

function Rule({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${met ? "text-text" : "text-muted"}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
        {met ? (
          <>
            <circle cx="10" cy="10" r="9" fill="#1D4ED8" />
            <path d="M6 10.5l2.5 2.5L14 7.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <circle cx="10" cy="10" r="8.2" fill="none" stroke="#555555" strokeWidth="1.6" />
        )}
      </svg>
      {children}
      <span className="sr-only">{met ? "(done)" : "(not yet)"}</span>
    </li>
  );
}

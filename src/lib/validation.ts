// Sign-up, login and password checks. The browser runs them for instant
// feedback; the server runs them again because the browser can't be trusted.

export type AuthField = "name" | "email" | "password" | "confirmPassword";
export type AuthErrors = Partial<Record<AuthField, string>>;

export const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "At least one letter", test: (p: string) => /[a-z]/i.test(p) },
  { label: "At least one number", test: (p: string) => /\d/.test(p) },
] as const;

const MAX_PASSWORD = 72; // Supabase rejects anything longer

export function readAuthForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };
}

export function emailError(email: string): string | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : "Enter a valid email like name@example.com";
}

export function newPasswordErrors(password: string, confirmPassword: string): AuthErrors {
  const errors: AuthErrors = {};
  if (!PASSWORD_RULES.every((rule) => rule.test(password))) {
    errors.password = "Use at least 8 characters, with at least one letter and one number.";
  } else if (password.length > MAX_PASSWORD) {
    errors.password = `Use ${MAX_PASSWORD} characters or fewer.`;
  }
  if (!confirmPassword) errors.confirmPassword = "Type your password again to confirm it.";
  else if (confirmPassword !== password) errors.confirmPassword = "The passwords don’t match.";
  return errors;
}

export function signUpErrors(v: ReturnType<typeof readAuthForm>): AuthErrors {
  const errors: AuthErrors = {};
  if (!v.name) errors.name = "Add your name. Donors will see it on your harambees.";
  if (v.name.length > 60) errors.name = "Keep your name under 60 characters.";
  const email = emailError(v.email);
  if (email) errors.email = email;
  return { ...errors, ...newPasswordErrors(v.password, v.confirmPassword) };
}

export function logInErrors(v: ReturnType<typeof readAuthForm>): AuthErrors {
  const errors: AuthErrors = {};
  const email = emailError(v.email);
  if (email) errors.email = email;
  if (!v.password) errors.password = "Enter your password.";
  return errors;
}

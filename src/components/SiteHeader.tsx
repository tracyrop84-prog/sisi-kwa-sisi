import Link from "next/link";
import { logOutAction } from "@/app/auth/actions";
import Logo from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";

export default async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <Link href="/" aria-label="Sisi kwa Sisi home" className="shrink-0">
        <Logo />
      </Link>
      <nav className="flex min-w-0 items-center gap-4">
        <Link href="/campaigns" className="text-sm font-semibold text-accent">
          Browse
        </Link>
        {user ? (
          <div className="flex min-w-0 flex-col items-end leading-tight">
            <span className="max-w-28 truncate text-sm font-semibold" title={user.name}>
              {user.name}
            </span>
            <form action={logOutAction}>
              <button type="submit" className="text-xs text-muted underline-offset-2 hover:underline">
                Log out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent ring-1 ring-accent/40"
          >
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}

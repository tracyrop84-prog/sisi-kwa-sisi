import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";
import Logo from "@/components/Logo";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function SiteHeader() {
  const [user, admin] = await Promise.all([getCurrentUser(), isAdmin()]);

  return (
    // On wider screens the header spans the window, whatever the page width
    // (the body clips the overflow, see layout.tsx). Phones are unchanged.
    <header className="md:mx-[calc(50%-50vw)] md:mb-2 md:border-b md:border-black/5 md:bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 py-4 md:px-5">
        <Link href="/" aria-label="Sisi kwa Sisi home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="flex min-w-0 items-center gap-4">
          <Link href="/campaigns" className="text-sm font-semibold text-accent">
            Browse
          </Link>
          {admin && (
            <Link href="/admin" className="text-sm font-semibold text-accent">
              Admin
            </Link>
          )}
          {user ? (
            <AccountMenu name={user.name} email={user.email} />
          ) : (
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent ring-1 ring-accent/40"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

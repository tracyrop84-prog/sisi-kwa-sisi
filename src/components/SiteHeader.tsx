import Link from "next/link";
import Logo from "@/components/Logo";

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-4">
      <Link href="/" aria-label="Sisi kwa Sisi home">
        <Logo />
      </Link>
      <Link href="/campaigns" className="text-sm font-semibold text-accent">
        Browse
      </Link>
    </header>
  );
}

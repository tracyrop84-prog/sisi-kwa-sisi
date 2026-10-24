import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-6">
      <SiteHeader />

      <section className="flex flex-1 flex-col justify-center gap-6 py-12">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
          Harambee for each other.
        </h1>
        <p className="text-lg text-muted">
          Raise money for medical bills, school fees and life&apos;s big
          moments. Share on WhatsApp and let your people show up.
        </p>
        <Link
          href="/campaigns/new"
          className="block w-full rounded-xl bg-primary px-6 py-4 text-center text-lg font-bold text-white shadow-sm active:scale-[0.99] hover:brightness-95"
        >
          Start a harambee
        </Link>
        <Link href="/campaigns" className="text-center font-semibold text-accent">
          Browse harambees
        </Link>
      </section>

      <footer className="text-center text-sm text-muted">
        Sisi kwa Sisi · All amounts in KES
      </footer>
    </main>
  );
}

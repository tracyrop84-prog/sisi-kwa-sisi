import Link from "next/link";
import CampaignGrid from "@/components/CampaignGrid";
import SiteHeader from "@/components/SiteHeader";
import { getCampaigns } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Start", text: "Tell the story, set a goal in KES and verify your phone. It takes about two minutes." },
  { title: "Share on WhatsApp", text: "Send the link to family, chama and church groups. Post updates as gifts come in." },
  { title: "Get support", text: "Your people give, the total updates live and every gift shows in the donor list." },
] as const;

const SAFETY = [
  {
    title: "Verified beneficiaries",
    text: "The person a harambee is for can confirm it by SMS. Confirmed harambees show a Verified badge.",
  },
  {
    title: "Documents checked",
    text: "Organisers can add hospital bills, fee structures or quotations, and our team checks them.",
  },
  {
    title: "Report and review",
    text: "Anyone can report a harambee. Our team reviews reports and can pause donations while it checks.",
  },
  {
    title: "Money to a confirmed number",
    text: "Once the beneficiary confirms, money is paid only to their confirmed number, which nobody can change.",
  },
] as const;

// The newest live harambees, then how it works, why it's safe and challenges.
export default async function Home() {
  const featured = await getCampaigns("active", 3);

  return (
    <main className="mx-auto max-w-md px-5 pb-8 md:max-w-6xl">
      <SiteHeader />

      <section className="flex flex-col gap-6 py-12 md:max-w-xl md:py-16">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Harambee for each other.</h1>
        <p className="text-lg text-muted">
          Raise money for medical bills, school fees and life&apos;s big moments. Share on WhatsApp and let your people
          show up.
        </p>
        <Link
          href="/campaigns/new"
          className="block w-full rounded-xl bg-primary px-6 py-4 text-center text-lg font-bold text-white shadow-sm active:scale-[0.99] hover:brightness-95 md:w-fit md:px-10"
        >
          Start a harambee
        </Link>
        <Link href="/campaigns" className="text-center font-semibold text-accent md:text-left">
          Browse harambees
        </Link>
      </section>

      {featured.length > 0 && (
        <section className="mt-2">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="text-xl font-bold">Raising now</h2>
            <Link href="/campaigns" className="text-sm font-semibold text-accent">
              See all
            </Link>
          </div>
          <CampaignGrid campaigns={featured} />
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-bold">How it works</h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
              >
                {i + 1}
              </span>
              <span>
                <span className="block font-bold">{step.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">Why Sisi kwa Sisi is safe</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {SAFETY.map((item) => (
            <li key={item.title} className="flex gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
              <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true">
                <circle cx="10" cy="10" r="8" fill="currentColor" />
                <path d="m6.5 10.2 2.3 2.3 4.7-4.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                <span className="block font-bold">{item.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-2xl bg-accent/10 p-5 md:p-6">
        <h2 className="text-xl font-bold">Challenges: Mgeni Rasmi and Sindikiza</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-bold">
              <span aria-hidden="true">🎉</span> Be the Mgeni Rasmi
            </p>
            <p className="mt-1 text-sm">
              Like the guest of honour at a harambee, you give first, then share your own link. The countdown starts
              with your gift.
            </p>
          </div>
          <div>
            <p className="font-bold">
              <span aria-hidden="true">🙌</span> Sindikiza a friend
            </p>
            <p className="mt-1 text-sm">
              Friends escort the Mgeni Rasmi by giving through their link before time runs out. Challenges are ranked
              on the harambee page by how much they raise.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Prefer something simpler? Start a KSh 100 or KSh 50 challenge from any live harambee.
        </p>
      </section>

      <footer className="mt-12 text-center text-sm text-muted">Sisi kwa Sisi · All amounts in KES</footer>
    </main>
  );
}

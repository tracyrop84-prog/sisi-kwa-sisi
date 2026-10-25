import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { getLinkTitle } from "@/lib/beneficiaries";
import { BENEFICIARY_LINK_DAYS } from "@/lib/campaignRules";
import ConfirmForm from "./ConfirmForm";

export const dynamic = "force-dynamic";

// The link is a secret: keep it out of search engines and out of the Referer
// header sent to other sites.
export const metadata: Metadata = {
  title: "Confirm your harambee · Sisi kwa Sisi",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

// Opened from the SMS sent to the person a harambee is for. No account needed.
// Until the code is entered, only the title is shown.
export default async function ConfirmPage({ params }: Props) {
  const { token } = await params;
  const { status, title } = await getLinkTitle(token);

  return (
    <main className="mx-auto max-w-md px-5 pb-10">
      <SiteHeader />
      {status === "open" ? (
        <>
          <h1 className="pt-4 text-2xl font-extrabold tracking-tight">Confirm your harambee</h1>
          <p className="mt-1 text-muted">Someone started a harambee for you on Sisi kwa Sisi:</p>
          <p className="mt-3 rounded-2xl bg-surface p-4 text-lg font-bold leading-snug shadow-sm ring-1 ring-black/5">
            {title}
          </p>
          <div className="mt-6">
            <ConfirmForm token={token} />
          </div>
        </>
      ) : (
        <div className="pt-4">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {status === "confirmed" ? "Already confirmed" : status === "declined" ? "Harambee closed" : "This link doesn’t work"}
          </h1>
          <p className="mt-2 rounded-2xl bg-surface p-4 text-muted shadow-sm ring-1 ring-black/5">
            {status === "confirmed"
              ? "You’ve already confirmed this harambee. Thank you!"
              : status === "declined"
                ? "You told us this harambee isn’t yours or you don’t agree to it, so it has been closed."
                : status === "link_expired"
                  ? `This link has expired (links work for ${BENEFICIARY_LINK_DAYS} days). Ask the organiser to send you a new one.`
                  : "It may be old or mistyped. If the organiser sent you a newer SMS, use the link in that one."}
          </p>
        </div>
      )}
    </main>
  );
}

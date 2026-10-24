"use server";

import { redirect } from "next/navigation";
import { getCampaign } from "@/lib/campaigns";
import { createDonation, MAX_DONATION, MAX_MESSAGE, MAX_NAME, MIN_DONATION } from "@/lib/donations";

export type DonateState = {
  errors: Partial<Record<Field, string>>;
  formError?: string;
  values: Partial<Record<Field, string>>;
};

type Field = "donorName" | "amount" | "message";

export async function donateAction(_prev: DonateState, formData: FormData): Promise<DonateState> {
  const slug = String(formData.get("slug") ?? "");
  const anonymous = formData.get("anonymous") === "on";
  const values = {
    donorName: String(formData.get("donorName") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").replace(/[,\s]/g, ""),
    message: String(formData.get("message") ?? "").trim(),
  };

  const errors: DonateState["errors"] = {};
  if (!anonymous && !values.donorName) errors.donorName = "Add your name, or tick “Give anonymously”.";
  if (values.donorName.length > MAX_NAME) errors.donorName = `Keep your name under ${MAX_NAME} characters.`;

  const amount = Number(values.amount);
  if (!Number.isInteger(amount) || amount < MIN_DONATION || amount > MAX_DONATION) {
    errors.amount = `Enter a whole amount between KES ${MIN_DONATION.toLocaleString("en-KE")} and KES ${MAX_DONATION.toLocaleString("en-KE")}.`;
  }
  if (values.message.length > MAX_MESSAGE) errors.message = `Keep your message under ${MAX_MESSAGE} characters.`;

  if (Object.keys(errors).length > 0) return { errors, values };

  const campaign = await getCampaign(slug);
  if (!campaign) {
    return { errors: {}, values, formError: "We couldn’t find this harambee. It may have been removed." };
  }

  await createDonation({
    campaignId: campaign.id,
    donorName: anonymous ? null : values.donorName,
    amount,
    message: values.message || null,
  });
  redirect(`/campaigns/${campaign.slug}?thanks=1`);
}

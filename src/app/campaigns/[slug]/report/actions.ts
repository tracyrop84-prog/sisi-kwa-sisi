"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import { createReport, isReportReason, MAX_REPORT_DETAILS, type ReportError } from "@/lib/reports";

export type ReportFormState = {
  errors: Partial<Record<Field, string>>;
  formError?: string;
  values: Partial<Record<Field, string>>;
};

type Field = "reason" | "details";

function friendlyError(code: ReportError): string {
  switch (code) {
    case "not-logged-in":
      return "You’ve been logged out. Please log in again, then send your report.";
    case "email-not-confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "already_reported":
      return "You’ve already reported this harambee. Our team will review it.";
    case "own_campaign":
      return "You can’t report your own harambee.";
    case "campaign_closed":
      return "This harambee has already been closed.";
    default:
      return "We couldn’t find this harambee. It may have been removed.";
  }
}

export async function reportAction(_prev: ReportFormState, formData: FormData): Promise<ReportFormState> {
  const slug = String(formData.get("slug") ?? "");
  const from = formData.get("from");
  const values = {
    reason: String(formData.get("reason") ?? ""),
    details: String(formData.get("details") ?? "").trim(),
  };

  const errors: ReportFormState["errors"] = {};
  if (!isReportReason(values.reason)) errors.reason = "Choose a reason.";
  if (values.details.length > MAX_REPORT_DETAILS) {
    errors.details = `Keep the details under ${MAX_REPORT_DETAILS.toLocaleString("en-KE")} characters.`;
  }
  if (Object.keys(errors).length > 0 || !isReportReason(values.reason)) return { errors, values };

  const campaign = await getCampaign(slug);
  if (!campaign) return { errors: {}, values, formError: friendlyError("campaign_not_found") };

  const result = await createReport(campaign.id, values.reason, values.details || null);
  if ("error" in result) return { errors: {}, values, formError: friendlyError(result.error) };

  const back = safeNext(from, `/campaigns/${campaign.slug}`);
  redirect(`${back}${back.includes("?") ? "&" : "?"}reported=1`);
}

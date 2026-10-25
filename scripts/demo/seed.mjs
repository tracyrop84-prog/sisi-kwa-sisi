// Demo seed: showcase harambees created the way real people would create them.
//   node --env-file=.env.local scripts/demo/seed.mjs
//
// Removes any earlier demo data first, so it can be re-run without duplicates
// (and dates stay within the last few weeks). Run supabase/demo_data.sql once
// before the first run. What it creates is in data.mjs; photos come from
// demo-images/ (see demo-images/README.md).
//
// Every campaign, donation, challenge and update goes through the database's
// rules as the signed-in organiser, host or a logged-out donor. The rules check
// everything at the moment of saving, so afterwards the secret key moves the
// timestamps into the past and tags each row is_demo. Nothing else is written
// directly.

import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CAMPAIGN_DECLARATION, MINOR_PHOTO_CONSENT } from "../../src/lib/campaignRules.ts";
import { ACCOUNTS, AMOUNTS, FIRST_NAMES, HARAMBEES, LAST_NAMES, MESSAGES } from "./data.mjs";
import {
  check,
  DOCUMENT_BUCKET,
  inBatches,
  PHOTO_BUCKET,
  removeDemo,
  service,
  signIn,
  visitor,
} from "./lib.mjs";

const NOW = Date.now();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();
const daysAgo = (d) => NOW - d * DAY;

// Same pseudo-random sequence every run, so the demo looks the same each time.
let state = 20261025;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (from, to) => from + random() * (to - from);

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (DEMO_PASSWORD !== undefined && DEMO_PASSWORD.length < 8) {
  console.error("DEMO_PASSWORD in .env.local must be at least 8 characters.");
  process.exit(1);
}

// Amounts from the palette adding up to exactly total, each between min and max.
function amountsFor(total, palette, min = 50, max = 5_000) {
  const usable = palette.filter((a) => a >= min && a <= max);
  const out = [];
  let left = total;
  while (left > 0) {
    const options = usable.filter((a) => a === left || left - a >= min);
    if (options.length === 0) {
      if (left >= min && left <= max) out.push(left);
      else out[out.findIndex((a) => a + left <= max)] += left; // only when total < min
      break;
    }
    const amount = pick(options);
    out.push(amount);
    left -= amount;
  }
  return out;
}

function donor(anonymousShare) {
  return {
    donor_name: random() < anonymousShare ? null : `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    message: random() < 0.2 ? pick(MESSAGES) : null,
  };
}

function slugFor(title) {
  // Same as uniqueSlug in src/lib/campaigns.ts; the database adds -2 etc. on a clash.
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "harambee"
  );
}

function challengeSlug(hostName) {
  // Like challengeSlug in src/lib/challenges.ts.
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const code = Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join("");
  return `${hostName.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "")}-${code}`;
}

// demo-images/<key>/<file>, if it's there and a JPEG under 5 MB.
const warnings = [];
function image(key, file) {
  if (!file) return null;
  const path = join(process.cwd(), "demo-images", key, file);
  if (!existsSync(path)) {
    warnings.push(`Missing demo-images/${key}/${file} (skipped)`);
    return null;
  }
  const data = readFileSync(path);
  if (data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
    warnings.push(`demo-images/${key}/${file} isn't a JPEG (skipped)`);
    return null;
  }
  if (data.length > 5 * 1024 * 1024) {
    warnings.push(`demo-images/${key}/${file} is over 5 MB (skipped)`);
    return null;
  }
  return data;
}

// A one-page PDF that says it's a demo, standing in for a real document.
function demoPdf(title) {
  const text = `DEMO: ${title}. Sisi kwa Sisi sample document, not a real one.`.replace(/[\\()]/g, (m) => `\\${m}`);
  const stream = `BT /F1 16 Tf 56 770 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function upload(client, bucket, path, data, contentType) {
  check(await client.storage.from(bucket).upload(path, new Blob([data], { type: contentType }), { contentType }), `Uploading ${path}`);
}

// Accounts ----------------------------------------------------------------------

async function createAccounts() {
  const people = {};
  for (const [key, account] of Object.entries(ACCOUNTS)) {
    const password = account.admin || !DEMO_PASSWORD ? randomBytes(24).toString("base64url") : DEMO_PASSWORD;
    const { data, error } = await service.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: account.name },
      app_metadata: { is_demo: true },
    });
    if (error) throw new Error(`Creating ${account.email}: ${error.message}`);
    const client = await signIn(account.email, password);
    people[key] = { ...account, id: data.user.id, client };

    if (account.phone) {
      // The same two steps as /verify-phone, minus the SMS.
      const code = check(
        await service.rpc("issue_phone_code", { p_user_id: data.user.id, p_phone: account.phone }),
        `Phone code for ${account.email}`,
      );
      const result = check(await client.rpc("verify_phone_code", { p_code: code }), `Verifying ${account.phone}`);
      if (result !== "verified") throw new Error(`Verifying ${account.phone}: ${result}`);
    }
    if (account.admin) {
      // Admins are only ever set in the database (supabase/reports.sql).
      check(await service.from("admins").insert({ user_id: data.user.id }), "Making the demo admin");
    }
  }
  return people;
}

// One harambee, start to finish -----------------------------------------------

async function seedHarambee(h, people) {
  const organiser = people[h.org];
  const org = organiser.client;
  const admin = people.admin.client;
  const createdAt = daysAgo(h.createdDaysAgo);
  const confirm = h.viral ?? h.minor;
  const stamps = { created_at: iso(createdAt), declaration_accepted_at: iso(createdAt) };

  // Created by the organiser, through the same rules as the create form.
  const campaign = check(
    await org
      .from("campaigns")
      .insert({
        slug: slugFor(h.title),
        title: h.title,
        category: h.category,
        organiser: organiser.name,
        beneficiary: h.beneficiary,
        location: h.location,
        goal: h.goal,
        story: h.story,
        organiser_id: organiser.id,
        declaration: CAMPAIGN_DECLARATION,
        viral_video_url: h.viral?.url ?? null,
        beneficiary_confirmation: Boolean(confirm),
        beneficiary_is_minor: Boolean(h.minor),
        minor_photo_consent: h.minor ? MINOR_PHOTO_CONSENT : null,
      })
      .select("id, slug, status")
      .single(),
    `Creating "${h.title}"`,
  );
  const id = campaign.id;
  if (h.minor) stamps.minor_photo_consent_at = iso(createdAt);

  const cover = image(h.key, h.cover);
  if (cover) {
    const path = `${id}/cover/${randomUUID()}.jpg`;
    await upload(org, PHOTO_BUCKET, path, cover, "image/jpeg");
    check(await org.from("campaigns").update({ cover_photo: path }).eq("id", id), "Setting the cover photo");
  }

  let documentId = null;
  if (h.docs) {
    const data = demoPdf(h.docs.title);
    const doc = check(
      await org
        .from("campaign_documents")
        .insert({ campaign_id: id, file_name: h.docs.fileName, content_type: "application/pdf", size_bytes: data.length })
        .select("id, path")
        .single(),
      "Adding a document",
    );
    documentId = doc.id;
    await upload(org, DOCUMENT_BUCKET, doc.path, data, "application/pdf");
    check(await admin.rpc("admin_mark_documents_checked", { p_campaign_id: id }), "Marking documents checked");
    stamps.documents_checked_at = iso(daysAgo(h.docs.checkedDaysAgo));
  }

  let confirmedAt = null;
  if (confirm) {
    // What the organiser's SMS and the beneficiary's /confirm page do.
    const link = check(
      await service
        .rpc("issue_beneficiary_link", {
          p_user_id: organiser.id,
          p_campaign_id: id,
          p_name: confirm.name,
          p_phone: confirm.phone,
          p_relationship: h.minor?.relationship ?? null,
        })
        .single(),
      "Sending the confirmation link",
    );
    const result = check(
      await service.rpc("beneficiary_confirm", { p_token: link.token, p_code: link.code }),
      "Confirming as the beneficiary",
    );
    if (result !== "live" && result !== "pending_approval") throw new Error(`Confirming "${h.title}": ${result}`);
    confirmedAt = daysAgo(confirm.confirmedDaysAgo);
    stamps.beneficiary_confirmed_at = iso(confirmedAt);
  }

  if (h.approveDaysAgo !== undefined) {
    check(await admin.rpc("admin_approve_campaign", { p_campaign_id: id }), "Approving");
    stamps.approved_at = iso(daysAgo(h.approveDaysAgo));
  }

  // Donations stop before the harambee closes; otherwise just before now.
  const opensAt = Math.max(createdAt, confirmedAt ?? 0, h.approveDaysAgo !== undefined ? daysAgo(h.approveDaysAgo) : 0) + HOUR;
  const closesAt = h.completeDaysAgo !== undefined ? daysAgo(h.completeDaysAgo) - HOUR : NOW - 15 * MINUTE;
  const anonymousShare = h.anonymousShare ?? 0.15;
  const donations = []; // { id, at }
  const target = Math.round(h.goal * h.pct);
  let fromChallenges = 0;

  for (const spec of h.challenges ?? []) {
    const host = people[spec.host];
    const challenge = check(
      await host.client
        .from("challenges")
        .insert({
          campaign_id: id,
          slug: challengeSlug(host.name),
          host_name: host.name,
          type: spec.type,
          duration_minutes: spec.durationMinutes,
        })
        .select("id, status")
        .single(),
      `Creating ${host.name}'s challenge`,
    );
    if (challenge.status === "pending") {
      const result = check(await org.rpc("review_challenge", { p_challenge_id: challenge.id, p_approve: true }), "Approving the challenge");
      if (result !== "approved") throw new Error(`Approving the challenge: ${result}`);
    }

    const length = spec.durationMinutes * MINUTE;
    const endsAt = spec.hoursLeft !== undefined ? NOW + spec.hoursLeft * HOUR : daysAgo(spec.endedDaysAgo);
    const startsAt = endsAt - length;
    const lastGift = Math.min(endsAt, NOW) - 5 * MINUTE;

    if (spec.type === "mgeni_rasmi") {
      // The host gives first, signed in, which starts the countdown.
      const gift = check(
        await host.client
          .from("donations")
          .insert({ campaign_id: id, challenge_id: challenge.id, amount: spec.hostGift, donor_name: host.name })
          .select("id")
          .single(),
        "The Mgeni Rasmi's first gift",
      );
      donations.push({ id: gift.id, at: startsAt });
    }

    const min = spec.type === "ksh_100" ? 100 : 50;
    const rows = amountsFor(spec.total - (spec.hostGift ?? 0), AMOUNTS.general, min).map((amount) => ({
      campaign_id: id,
      challenge_id: challenge.id,
      amount,
      ...donor(anonymousShare),
    }));
    const saved = check(await visitor.from("donations").insert(rows).select("id"), "Challenge donations");
    for (const row of saved) donations.push({ id: row.id, at: between(startsAt + 5 * MINUTE, lastGift) });
    fromChallenges += spec.total;

    const approvedAt = spec.type === "mgeni_rasmi" ? startsAt - 20 * MINUTE : startsAt;
    check(
      await service
        .from("challenges")
        .update({
          is_demo: true,
          created_at: iso(approvedAt - 2 * HOUR),
          approved_at: iso(approvedAt),
          starts_at: iso(startsAt),
          ends_at: iso(endsAt),
        })
        .eq("id", challenge.id),
      "Dating the challenge",
    );
  }

  // Direct donations, by logged-out visitors.
  const rows = amountsFor(target - fromChallenges, AMOUNTS[h.donors]).map((amount) => ({
    campaign_id: id,
    amount,
    ...donor(anonymousShare),
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const saved = check(await visitor.from("donations").insert(rows.slice(i, i + 100)).select("id"), "Donations");
    for (const row of saved) donations.push({ id: row.id, at: between(opensAt, closesAt) });
  }

  const postUpdate = async (u) => {
    const photo = image(h.key, u.photo);
    const photos = [];
    if (photo) {
      const path = `${id}/updates/${randomUUID()}.jpg`;
      await upload(org, PHOTO_BUCKET, path, photo, "image/jpeg");
      photos.push(path);
    }
    const update = check(
      await org
        .from("campaign_updates")
        .insert({
          campaign_id: id,
          type: u.type,
          body: u.body ?? null,
          gift_item: u.giftItem ?? null,
          gift_giver: u.giftGiver ?? null,
          gift_value: u.giftValue ?? null,
          recovery_status: u.recoveryStatus ?? null,
          photos,
        })
        .select("id")
        .single(),
      `Posting a ${u.type} update`,
    );
    const at = iso(daysAgo(u.daysAgo));
    check(
      await service.from("campaign_updates").update({ is_demo: true, created_at: at, updated_at: at }).eq("id", update.id),
      "Dating the update",
    );
  };

  for (const u of h.updates.filter((u) => !u.afterComplete)) await postUpdate(u);

  if (h.completeDaysAgo !== undefined) {
    // "Close harambee", as the organiser.
    check(await org.rpc("complete_campaign", { p_campaign_id: id }), "Closing the harambee");
    stamps.completed_at = iso(daysAgo(h.completeDaysAgo));
  }

  for (const u of h.updates.filter((u) => u.afterComplete)) await postUpdate(u);

  // Tag and date everything. Tagging the campaign first lets its payout number be dated too.
  check(await service.from("campaigns").update({ is_demo: true, ...stamps }).eq("id", id), "Dating the harambee");
  if (confirmedAt) {
    check(
      await service.from("payout_phones").update({ confirmed_at: iso(confirmedAt) }).eq("campaign_id", id),
      "Dating the payout number",
    );
  }
  if (documentId) {
    check(
      await service.from("campaign_documents").update({ created_at: iso(createdAt + 2 * HOUR) }).eq("id", documentId),
      "Dating the document",
    );
  }
  await inBatches(donations, 10, async ({ id: donationId, at }) => {
    check(
      await service.from("donations").update({ is_demo: true, created_at: iso(at) }).eq("id", donationId),
      "Dating a donation",
    );
  });

  const final = check(
    await service.from("campaigns").select("slug, status, raised, donor_count").eq("id", id).single(),
    "Reading the result",
  );
  return { ...final, title: h.title, goal: h.goal, organiser: organiser.email };
}

// Run --------------------------------------------------------------------------

try {
  console.log("Removing earlier demo data…");
  const removed = await removeDemo({ dryRun: false });
  console.log(`  ${removed.summary.campaigns} harambees and ${removed.summary.users} accounts removed`);

  console.log("Creating demo accounts…");
  const people = await createAccounts();

  const results = [];
  for (const h of HARAMBEES) {
    console.log(`Seeding "${h.title}"…`);
    results.push(await seedHarambee(h, people));
  }

  console.log("\nDone:");
  for (const r of results) {
    const pct = Math.round((r.raised / r.goal) * 100);
    console.log(`  ${r.status.padEnd(10)} ${String(pct).padStart(3)}%  ${String(r.donor_count).padStart(3)} donors  /campaigns/${r.slug}  (${r.organiser})`);
  }
  console.log(
    DEMO_PASSWORD
      ? "\nOrganisers and supporters log in with DEMO_PASSWORD. The demo admin has a random password."
      : "\nAll demo accounts have random passwords. Set DEMO_PASSWORD in .env.local to log in as them.",
  );
  for (const w of warnings) console.log(`  ! ${w}`);
} catch (error) {
  console.error(`\nStopped: ${error.message}`);
  console.error("Fix the problem and run again; the seed removes partial demo data before it starts.");
  process.exit(1);
}

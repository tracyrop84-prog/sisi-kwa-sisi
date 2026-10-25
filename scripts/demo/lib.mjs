// Shared by seed.mjs and remove.mjs. Run them with Node 24:
//   node --env-file=.env.local scripts/demo/seed.mjs
// The secret key is only used for what the app's own server uses it for
// (phone codes and beneficiary links), for tagging and backdating demo rows,
// and for removing them. Everything else runs as a signed-in demo user or a
// logged-out visitor, so the database rules apply as they do on the site.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !anonKey || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SECRET_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/demo/<script>.mjs",
  );
  process.exit(1);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const service = createClient(url, secretKey, noSession);

// A logged-out visitor, as when someone donates without an account.
export const visitor = createClient(url, anonKey, noSession);

export async function signIn(email, password) {
  const client = createClient(url, anonKey, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Couldn't sign in ${email}: ${error.message}`);
  return client;
}

// Throws with the database's message, so a broken rule says which one.
export function check({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}${error.details ? ` (${error.details})` : ""}`);
  return data;
}

// Runs fn over items, a few at a time.
export async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export const PHOTO_BUCKET = "campaign-photos";
export const DOCUMENT_BUCKET = "campaign-documents";

// Demo users: app_metadata.is_demo, which only the secret key can set.
export async function listDemoUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Listing users: ${error.message}`);
    users.push(...data.users.filter((u) => u.app_metadata?.is_demo === true));
    if (data.users.length < 1000) return users;
  }
}

async function storagePaths(bucket, folder) {
  const { data, error } = await service.storage.from(bucket).list(folder, { limit: 1000 });
  if (error) throw new Error(`Listing ${bucket}/${folder}: ${error.message}`);
  // Folders come back without an id.
  return data.filter((f) => f.id).map((f) => `${folder}/${f.name}`);
}

async function count(table, column, values) {
  if (values.length === 0) return 0;
  const { count: n, error } = await service.from(table).select("*", { count: "exact", head: true }).in(column, values);
  if (error) throw new Error(`Counting ${table}: ${error.message}`);
  return n ?? 0;
}

// Removes every demo record and nothing else: campaigns tagged is_demo or
// organised by a demo user (with their donations, challenges, updates,
// documents, reports and files), any other row tagged is_demo, and the demo
// users. With dryRun, only says what it would remove.
export async function removeDemo({ dryRun }) {
  const users = await listDemoUsers();
  const userIds = users.map((u) => u.id);

  const tagged = check(await service.from("campaigns").select("id, title").eq("is_demo", true), "Finding demo campaigns");
  const owned = userIds.length
    ? check(await service.from("campaigns").select("id, title").in("organiser_id", userIds), "Finding demo users' campaigns")
    : [];
  const campaigns = [...new Map([...tagged, ...owned].map((c) => [c.id, c])).values()];
  const ids = campaigns.map((c) => c.id);

  const files = { [PHOTO_BUCKET]: [], [DOCUMENT_BUCKET]: [] };
  for (const id of ids) {
    files[PHOTO_BUCKET].push(...(await storagePaths(PHOTO_BUCKET, `${id}/cover`)));
    files[PHOTO_BUCKET].push(...(await storagePaths(PHOTO_BUCKET, `${id}/updates`)));
    files[DOCUMENT_BUCKET].push(...(await storagePaths(DOCUMENT_BUCKET, id)));
  }

  const summary = {
    campaigns: campaigns.length,
    donations: await count("donations", "campaign_id", ids),
    challenges: await count("challenges", "campaign_id", ids),
    updates: await count("campaign_updates", "campaign_id", ids),
    reports: await count("reports", "campaign_id", ids),
    photos: files[PHOTO_BUCKET].length,
    documents: files[DOCUMENT_BUCKET].length,
    users: users.length,
  };

  if (dryRun) return { summary, campaigns, users };

  if (ids.length) {
    // Tag campaigns a demo user made by hand too, so their payout numbers can
    // go (see supabase/demo_data.sql).
    check(await service.from("campaigns").update({ is_demo: true }).in("id", ids), "Tagging demo campaigns");
    for (const [bucket, paths] of Object.entries(files)) {
      for (let i = 0; i < paths.length; i += 100) {
        check(await service.storage.from(bucket).remove(paths.slice(i, i + 100)), `Removing files from ${bucket}`);
      }
    }
    // These keep their campaign from being deleted (on delete restrict).
    for (const table of ["reports", "campaign_edits", "payout_phones"]) {
      check(await service.from(table).delete().in("campaign_id", ids), `Removing ${table}`);
    }
    // Donations, challenges, updates, documents and beneficiary links go with their campaign.
    check(await service.from("campaigns").delete().in("id", ids), "Removing demo campaigns");
  }
  for (const table of ["donations", "challenges", "campaign_updates"]) {
    check(await service.from(table).delete().eq("is_demo", true), `Removing other demo ${table}`);
  }
  // Their verified phones, admin role and pending codes go with them.
  for (const user of users) {
    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Removing ${user.email}: ${error.message}`);
  }
  return { summary, campaigns, users };
}

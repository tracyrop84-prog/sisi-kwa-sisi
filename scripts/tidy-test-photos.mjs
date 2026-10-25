// Removes the photos and documents of the campaigns that
// scripts/tidy-test-campaigns.sql deletes. Run this first: the SQL can't
// remove the files themselves.
//   node --env-file=.env.local scripts/tidy-test-photos.mjs         lists the files
//   node --env-file=.env.local scripts/tidy-test-photos.mjs --yes   removes them

import { check, DOCUMENT_BUCKET, PHOTO_BUCKET, service } from "./demo/lib.mjs";

// Keep in sync with scripts/tidy-test-campaigns.sql.
const SLUGS = [
  "ghhjdyhghh",
  "marys-wedding-fundraiser",
  "build-a-new-classroom-for-mwangaza-primary-school",
  "help-achieng-record-her-first-song",
  "wanjiku-heart-surgery",
  "otieno-school-fees",
  "mzee-kiprono-send-off",
  "kibera-water-tank",
];

const remove = process.argv.includes("--yes");

async function files(bucket, folder) {
  const data = check(await service.storage.from(bucket).list(folder, { limit: 1000 }), `Listing ${bucket}/${folder}`);
  return data.filter((f) => f.id).map((f) => `${folder}/${f.name}`);
}

try {
  // Never a demo campaign, even if one has the same slug.
  const campaigns = check(
    await service.from("campaigns").select("id, slug").in("slug", SLUGS).eq("is_demo", false),
    "Finding the campaigns",
  );
  let total = 0;
  for (const c of campaigns) {
    const photos = [...(await files(PHOTO_BUCKET, `${c.id}/cover`)), ...(await files(PHOTO_BUCKET, `${c.id}/updates`))];
    const documents = await files(DOCUMENT_BUCKET, c.id);
    console.log(`${c.slug}: ${photos.length} photos, ${documents.length} documents`);
    total += photos.length + documents.length;
    if (remove) {
      if (photos.length) check(await service.storage.from(PHOTO_BUCKET).remove(photos), `Removing ${c.slug}'s photos`);
      if (documents.length) check(await service.storage.from(DOCUMENT_BUCKET).remove(documents), `Removing ${c.slug}'s documents`);
    }
  }
  console.log(remove ? `\nRemoved ${total} files.` : `\n${total} files. Run again with --yes to remove them.`);
} catch (error) {
  console.error(`Stopped: ${error.message}`);
  process.exit(1);
}

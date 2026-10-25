// Removes all demo data (see lib.mjs) and nothing else.
//   node --env-file=.env.local scripts/demo/remove.mjs         lists what it would remove
//   node --env-file=.env.local scripts/demo/remove.mjs --yes   removes it

import { removeDemo } from "./lib.mjs";

const dryRun = !process.argv.includes("--yes");

try {
  const { summary, campaigns, users } = await removeDemo({ dryRun });
  console.log(dryRun ? "Demo data found (nothing removed yet):" : "Removed:");
  for (const [what, n] of Object.entries(summary)) console.log(`  ${what.padEnd(10)} ${n}`);
  for (const c of campaigns) console.log(`  - ${c.title}`);
  for (const u of users) console.log(`  - ${u.email}`);
  if (dryRun) console.log("\nRun again with --yes to remove it.");
} catch (error) {
  console.error(`\nStopped: ${error.message}`);
  process.exit(1);
}

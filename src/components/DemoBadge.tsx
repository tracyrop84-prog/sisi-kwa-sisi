// On showcase harambees made by scripts/demo/seed.mjs, so nobody mistakes the
// made-up people and donations for real ones. Grey, like other neutral labels.
export default function DemoBadge() {
  return (
    <span
      title="A demo harambee: the people, donations and documents are made up"
      className="inline-block rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-muted"
    >
      Demo
    </span>
  );
}

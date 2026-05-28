/**
 * Avatar style comparison — Round 8.
 *
 * Goal: pick a DiceBear style by looking, not by reading docs. Same 12
 * identities rendered at the 4 sizes the app actually uses (24/32/48/64),
 * across 6 styles (4 candidates + current + previous), 6 columns side by
 * side so vertical scan = "is this style consistent across identities?"
 * and horizontal scan = "which style do I like more for this identity?".
 *
 * No DB, no shared entity components, no new deps — plain <img> against
 * the DiceBear 9.x HTTP API.
 */

const SEEDS = [
  "Alex Chen",
  "Jordan Patel",
  "Sam Rivera",
  "Morgan Kim",
  "Riley Singh",
  "Casey Nguyen",
  "Avery Brooks",
  "Quinn Tanaka",
  "Drew Okafor",
  "Sage Martinez",
  "Reese Hassan",
  "Skyler Park",
] as const;

const SIZES = [24, 32, 48, 64] as const;

type StyleCol = {
  id: string;
  label: string;
  note?: string;
};

const STYLES: StyleCol[] = [
  { id: "avataaars-neutral", label: "avataaars-neutral" },
  { id: "bottts", label: "bottts" },
  { id: "fun-emoji", label: "fun-emoji" },
  { id: "thumbs", label: "thumbs" },
  { id: "croodles-neutral", label: "croodles-neutral", note: "current" },
  { id: "avataaars", label: "avataaars", note: "previous" },
];

function diceBearUrl(style: string, seed: string, sizePx: number): string {
  const params = new URLSearchParams({
    seed,
    size: String(sizePx * 2),
  });
  return `https://api.dicebear.com/9.x/${style}/svg?${params.toString()}`;
}

export default function AvatarComparisonPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Avatar style comparison
        </h1>
        <p className="text-base text-muted-foreground">
          Same 12 identities, every column. Each row is one identity at 24 /
          32 / 48 / 64 px — the four sizes the app actually uses. Scan
          vertically inside a column for consistency across people; scan
          horizontally across columns for the same person in each style.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="sticky left-0 z-10 w-44 border-r border-border bg-muted/30 px-3 py-2 text-left text-base font-medium text-foreground">
                Identity
              </th>
              {STYLES.map((s) => (
                <th
                  key={s.id}
                  className="border-r border-border px-3 py-2 text-left text-base font-medium text-foreground last:border-r-0"
                >
                  <div className="flex items-center gap-2">
                    <span>{s.label}</span>
                    {s.note && (
                      <span className="rounded-md bg-grey-lighter px-1.5 py-0.5 text-sm font-normal text-grey-darker">
                        {s.note}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="border-b border-border bg-muted/10">
              <th className="sticky left-0 z-10 border-r border-border bg-muted/10 px-3 py-1.5 text-left text-sm font-normal text-muted-foreground">
                sizes →
              </th>
              {STYLES.map((s) => (
                <th
                  key={s.id}
                  className="border-r border-border px-3 py-1.5 text-left text-sm font-normal text-muted-foreground last:border-r-0"
                >
                  <div className="flex items-end gap-3">
                    {SIZES.map((px) => (
                      <span key={px} style={{ width: px }}>
                        {px}
                      </span>
                    ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEEDS.map((seed, idx) => (
              <tr
                key={seed}
                className="border-b border-border last:border-b-0"
              >
                <td className="sticky left-0 z-10 w-44 border-r border-border bg-card px-3 py-3 align-middle text-base text-foreground">
                  {seed}
                </td>
                {STYLES.map((s) => (
                  <td
                    key={s.id}
                    className="border-r border-border px-3 py-3 align-middle last:border-r-0"
                  >
                    <div className="flex items-end gap-3">
                      {SIZES.map((px) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={px}
                          src={diceBearUrl(s.id, seed, px)}
                          alt={`${seed} as ${s.label} at ${px}px`}
                          width={px}
                          height={px}
                          loading={idx < 2 ? "eager" : "lazy"}
                          className="rounded-full bg-muted"
                          style={{ width: px, height: px }}
                        />
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="space-y-2 text-base text-muted-foreground">
        <p>
          Hypothesis: one of avataaars-neutral / bottts / fun-emoji / thumbs
          reads more delightful than croodles-neutral at the small sizes
          where avatars actually live, while staying gender-neutral.
        </p>
        <p>
          SUF axis: <span className="font-medium text-foreground">Fun</span>{" "}
          — avatars are pure delight surface; identity is the only useful
          job, so Fun decides.
        </p>
      </footer>
    </div>
  );
}

/** Mockup registry. The gallery at `/mockups` reads this list and renders
 *  the cards.
 *
 *  Adding a new mockup: create a new file in `./entries/<theme>-<variant>.ts`
 *  exporting a `meta: MockupMeta` constant, then add the import + reference
 *  below. One entry per file keeps parallel workers from colliding on this
 *  array. See `./entries/README.md`.
 */

export type MockupStatus = "exploring" | "loved" | "rejected" | "promoted";
export type SufAxis = "simple" | "useful" | "fun";

export type MockupMeta = {
  theme: string;
  variant: string;
  title: string;
  hypothesis: string;
  sufAxis: SufAxis;
  status: MockupStatus;
  /** Set to true when the variant page exists at `path`. Until then the
   *  gallery shows it as a placeholder ("not yet built"). */
  ready: boolean;
  path: string;
  createdAt: string;
  /** Mockup round number. The supervisor assigns this at spawn time;
   *  the gallery groups + sorts by round (highest first). */
  round: number;
};

import { meta as compactMeta } from "./entries/qa-window-compact";
import { meta as guidedMeta } from "./entries/qa-window-guided";
import { meta as overlayMeta } from "./entries/qa-window-overlay";
import { meta as splitpaneMeta } from "./entries/qa-window-splitpane";
import { meta as stainedglassMeta } from "./entries/qa-window-stainedglass";
import { meta as dragciteMeta } from "./entries/qa-window-dragcite";
import { meta as threadedMeta } from "./entries/qa-window-threaded";
import { meta as inspectMeta } from "./entries/qa-window-inspect";
import { meta as pulseMeta } from "./entries/qa-window-pulse";
import { meta as popoverMeta } from "./entries/qa-window-popover";
import { meta as refinedMeta } from "./entries/qa-window-refined";
import { meta as reactMeta } from "./entries/qa-window-react";
import { meta as keysMeta } from "./entries/qa-window-keys";
import { meta as flowMeta } from "./entries/qa-window-flow";
import { meta as copilotMeta } from "./entries/qa-window-copilot";
import { meta as distilledMeta } from "./entries/qa-window-distilled";
import { meta as tightMeta } from "./entries/qa-window-tight";
import { meta as zenMeta } from "./entries/qa-window-zen";
import { meta as crispMeta } from "./entries/qa-window-crisp";
import { meta as quietMeta } from "./entries/qa-window-quiet";

export const MOCKUPS: MockupMeta[] = [
  compactMeta,
  guidedMeta,
  overlayMeta,
  splitpaneMeta,
  stainedglassMeta,
  dragciteMeta,
  threadedMeta,
  inspectMeta,
  pulseMeta,
  popoverMeta,
  refinedMeta,
  reactMeta,
  keysMeta,
  flowMeta,
  copilotMeta,
  distilledMeta,
  tightMeta,
  zenMeta,
  crispMeta,
  quietMeta,
];

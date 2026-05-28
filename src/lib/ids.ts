import { customAlphabet, customRandom } from "nanoid";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_SIZE = 12;
const defaultGenerate = customAlphabet(ALPHABET, ID_SIZE);
let generate: () => string = defaultGenerate;

export type IdPrefix =
  | "cus"
  | "tm"
  | "tkt"
  | "rsp"
  | "svy"
  | "tmg"
  | "tkm"
  | "tke"
  | "sc"
  | "scc"
  | "scr"
  | "scv"
  | "svc"
  | "svr"
  | "evl"
  | "ecs"
  | "cnt"
  | "qac"
  | "qrx"
  | "usr"
  | "wks"
  | "uwk"
  | "wak"
  | "efb";

export function prefixedId(prefix: IdPrefix): string {
  return `${prefix}_${generate()}`;
}

/** Replace the default crypto-based id generator with one backed by `rng`
 *  (a 0..1 random function). Used in seed scripts to make ids reproducible
 *  by routing through a seeded Faker — app runtime never calls this and
 *  keeps the crypto-backed default. */
export function setIdRandomSource(rng: () => number): void {
  generate = customRandom(ALPHABET, ID_SIZE, (size) => {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = Math.floor(rng() * 256);
    }
    return bytes;
  });
}

/** Restore the default crypto-based id generator. */
export function resetIdRandomSource(): void {
  generate = defaultGenerate;
}

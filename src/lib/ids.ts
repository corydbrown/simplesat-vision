import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, 12);

export type IdPrefix = "cus" | "tm" | "tkt" | "rsp" | "qa";

export function prefixedId(prefix: IdPrefix): string {
  return `${prefix}_${generate()}`;
}

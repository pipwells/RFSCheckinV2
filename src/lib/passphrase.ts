// src/lib/passphrase.ts
import crypto from "crypto";

const WORDS_A = [
  "ember","river","forest","silver","tiger","comet","ember","anchor",
  "sunset","pebble","granite","cedar","willow","quartz","harbor","aurora"
];
const WORDS_B = [
  "bright","quiet","swift","brave","calm","bold","clear","true",
  "prime","steady","amber","lucky","noble","vivid","rapid","sturdy"
];
const WORDS_C = [
  "flame","ridge","haven","sprint","pulse","crest","trail","spark",
  "grove","delta","blaze","peak","drift","flare","dawn","stone"
];

export function generatePassphrase(): { phrase: string; display: string } {
  // human friendly: word-word-word-#### (lowercase)
  const a = WORDS_A[Math.floor(Math.random() * WORDS_A.length)];
  const b = WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
  const c = WORDS_C[Math.floor(Math.random() * WORDS_C.length)];
  const n = String(Math.floor(1000 + Math.random() * 9000));
  const display = `${a}-${b}-${c}-${n}`.toLowerCase();
  // phrase = canonical form for hashing (strip spaces, collapse dashes)
  const phrase = normalizePassphrase(display);
  return { phrase, display };
}

export function normalizePassphrase(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
}

export function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function randomKeyHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex"); // kioskKey
}

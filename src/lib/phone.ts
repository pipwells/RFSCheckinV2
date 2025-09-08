// src/lib/phone.ts
export function normalizeAUMobile(input: string | undefined | null): string | null {
  if (!input) return null;
  let s = String(input).replace(/[^\d+]/g, "").trim();

  // Accept +61XXXXXXXXX → 04XXXXXXXX
  if (s.startsWith("+61")) {
    s = "0" + s.slice(3);
  }
  // Accept 61XXXXXXXXX (no plus)
  if (s.startsWith("61") && s.length === 11) {
    s = "0" + s.slice(2);
  }
  // If it starts with "4" and length 9, assume missing leading zero
  if (s.length === 9 && s.startsWith("4")) {
    s = "0" + s;
  }
  // Now require 04XXXXXXXX (10 digits)
  if (!/^04\d{8}$/.test(s)) return null;
  return s;
}

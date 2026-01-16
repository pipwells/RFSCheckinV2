import { prisma } from "@/lib/db";

const LETTERS = ["A","B","C","D","E","F","G","H"];

export async function suggestTopLevelCode(organisationId: string) {
  // Allowed: "1".."8"
  const used = new Set(
    (await prisma.category.findMany({
      where: { organisationId, parentId: null },
      select: { code: true },
    })).map((c: { code: string }) => c.code)
  );

  for (let i = 1; i <= 8; i++) {
    const cand = String(i);
    if (!used.has(cand)) return cand;
  }
  return null; // no slot
}

export async function suggestChildCode(organisationId: string, parentId: string) {
  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { code: true, organisationId: true },
  });
  if (!parent) return null;
  const prefix = parent.code.replace(/[^0-9A-Za-z]+/g, ""); // keep it simple

  const children = await prisma.category.findMany({
    where: { organisationId, parentId },
    select: { code: true },
  });

  const usedLetters = new Set(
    children
      .map((c: { code: string }) => c.code.replace(prefix, ""))
      .filter((s: string) => s.length === 1 && LETTERS.includes(s))
  );

  for (const L of LETTERS) {
    if (!usedLetters.has(L)) return `${prefix}${L}`;
  }
  return null;
}

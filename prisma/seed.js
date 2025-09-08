// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1) Organisation
  let org = await prisma.organisation.findFirst({ where: { name: "Engadine RFB" } });
  if (!org) {
    org = await prisma.organisation.create({
      data: { name: "Engadine RFB", timezone: "Australia/Sydney" },
    });
    console.log("Created organisation:", org.name);
  } else {
    console.log("Using existing organisation:", org.name);
  }

  // 2) Station
  let station = await prisma.station.findFirst({
    where: { organisationId: org.id, code: "ENG" },
  });
  if (!station) {
    station = await prisma.station.create({
      data: {
        organisationId: org.id,
        name: "Engadine",
        code: "ENG",
        active: true,
      },
    });
    console.log("Created station:", station.name);
  } else {
    console.log("Using existing station:", station.name);
  }

  // 3) Top-level categories (your 6 headings)
  const tops = [
    { code: "OP",   name: "Operational Roles",        sort: 10 },
    { code: "SUP",  name: "Support Roles",            sort: 20 },
    { code: "TRN",  name: "Training",                 sort: 30 },
    { code: "ADM",  name: "Administration",           sort: 40 },
    { code: "CEPR", name: "Community Education and PR", sort: 50 },
    { code: "OTHER",name: "Other",                    sort: 60 },
  ];

  for (const t of tops) {
    const existing = await prisma.category.findFirst({
      where: { organisationId: org.id, code: t.code, parentId: null },
    });
    if (!existing) {
      await prisma.category.create({
        data: {
          organisationId: org.id,
          parentId: null,
          code: t.code,
          name: t.name,
          sort: t.sort,
          active: true,
        },
      });
      console.log("Created category:", t.name);
    } else {
      console.log("Category already exists:", t.name);
    }
  }

  console.log("\nSeed complete.");
  console.log("Org ID:", org.id);
  console.log("Station ID:", station.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

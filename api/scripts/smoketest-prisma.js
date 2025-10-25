const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`SELECT NOW() AS now`;
  const val = rows[0]?.now || rows[0]?.NOW || Object.values(rows[0] || {})[0];
  console.log("✅ DB time:", val);
}

main()
  .catch((e) => {
    console.error("❌ Prisma smoketest failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

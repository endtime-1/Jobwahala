const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany({ select: { email: true, role: true } })
  .then(u => console.table(u))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

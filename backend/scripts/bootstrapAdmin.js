require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../dist/config/prisma').default;

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set before running bootstrap:admin');
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
    },
  });

  console.log(`Admin ready: ${admin.email} (${admin.role})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

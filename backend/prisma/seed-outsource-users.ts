// prisma/seed-outsource-users.ts
// Adds outsource technician users + finance admin to existing database (non-destructive)
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding Outsource users + Finance Admin...');

  const hashedPassword = await bcrypt.hash('Password@1', 10);

  const usersToCreate = [
    {
      username: 'finance',
      email: 'finance@rim.com',
      firstName: 'Pimchan',
      lastName: 'Finance',
      phone: '02-123-4571',
      technicianType: null as any,
      role: 'FINANCE_ADMIN' as const,
    },
    {
      username: 'outsource1',
      email: 'outsource1@rim.com',
      firstName: 'Wichai',
      lastName: 'Outsource',
      phone: '089-111-1111',
      technicianType: 'OUTSOURCE' as const,
      role: 'TECHNICIAN' as const,
    },
    {
      username: 'outsource2',
      email: 'outsource2@rim.com',
      firstName: 'Prasert',
      lastName: 'Contractor',
      phone: '089-222-2222',
      technicianType: 'OUTSOURCE' as const,
      role: 'TECHNICIAN' as const,
    },
    {
      username: 'outsource3',
      email: 'outsource3@rim.com',
      firstName: 'Anan',
      lastName: 'Freelance',
      phone: '089-333-3333',
      technicianType: 'OUTSOURCE' as const,
      role: 'TECHNICIAN' as const,
    },
  ];

  for (const u of usersToCreate) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: u.email }, { username: u.username }] },
    });

    if (existing) {
      console.log(`  ⏭️  Skip (already exists): ${u.email}`);
      continue;
    }

    await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        password: hashedPassword,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        status: 'ACTIVE',
        technicianType: u.technicianType,
        roles: {
          create: [{ role: u.role }],
        },
      },
    });
    console.log(`  ✅ Created: ${u.email} (${u.role}${u.technicianType ? ' / ' + u.technicianType : ''})`);
  }

  console.log('');
  console.log('🔐 New Login Credentials (Password: Password@1):');
  console.log('  Finance Admin:           finance@rim.com');
  console.log('  Outsource Technician 1:  outsource1@rim.com');
  console.log('  Outsource Technician 2:  outsource2@rim.com');
  console.log('  Outsource Technician 3:  outsource3@rim.com');
  console.log('');
  console.log('✅ Done!');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

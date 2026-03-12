// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data (order matters due to foreign keys)
  await prisma.incidentHistory.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.equipmentLog.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.userRoleAssignment.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ Cleaned existing data');
  console.log('');

  // ==========================================
  // Seed Users with Multi-roles
  // ==========================================
  const hashedPassword = await bcrypt.hash('Password@1', 10);

  console.log('👥 Creating Users...');

  // Protected Super Admin - cannot be deleted or modified
  const superAdmin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@rub-jobb.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '02-000-0000',
      status: 'ACTIVE',
      isProtected: true, // Protected account
      roles: {
        create: [{ role: 'SUPER_ADMIN' }],
      },
    },
  });
  console.log('  ✅ Super Admin (Protected): admin@rub-jobb.com / Password@1');

  // IT Manager
  const itManager = await prisma.user.create({
    data: {
      username: 'itmanager',
      email: 'itmanager@rim.com',
      password: hashedPassword,
      firstName: 'Somchai',
      lastName: 'IT Manager',
      phone: '02-123-4568',
      status: 'ACTIVE',
      roles: {
        create: [{ role: 'IT_MANAGER' }],
      },
    },
  });
  console.log('  ✅ IT Manager: itmanager@rim.com / Password@1');

  // Supervisor
  const supervisor = await prisma.user.create({
    data: {
      username: 'supervisor',
      email: 'supervisor@rim.com',
      password: hashedPassword,
      firstName: 'Somying',
      lastName: 'Supervisor',
      phone: '02-123-4569',
      status: 'ACTIVE',
      roles: {
        create: [{ role: 'SUPERVISOR' }],
      },
    },
  });
  console.log('  ✅ Supervisor: supervisor@rim.com / Password@1');

  // Help Desk
  const helpDesk = await prisma.user.create({
    data: {
      username: 'helpdesk',
      email: 'helpdesk@rim.com',
      password: hashedPassword,
      firstName: 'Suda',
      lastName: 'Help Desk',
      phone: '02-123-4570',
      status: 'ACTIVE',
      roles: {
        create: [{ role: 'HELP_DESK' }],
      },
    },
  });
  console.log('  ✅ Help Desk: helpdesk@rim.com / Password@1');

  // Technician (with multiple roles)
  const technician = await prisma.user.create({
    data: {
      username: 'technician',
      email: 'technician@rim.com',
      password: hashedPassword,
      firstName: 'Manop',
      lastName: 'Technician',
      phone: '081-234-5678',
      status: 'ACTIVE',
      roles: {
        create: [
          { role: 'TECHNICIAN' },
        ],
      },
    },
  });
  console.log('  ✅ Technician: technician@rim.com / Password@1');

  // End User
  const endUser = await prisma.user.create({
    data: {
      username: 'enduser',
      email: 'user@rim.com',
      password: hashedPassword,
      firstName: 'Napat',
      lastName: 'End User',
      phone: '081-234-5679',
      status: 'ACTIVE',
      roles: {
        create: [{ role: 'END_USER' }],
      },
    },
  });
  console.log('  ✅ End User: user@rim.com / Password@1');

  // Finance Admin
  const financeAdmin = await prisma.user.create({
    data: {
      username: 'finance',
      email: 'finance@rim.com',
      password: hashedPassword,
      firstName: 'Pimchan',
      lastName: 'Finance',
      phone: '02-123-4571',
      status: 'ACTIVE',
      roles: {
        create: [{ role: 'FINANCE_ADMIN' }],
      },
    },
  });
  console.log('  ✅ Finance Admin: finance@rim.com / Password@1');

  // Outsource Technician 1
  const outsource1 = await prisma.user.create({
    data: {
      username: 'outsource1',
      email: 'outsource1@rim.com',
      password: hashedPassword,
      firstName: 'Wichai',
      lastName: 'Outsource',
      phone: '089-111-1111',
      status: 'ACTIVE',
      technicianType: 'OUTSOURCE',
      roles: {
        create: [{ role: 'TECHNICIAN' }],
      },
    },
  });
  console.log('  ✅ Outsource Technician 1: outsource1@rim.com / Password@1');

  // Outsource Technician 2
  const outsource2 = await prisma.user.create({
    data: {
      username: 'outsource2',
      email: 'outsource2@rim.com',
      password: hashedPassword,
      firstName: 'Prasert',
      lastName: 'Contractor',
      phone: '089-222-2222',
      status: 'ACTIVE',
      technicianType: 'OUTSOURCE',
      roles: {
        create: [{ role: 'TECHNICIAN' }],
      },
    },
  });
  console.log('  ✅ Outsource Technician 2: outsource2@rim.com / Password@1');

  // Outsource Technician 3
  const outsource3 = await prisma.user.create({
    data: {
      username: 'outsource3',
      email: 'outsource3@rim.com',
      password: hashedPassword,
      firstName: 'Anan',
      lastName: 'Freelance',
      phone: '089-333-3333',
      status: 'ACTIVE',
      technicianType: 'OUTSOURCE',
      roles: {
        create: [{ role: 'TECHNICIAN' }],
      },
    },
  });
  console.log('  ✅ Outsource Technician 3: outsource3@rim.com / Password@1');

  // Pending User (for testing approval flow)
  const pendingUser = await prisma.user.create({
    data: {
      username: 'pending',
      email: 'pending@rim.com',
      password: hashedPassword,
      firstName: 'New',
      lastName: 'User',
      phone: '081-999-9999',
      status: 'PENDING',
      roles: {
        create: [{ role: 'READ_ONLY' }],
      },
    },
  });
  console.log('  ✅ Pending User: pending@rim.com / Password@1 (Status: PENDING)');

  console.log('');

  // ==========================================
  // Seed Stores
  // ==========================================
  console.log('🏪 Creating Stores...');

  const store1 = await prisma.store.create({
    data: {
      storeCode: 'WAT-BKK-001',
      name: 'Watsons Siam Paragon',
      company: 'Watsons',
      storeType: 'PERMANENT',
      address: '991 Rama 1 Road',
      province: 'Bangkok',
      postalCode: '10330',
      area: 'Bangkok Central',
      serviceCenter: 'Bangkok Service Center',
      phone: '02-123-4567',
      email: 'siam@watsons.co.th',
      googleMapLink: 'https://maps.google.com/?q=13.7456,100.5344',
      circuitId: 'CIR-BKK-001',
      routerIp: '192.168.1.1',
      switchIp: '192.168.1.2',
      accessPointIp: '192.168.1.3',
      pcServerIp: '192.168.10.1',
      posIp: '192.168.20.1',
      cctvIp: '192.168.30.1',
      mondayOpen: '10:00',
      mondayClose: '22:00',
      tuesdayOpen: '10:00',
      tuesdayClose: '22:00',
      wednesdayOpen: '10:00',
      wednesdayClose: '22:00',
      thursdayOpen: '10:00',
      thursdayClose: '22:00',
      fridayOpen: '10:00',
      fridayClose: '22:00',
      saturdayOpen: '10:00',
      saturdayClose: '22:00',
      sundayOpen: '10:00',
      sundayClose: '22:00',
      holidayOpen: '11:00',
      holidayClose: '20:00',
      openDate: new Date('2020-01-15'),
      storeStatus: 'ACTIVE',
    },
  });
  console.log('  ✅ Store 1: Watsons Siam Paragon');

  const store2 = await prisma.store.create({
    data: {
      storeCode: 'WAT-BKK-002',
      name: 'Watsons CentralWorld',
      company: 'Watsons',
      storeType: 'PERMANENT',
      address: '999/9 Rama 1 Road',
      province: 'Bangkok',
      postalCode: '10330',
      area: 'Bangkok Central',
      serviceCenter: 'Bangkok Service Center',
      phone: '02-123-4570',
      email: 'centralworld@watsons.co.th',
      routerIp: '192.168.2.1',
      switchIp: '192.168.2.2',
      mondayOpen: '10:00',
      mondayClose: '22:00',
      tuesdayOpen: '10:00',
      tuesdayClose: '22:00',
      wednesdayOpen: '10:00',
      wednesdayClose: '22:00',
      thursdayOpen: '10:00',
      thursdayClose: '22:00',
      fridayOpen: '10:00',
      fridayClose: '22:00',
      saturdayOpen: '10:00',
      saturdayClose: '22:00',
      sundayOpen: '10:00',
      sundayClose: '22:00',
      holidayOpen: '11:00',
      holidayClose: '20:00',
      openDate: new Date('2020-03-10'),
      storeStatus: 'ACTIVE',
    },
  });
  console.log('  ✅ Store 2: Watsons CentralWorld');

  console.log('');

  // ==========================================
  // Seed Equipment
  // ==========================================
  console.log('💻 Creating Equipment...');

  const equipment1 = await prisma.equipment.create({
    data: {
      serialNumber: 'PC-WAT-001',
      name: 'Dell OptiPlex 7090',
      category: 'COMPUTER',
      brand: 'Dell',
      model: 'OptiPlex 7090',
      purchaseDate: new Date('2024-01-15'),
      warrantyExpiry: new Date('2027-01-15'),
      status: 'ACTIVE',
      storeId: store1.id,
    },
  });
  console.log('  ✅ Equipment 1: Dell OptiPlex 7090');

  const equipment2 = await prisma.equipment.create({
    data: {
      serialNumber: 'PR-WAT-001',
      name: 'HP LaserJet Pro M404dn',
      category: 'PRINTER',
      brand: 'HP',
      model: 'M404dn',
      purchaseDate: new Date('2024-02-20'),
      warrantyExpiry: new Date('2027-02-20'),
      status: 'ACTIVE',
      storeId: store1.id,
    },
  });
  console.log('  ✅ Equipment 2: HP LaserJet Pro');

  console.log('');

  // ==========================================
  // Seed Incidents
  // ==========================================
  console.log('🎫 Creating Incidents...');

  await prisma.incident.create({
    data: {
      id: 'INC-2025-0001',
      ticketNumber: 'INC-2025-0001',
      title: 'Printer paper jam',
      description: 'HP printer keeps jamming with every print job',
      category: 'Hardware',
      priority: 'HIGH',
      status: 'OPEN',
      storeId: store1.id,
      equipmentId: equipment2.id,
      reportedBy: endUser.id,
      createdById: endUser.id,
      slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
  });
  console.log('  ✅ Incident 1: INC-2025-0001 (OPEN)');

  await prisma.incident.create({
    data: {
      id: 'INC-2025-0002',
      ticketNumber: 'INC-2025-0002',
      title: "Desktop won't boot",
      description: 'Desktop computer showing blue screen on startup',
      category: 'Hardware',
      priority: 'CRITICAL',
      status: 'ASSIGNED',
      storeId: store1.id,
      equipmentId: equipment1.id,
      reportedBy: endUser.id,
      createdById: endUser.id,
      assigneeId: technician.id,
      slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });
  console.log('  ✅ Incident 2: INC-2025-0002 (ASSIGNED)');

  console.log('');
  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  - Users: 11 (1 protected, 1 pending)');
  console.log('  - Stores: 2');
  console.log('  - Equipment: 2');
  console.log('  - Incidents: 2');
  console.log('');
  console.log('🔐 Login Credentials (Password: Password@1):');
  console.log('  Super Admin (Protected): admin@rub-jobb.com');
  console.log('  IT Manager:              itmanager@rim.com');
  console.log('  Supervisor:              supervisor@rim.com');
  console.log('  Help Desk:               helpdesk@rim.com');
  console.log('  Technician (Insource):   technician@rim.com');
  console.log('  Finance Admin:           finance@rim.com');
  console.log('  Outsource Technician 1:  outsource1@rim.com');
  console.log('  Outsource Technician 2:  outsource2@rim.com');
  console.log('  Outsource Technician 3:  outsource3@rim.com');
  console.log('  End User:                user@rim.com');
  console.log('  Pending User:            pending@rim.com (Status: PENDING)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data
  await prisma.incident.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ Cleaned existing data');
  console.log('');

  // ==========================================
  // Seed Users
  // ==========================================
  const hashedPassword = await bcrypt.hash('password123', 10);

  console.log('👥 Creating Users...');

  const superAdmin = await prisma.user.create({
    data: {
      username: 'superadmin',
      email: 'superadmin@rim.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '02-123-4567',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('  ✅ Super Admin: superadmin@rim.com / password123');

  const itManager = await prisma.user.create({
    data: {
      username: 'itmanager',
      email: 'itmanager@rim.com',
      password: hashedPassword,
      firstName: 'Somchai',
      lastName: 'IT Manager',
      phone: '02-123-4568',
      role: 'IT_MANAGER',
      status: 'ACTIVE',
    },
  });
  console.log('  ✅ IT Manager: itmanager@rim.com / password123');

  const supervisor = await prisma.user.create({
    data: {
      username: 'supervisor',
      email: 'supervisor@rim.com',
      password: hashedPassword,
      firstName: 'Somying',
      lastName: 'Supervisor',
      phone: '02-123-4569',
      role: 'SUPERVISOR',
      status: 'ACTIVE',
    },
  });
  console.log('  ✅ Supervisor: supervisor@rim.com / password123');

  const helpDesk = await prisma.user.create({
    data: {
      username: 'helpdesk',
      email: 'helpdesk@rim.com',
      password: hashedPassword,
      firstName: 'Suda',
      lastName: 'Help Desk',
      phone: '02-123-4570',
      role: 'HELP_DESK',
      status: 'ACTIVE',
    },
  });
  console.log('  ✅ Help Desk: helpdesk@rim.com / password123');

  const technician = await prisma.user.create({
    data: {
      username: 'technician',
      email: 'technician@rim.com',
      password: hashedPassword,
      firstName: 'Manop',
      lastName: 'Technician',
      phone: '081-234-5678',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
    },
  });
  console.log('  ✅ Technician: technician@rim.com / password123');

  const endUser = await prisma.user.create({
    data: {
      username: 'enduser',
      email: 'user@rim.com',
      password: hashedPassword,
      firstName: 'Napat',
      lastName: 'End User',
      phone: '081-234-5679',
      role: 'END_USER',
      status: 'ACTIVE',
    },
  });
  console.log('  ✅ End User: user@rim.com / password123');

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
  console.log('  ✅ Store 1: Watsons Siam Paragon (ID: ' + store1.id + ')');

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
  console.log('  ✅ Store 2: Watsons CentralWorld (ID: ' + store2.id + ')');

  const store3 = await prisma.store.create({
    data: {
      storeCode: 'WAT-BKK-003',
      name: 'Watsons EmQuartier',
      company: 'Watsons',
      storeType: 'PERMANENT',
      address: '693 Sukhumvit Road',
      province: 'Bangkok',
      postalCode: '10110',
      area: 'Bangkok East',
      serviceCenter: 'Bangkok Service Center',
      phone: '02-123-4571',
      email: 'emquartier@watsons.co.th',
      routerIp: '192.168.3.1',
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
      openDate: new Date('2020-06-20'),
      storeStatus: 'ACTIVE',
    },
  });
  console.log('  ✅ Store 3: Watsons EmQuartier (ID: ' + store3.id + ')');

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

  const equipment3 = await prisma.equipment.create({
    data: {
      serialNumber: 'POS-WAT-001',
      name: 'POS Terminal',
      category: 'POS',
      brand: 'NCR',
      model: 'RealPOS 82XRT',
      purchaseDate: new Date('2024-03-10'),
      warrantyExpiry: new Date('2027-03-10'),
      status: 'ACTIVE',
      storeId: store1.id,
    },
  });
  console.log('  ✅ Equipment 3: POS Terminal');

  const equipment4 = await prisma.equipment.create({
    data: {
      serialNumber: 'RTR-WAT-001',
      name: 'Cisco Router 2901',
      category: 'ROUTER',
      brand: 'Cisco',
      model: '2901',
      purchaseDate: new Date('2024-01-05'),
      warrantyExpiry: new Date('2029-01-05'),
      status: 'ACTIVE',
      storeId: store2.id,
    },
  });
  console.log('  ✅ Equipment 4: Cisco Router');

  console.log('');

  // ==========================================
  // Seed Incidents
  // ==========================================
  console.log('🎫 Creating Incidents...');

  const incident1 = await prisma.incident.create({
    data: {
      id: 'INC-2025-0001',
      incidentCode: 'INC-2025-0001',
      title: 'Printer paper jam',
      description: 'HP printer keeps jamming with every print job',
      category: 'Hardware',
      priority: 'HIGH',
      status: 'OPEN',
      storeId: store1.id,
      equipmentId: equipment2.id,
      reportedBy: endUser.id,
      createdById: endUser.id,
      slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
    },
  });
  console.log('  ✅ Incident 1: ' + incident1.incidentCode + ' (OPEN)');

  const incident2 = await prisma.incident.create({
    data: {
      id: 'INC-2025-0002',
      incidentCode: 'INC-2025-0002',
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
      slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    },
  });
  console.log('  ✅ Incident 2: ' + incident2.incidentCode + ' (ASSIGNED)');

  const incident3 = await prisma.incident.create({
    data: {
      id: 'INC-2025-0003',
      incidentCode: 'INC-2025-0003',
      title: 'POS system slow',
      description: 'POS terminal taking 30+ seconds to process transactions',
      category: 'Performance',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      storeId: store1.id,
      equipmentId: equipment3.id,
      reportedBy: endUser.id,
      createdById: helpDesk.id,
      assigneeId: technician.id,
      slaDeadline: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
    },
  });
  console.log('  ✅ Incident 3: ' + incident3.incidentCode + ' (IN_PROGRESS)');

  const incident4 = await prisma.incident.create({
    data: {
      id: 'INC-2025-0004',
      incidentCode: 'INC-2025-0004',
      title: 'Internet connection unstable',
      description: 'WiFi keeps disconnecting every 5-10 minutes',
      category: 'Network',
      priority: 'HIGH',
      status: 'RESOLVED',
      storeId: store2.id,
      equipmentId: equipment4.id,
      reportedBy: endUser.id,
      createdById: helpDesk.id,
      assigneeId: technician.id,
      resolvedAt: new Date(),
      resolutionNote: 'Restarted router and reconfigured WiFi settings. Connection stable now.',
      slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
    },
  });
  console.log('  ✅ Incident 4: ' + incident4.incidentCode + ' (RESOLVED)');

  console.log('');
  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  - Users: 6');
  console.log('  - Stores: 3');
  console.log('  - Equipment: 4');
  console.log('  - Incidents: 4');
  console.log('');
  console.log('🔐 Login Credentials:');
  console.log('  Super Admin: superadmin@rim.com / password123');
  console.log('  IT Manager:  itmanager@rim.com / password123');
  console.log('  Supervisor:  supervisor@rim.com / password123');
  console.log('  Help Desk:   helpdesk@rim.com / password123');
  console.log('  Technician:  technician@rim.com / password123');
  console.log('  End User:    user@rim.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
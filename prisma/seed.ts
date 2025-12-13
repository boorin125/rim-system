// prisma/seed.ts
import { PrismaClient, UserRole, UserStatus, EquipmentCategory, EquipmentStatus, Priority, IncidentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.incident.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Users
  console.log('👥 Creating users...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@rim.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '081-234-5678',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const itManager = await prisma.user.create({
    data: {
      email: 'john.doe@watsons.co.th',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Doe',
      phone: '082-345-6789',
      role: UserRole.IT_MANAGER,
      status: UserStatus.ACTIVE,
    },
  });

  const helpDesk = await prisma.user.create({
    data: {
      email: 'jane.smith@watsons.co.th',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '083-456-7890',
      role: UserRole.HELP_DESK,
      status: UserStatus.ACTIVE,
    },
  });

  const technician1 = await prisma.user.create({
    data: {
      email: 'mike.brown@watsons.co.th',
      password: hashedPassword,
      firstName: 'Mike',
      lastName: 'Brown',
      phone: '084-567-8901',
      role: UserRole.TECHNICIAN,
      status: UserStatus.ACTIVE,
    },
  });

  const endUser = await prisma.user.create({
    data: {
      email: 'user@watsons.co.th',
      password: hashedPassword,
      firstName: 'End',
      lastName: 'User',
      phone: '085-678-9012',
      role: UserRole.END_USER,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✅ Created ${5} users`);

  // 2. Create Stores
  console.log('🏪 Creating stores...');

  const store1 = await prisma.store.create({
    data: {
      storeCode: 'WTS-001',
      name: 'Watsons Siam Paragon',
      address: '991 Rama I Rd, Pathum Wan',
      province: 'Bangkok',
      district: 'Pathum Wan',
      subDistrict: 'Pathum Wan',
      postalCode: '10330',
      latitude: 13.7467,
      longitude: 100.5346,
      phone: '02-610-8000',
      isPopup: false,
    },
  });

  const store2 = await prisma.store.create({
    data: {
      storeCode: 'WTS-002',
      name: 'Watsons Central World',
      address: '999/9 Rama I Rd, Pathum Wan',
      province: 'Bangkok',
      district: 'Pathum Wan',
      subDistrict: 'Pathum Wan',
      postalCode: '10330',
      latitude: 13.7469,
      longitude: 100.5398,
      phone: '02-613-1111',
      isPopup: false,
    },
  });

  const store3 = await prisma.store.create({
    data: {
      storeCode: 'WTS-POP-001',
      name: 'Watsons Pop-up Terminal 21',
      address: '88 Soi Sukhumvit 19',
      province: 'Bangkok',
      district: 'Khlong Toei',
      subDistrict: 'Khlong Toei Nuea',
      postalCode: '10110',
      latitude: 13.7375,
      longitude: 100.5601,
      phone: '02-108-0888',
      isPopup: true,
    },
  });

  console.log(`✅ Created ${3} stores`);

  // 3. Create Equipment
  console.log('💻 Creating equipment...');

  const equipment1 = await prisma.equipment.create({
    data: {
      serialNumber: 'DESK-001-2024',
      name: 'Dell OptiPlex 7010',
      category: EquipmentCategory.DESKTOP,
      brand: 'Dell',
      model: 'OptiPlex 7010',
      purchaseDate: new Date('2024-01-15'),
      warrantyExpiry: new Date('2027-01-15'),
      status: EquipmentStatus.ACTIVE,
      storeId: store1.id,
    },
  });

  const equipment2 = await prisma.equipment.create({
    data: {
      serialNumber: 'PRINT-001-2024',
      name: 'HP LaserJet Pro M404dn',
      category: EquipmentCategory.PRINTER,
      brand: 'HP',
      model: 'LaserJet Pro M404dn',
      purchaseDate: new Date('2024-02-20'),
      warrantyExpiry: new Date('2027-02-20'),
      status: EquipmentStatus.ACTIVE,
      storeId: store1.id,
    },
  });

  const equipment3 = await prisma.equipment.create({
    data: {
      serialNumber: 'POS-001-2024',
      name: 'NCR RealPOS 82XRT',
      category: EquipmentCategory.POS,
      brand: 'NCR',
      model: 'RealPOS 82XRT',
      purchaseDate: new Date('2024-03-10'),
      warrantyExpiry: new Date('2027-03-10'),
      status: EquipmentStatus.ACTIVE,
      storeId: store2.id,
    },
  });

  const equipment4 = await prisma.equipment.create({
    data: {
      serialNumber: 'ROUTER-001-2024',
      name: 'Cisco ISR 4331',
      category: EquipmentCategory.ROUTER,
      brand: 'Cisco',
      model: 'ISR 4331',
      purchaseDate: new Date('2024-01-05'),
      warrantyExpiry: new Date('2029-01-05'),
      status: EquipmentStatus.ACTIVE,
      storeId: store2.id,
    },
  });

  console.log(`✅ Created ${4} equipment items`);

  // 4. Create Incidents
  console.log('🎫 Creating incidents...');

  const incident1 = await prisma.incident.create({
    data: {
      title: 'Printer paper jam',
      description: 'HP printer keeps jamming paper. Need urgent fix.',
      priority: Priority.HIGH,
      status: IncidentStatus.OPEN,
      storeId: store1.id,
      equipmentId: equipment2.id,
      createdById: endUser.id,
      slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
    },
  });

  const incident2 = await prisma.incident.create({
    data: {
      title: 'Desktop won\'t boot',
      description: 'Desktop computer showing black screen on startup.',
      priority: Priority.CRITICAL,
      status: IncidentStatus.IN_PROGRESS,
      storeId: store1.id,
      equipmentId: equipment1.id,
      createdById: endUser.id,
      assigneeId: technician1.id,
      slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    },
  });

  const incident3 = await prisma.incident.create({
    data: {
      title: 'POS system slow',
      description: 'POS terminal is very slow during transactions.',
      priority: Priority.MEDIUM,
      status: IncidentStatus.RESOLVED,
      storeId: store2.id,
      equipmentId: equipment3.id,
      createdById: endUser.id,
      assigneeId: technician1.id,
      resolvedAt: new Date(),
      resolutionNote: 'Cleared cache and updated software. System running normally now.',
      slaDeadline: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
    },
  });

  const incident4 = await prisma.incident.create({
    data: {
      title: 'Internet connection unstable',
      description: 'WiFi keeps disconnecting every few minutes.',
      priority: Priority.HIGH,
      status: IncidentStatus.PENDING,
      storeId: store2.id,
      equipmentId: equipment4.id,
      createdById: endUser.id,
      assigneeId: technician1.id,
      slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
    },
  });

  console.log(`✅ Created ${4} incidents`);

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Users: 5 (1 Super Admin, 1 IT Manager, 1 Help Desk, 1 Technician, 1 End User)`);
  console.log(`   - Stores: 3 (2 regular, 1 pop-up)`);
  console.log(`   - Equipment: 4 (Desktop, Printer, POS, Router)`);
  console.log(`   - Incidents: 4 (1 Open, 1 In Progress, 1 Pending, 1 Resolved)`);
  console.log('');
  console.log('🔑 Test Login Credentials:');
  console.log('   Email: admin@rim.com');
  console.log('   Password: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
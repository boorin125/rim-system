// prisma/seed-kb-articles.ts
// Creates 3 draft Knowledge Base articles (Register, Login, Reset Password)
// visible to all roles (visibleToRoles: []), authored by first IT_MANAGER found.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Knowledge Base articles...');

  // Find or create a "คู่มือการใช้งาน" category
  let category = await prisma.knowledgeCategory.findFirst({
    where: { name: 'คู่มือการใช้งาน' },
  });

  if (!category) {
    category = await prisma.knowledgeCategory.create({
      data: {
        name: 'คู่มือการใช้งาน',
        slug: 'user-guide',
        description: 'คู่มือการใช้งานระบบ RIM สำหรับผู้ใช้ทุกระดับ',
        icon: '📖',
        isActive: true,
        sortOrder: 1,
      },
    });
    console.log(`✅ Created category: ${category.name}`);
  } else {
    console.log(`ℹ️  Using existing category: ${category.name}`);
  }

  // Find an IT_MANAGER user as author
  const author = await prisma.user.findFirst({
    where: {
      roles: { some: { role: 'IT_MANAGER' } },
    },
    orderBy: { id: 'asc' },
  });

  if (!author) {
    console.error('❌ No IT_MANAGER user found. Please create one first.');
    process.exit(1);
  }

  console.log(`ℹ️  Using author: ${author.firstName} ${author.lastName} (${author.username})`);

  const articles = [
    {
      title: 'วิธีสมัครสมาชิก (Register)',
      slug: 'how-to-register',
      summary: 'คู่มือการสมัครสมาชิกเข้าใช้งานระบบ RIM สำหรับผู้ใช้ใหม่',
      content: `# วิธีสมัครสมาชิก (Register)

## ภาพรวม
การสมัครสมาชิกเข้าใช้งานระบบ RIM จะต้องดำเนินการผ่านผู้ดูแลระบบ (IT Manager หรือ Help Desk) เนื่องจากระบบใช้การจัดการบัญชีแบบรวมศูนย์

## ขั้นตอนการสมัคร

### สำหรับพนักงานใหม่
1. ติดต่อผู้ดูแลระบบ (IT Manager / Help Desk) เพื่อแจ้งความต้องการใช้งาน
2. แจ้งข้อมูลที่จำเป็น:
   - ชื่อ-นามสกุล (ภาษาไทยและอังกฤษ)
   - อีเมลบริษัท
   - แผนก / สาขาที่สังกัด
   - ตำแหน่งงาน (เพื่อกำหนด Role ที่เหมาะสม)
3. รอรับข้อมูล Username และรหัสผ่านเริ่มต้นจากผู้ดูแลระบบ

### การเข้าสู่ระบบครั้งแรก
1. เข้าสู่ระบบด้วย Username และรหัสผ่านที่ได้รับ
2. ระบบจะแนะนำให้เปลี่ยนรหัสผ่านในครั้งแรก
3. ตั้งรหัสผ่านใหม่ที่ปลอดภัย (ดูข้อกำหนดรหัสผ่านด้านล่าง)

## ข้อกำหนดรหัสผ่าน
- ความยาวอย่างน้อย **8 ตัวอักษร**
- ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว
- ต้องมีตัวเลขอย่างน้อย 1 ตัว
- ต้องมีอักขระพิเศษ (เช่น @, #, !, $) อย่างน้อย 1 ตัว

## Roles ในระบบ
| Role | คำอธิบาย |
|------|----------|
| Read Only | ดูข้อมูลได้อย่างเดียว |
| End User | ผู้ใช้งานทั่วไป (สร้าง Incident ได้) |
| Technician | ช่างเทคนิค |
| Supervisor | หัวหน้าทีม |
| Help Desk | เจ้าหน้าที่ Help Desk |
| IT Manager | ผู้จัดการระบบ IT |

## หมายเหตุ
> ⚠️ บัญชีใหม่จะถูกสร้างโดยผู้ดูแลระบบเท่านั้น ไม่สามารถสมัครด้วยตนเองผ่านหน้าเว็บได้

## ติดต่อขอความช่วยเหลือ
หากพบปัญหาในการเข้าถึงระบบ กรุณาติดต่อ IT Manager หรือ Help Desk ของบริษัท
`,
      keywords: ['register', 'สมัคร', 'สมัครสมาชิก', 'บัญชี', 'account', 'ผู้ใช้ใหม่'],
    },
    {
      title: 'วิธีเข้าสู่ระบบ (Login)',
      slug: 'how-to-login',
      summary: 'คู่มือการเข้าสู่ระบบ RIM และการจัดการ Session',
      content: `# วิธีเข้าสู่ระบบ (Login)

## ขั้นตอนการเข้าสู่ระบบ

1. เปิดเบราว์เซอร์และไปที่ URL ของระบบ RIM
2. กรอก **Username** (ชื่อผู้ใช้ที่ได้รับจากผู้ดูแลระบบ)
3. กรอก **Password** (รหัสผ่านของคุณ)
4. กดปุ่ม **เข้าสู่ระบบ**

## หน้าหลัก (Dashboard)
หลังจาก Login สำเร็จ คุณจะเข้าสู่หน้า Dashboard ที่แสดง:
- สรุปสถานะ Incident ที่เกี่ยวข้องกับคุณ
- การแจ้งเตือนล่าสุด
- เมนูด้านซ้ายสำหรับเข้าถึงฟังก์ชันต่างๆ

## การ Logout
- คลิกที่ชื่อผู้ใช้หรือรูปโปรไฟล์ที่มุมขวาบน
- เลือก **ออกจากระบบ**

> ⚠️ ควร Logout ทุกครั้งเมื่อเลิกใช้งาน โดยเฉพาะเมื่อใช้คอมพิวเตอร์สาธารณะ

## ปัญหาที่พบบ่อย

### ลืมรหัสผ่าน
กดลิงก์ **"ลืมรหัสผ่าน?"** ที่หน้า Login หรือดูบทความ [วิธี Reset Password](how-to-reset-password)

### ชื่อผู้ใช้ / รหัสผ่านไม่ถูกต้อง
- ตรวจสอบว่ากรอก Username ถูกต้อง (ไม่มีช่องว่างนำหน้าหรือท้าย)
- ตรวจสอบว่า Caps Lock ไม่ได้เปิดอยู่
- หากยังไม่สามารถเข้าได้ ติดต่อ IT Manager เพื่อ Reset รหัสผ่าน

### บัญชีถูกล็อก
หากพยายาม Login ผิดหลายครั้ง บัญชีอาจถูกล็อกชั่วคราว กรุณาติดต่อผู้ดูแลระบบ

## เบราว์เซอร์ที่รองรับ
- Google Chrome (แนะนำ)
- Microsoft Edge
- Mozilla Firefox
- Safari
`,
      keywords: ['login', 'เข้าสู่ระบบ', 'เข้าใช้งาน', 'username', 'password', 'logout'],
    },
    {
      title: 'วิธีรีเซ็ตรหัสผ่าน (Reset Password)',
      slug: 'how-to-reset-password',
      summary: 'คู่มือการรีเซ็ตรหัสผ่านเมื่อลืมหรือต้องการเปลี่ยนรหัสผ่าน',
      content: `# วิธีรีเซ็ตรหัสผ่าน (Reset Password)

## วิธีที่ 1: รีเซ็ตด้วยตัวเอง (ผ่านอีเมล)

### ขั้นตอน
1. ไปที่หน้า Login
2. กดลิงก์ **"ลืมรหัสผ่าน?"** ใต้ปุ่ม Login
3. กรอก **อีเมล** ที่ผูกกับบัญชีของคุณ
4. กดปุ่ม **ส่งลิงก์รีเซ็ต**
5. ตรวจสอบอีเมลของคุณ (รวมถึงกล่อง Spam/Junk)
6. คลิกลิงก์รีเซ็ตในอีเมล (ลิงก์มีอายุ **1 ชั่วโมง**)
7. กรอกรหัสผ่านใหม่ 2 ครั้ง
8. กดปุ่ม **บันทึกรหัสผ่านใหม่**
9. เข้าสู่ระบบด้วยรหัสผ่านใหม่

## วิธีที่ 2: ให้ผู้ดูแลระบบรีเซ็ต (Admin Reset)

หากไม่สามารถรับอีเมลได้ หรืออีเมลมีปัญหา:
1. ติดต่อ IT Manager หรือ Help Desk
2. แจ้ง Username ของคุณ
3. ผู้ดูแลระบบจะรีเซ็ตรหัสผ่านและแจ้งรหัสผ่านชั่วคราว
4. เข้าสู่ระบบด้วยรหัสผ่านชั่วคราว แล้วเปลี่ยนเป็นรหัสผ่านส่วนตัวทันที

## การเปลี่ยนรหัสผ่านเมื่อยังเข้าระบบได้

1. คลิกที่รูปโปรไฟล์หรือชื่อผู้ใช้ที่มุมขวาบน
2. เลือก **โปรไฟล์** หรือ **การตั้งค่า**
3. ไปที่แท็บ **ความปลอดภัย** หรือ **เปลี่ยนรหัสผ่าน**
4. กรอกรหัสผ่านปัจจุบัน
5. กรอกรหัสผ่านใหม่ และยืนยันอีกครั้ง
6. กดปุ่ม **บันทึก**

## ข้อกำหนดรหัสผ่านที่ปลอดภัย
- ความยาวอย่างน้อย **8 ตัวอักษร**
- มีตัวพิมพ์ใหญ่อย่างน้อย **1 ตัว** (A-Z)
- มีตัวพิมพ์เล็กอย่างน้อย **1 ตัว** (a-z)
- มีตัวเลขอย่างน้อย **1 ตัว** (0-9)
- มีอักขระพิเศษอย่างน้อย **1 ตัว** (เช่น @, #, !, $, %)

## คำแนะนำด้านความปลอดภัย
> 🔒 ไม่ควรใช้รหัสผ่านเดียวกันกับบัญชีอื่น เช่น อีเมลส่วนตัว หรือ Social Media

> 🔒 เปลี่ยนรหัสผ่านทุก 90 วัน เพื่อความปลอดภัย

> 🔒 ไม่แชร์รหัสผ่านกับผู้อื่น แม้แต่เพื่อนร่วมงาน

## ติดต่อขอความช่วยเหลือ
หากพบปัญหาที่ไม่สามารถแก้ไขได้ด้วยตนเอง กรุณาติดต่อ IT Manager หรือ Help Desk ของบริษัท
`,
      keywords: ['reset password', 'ลืมรหัสผ่าน', 'เปลี่ยนรหัสผ่าน', 'รหัสผ่าน', 'password', 'forgot'],
    },
  ];

  for (const articleData of articles) {
    // Check if article already exists (by slug)
    const existing = await prisma.knowledgeArticle.findUnique({
      where: { slug: articleData.slug },
    });

    if (existing) {
      console.log(`ℹ️  Article already exists: "${articleData.title}" (skipped)`);
      continue;
    }

    const article = await prisma.knowledgeArticle.create({
      data: {
        categoryId: category.id,
        title: articleData.title,
        slug: articleData.slug,
        summary: articleData.summary,
        content: articleData.content,
        keywords: articleData.keywords,
        isPublic: true,
        isPublished: false, // Draft
        visibleToRoles: [], // Visible to all roles
        authorId: author.id,
        attachments: [],
        relatedArticleIds: [],
      },
    });

    console.log(`✅ Created draft article: "${article.title}" (id: ${article.id})`);
  }

  console.log('');
  console.log('🎉 Done! 3 draft KB articles created.');
  console.log('   → Login to the system as IT_MANAGER to review and publish them.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

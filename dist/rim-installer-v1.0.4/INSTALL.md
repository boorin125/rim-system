# RIM System — คู่มือติดตั้งและแก้ปัญหา

## ข้อกำหนดก่อนติดตั้ง

### Server Requirements
- OS: Ubuntu 20.04+ หรือ Debian 11+
- RAM: 2 GB ขึ้นไป
- Disk: 20 GB ขึ้นไป
- Port ที่ต้องเปิด: **80** และ **443**

### ติดตั้ง Prerequisites
```bash
# อัพเดต package list
apt-get update

# ติดตั้ง packages ที่จำเป็น
apt-get install -y unzip curl openssl

# ติดตั้ง Docker (ถ้ายังไม่มี)
bash setup-docker.sh
```

> **ตรวจสอบว่า Docker ติดตั้งสำเร็จ:** `docker --version`

---

## ขั้นตอนติดตั้ง

```bash
# 1. อัพโหลดไฟล์ installer ไปที่ server
scp rim-installer-v1.0.4.zip root@YOUR_SERVER_IP:~/

# 2. SSH เข้า server
ssh root@YOUR_SERVER_IP

# 3. แตกไฟล์
unzip rim-installer-v1.0.4.zip

# ดูชื่อ folder ที่แตกออกมา แล้ว cd เข้าไป
ls
cd rim-system    # หรือตามชื่อ folder ที่เห็น

# 4. รัน installer (ต้องอยู่ในโฟลเดอร์เดียวกับ docker-compose.yml)
bash install.sh
```

Installer จะถามข้อมูลต่อไปนี้ทีละขั้น:
- **URL หรือ IP ของ Server** (เช่น `https://rim.yourcompany.com` หรือ `http://1.2.3.4`)
- **รหัสผ่าน Database** (ตั้งเองได้ ควรยาว 12+ ตัว)
- **บัญชี Super Admin** (ชื่อ, Email, Password)
- **License Key** (รูปแบบ XXXX-XXXX-XXXX-XXXX)

---

## ขั้นตอนหลังติดตั้ง

1. **เปิด Browser** ไปที่ URL ที่ตั้งไว้ (เช่น `https://rim.yourcompany.com`)
2. **Login** ด้วย Email และ Password ของ Super Admin ที่ตั้งไว้
3. **Activate License**: ไปที่ **Settings → License** → กด **Activate License**
   - ถ้าระบบ Activate อัตโนมัติแล้ว จะเห็นสถานะ Active ✅
4. **ตั้งค่าองค์กร**: **Settings → ทั่วไป** → ใส่ชื่อองค์กร, โลโก้
5. **Restore Backup** (ถ้ามีข้อมูลจาก server เดิม): **Settings → Backup → Restore**
   - ⚠️ ต้อง Activate License ก่อน Restore เสมอ

---

## การตั้งค่า Cloudflare (ถ้าใช้)

1. เพิ่ม DNS A record: `ws` → `YOUR_SERVER_IP` (Proxied = Orange Cloud)
2. ไปที่ **SSL/TLS → Overview** → เลือก **Full**
3. รอ DNS propagate 1-5 นาที

---

## ถอนการติดตั้ง / ติดตั้งใหม่

### หยุดระบบชั่วคราว (เก็บข้อมูลไว้)
```bash
cd /root/rim-system
docker compose down
```

### ลบทุกอย่างและติดตั้งใหม่ทั้งหมด (ล้าง Database ด้วย)
```bash
cd /root/rim-system
docker compose down -v    # -v ลบ volumes (database + uploads)
cd ~
rm -rf rim-system
# จากนั้น unzip และ install ใหม่
```

> ⚠️ `docker compose down -v` จะ **ลบข้อมูลทั้งหมดในฐานข้อมูล** ถาวร — ทำ Backup ก่อนถ้าต้องการเก็บข้อมูล

---

## แก้ปัญหาที่พบบ่อย

### Backend ไม่ start — VAPID key error
```
Error: Vapid public key should be 65 bytes long when decoded.
```
**หมายเหตุ**: Installer v1.0.4 แก้ปัญหานี้แล้ว — จะเกิดก็ต่อเมื่อใช้ installer เวอร์ชั่นเก่า

**แก้ไข**:
```bash
cd /root/rim-system

# Generate VAPID keys ใหม่
VAPID=$(docker run --rm --entrypoint node rubjobb/rim-backend:1.0.4 \
  -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();process.stdout.write(k.publicKey+'|||'+k.privateKey);")

VAPID_PUB=$(echo "$VAPID" | cut -d'|' -f1)
VAPID_PRIV=$(echo "$VAPID" | cut -d'|' -f4)

sed -i "s|VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=${VAPID_PUB}|" .env
sed -i "s|VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=${VAPID_PRIV}|" .env

# Recreate container (restart ไม่พอ ต้อง up -d)
docker compose up -d --force-recreate backend
sleep 10
docker logs rim-backend --tail 15
```

---

### Cloudflare Error 522 — Connection timed out
**สาเหตุ**: Cloudflare เชื่อมต่อ origin (port 443) ไม่ได้

**ตรวจสอบ**:
```bash
# ดูว่า containers ขึ้นครบมั้ย
docker ps

# ทดสอบ HTTPS local
curl -k https://localhost -o /dev/null -w "%{http_code}"

# ดู nginx logs
docker logs rim-nginx --tail 20
```

**แก้ไข**: ตรวจสอบว่า nginx config มี `listen 443 ssl;` และ SSL cert มีอยู่:
```bash
ls docker/nginx/ssl/
docker compose restart nginx
```

---

### `docker compose restart` แล้ว config ไม่อัพเดต
`restart` ไม่ re-read ค่าจาก `.env` ต้องใช้:
```bash
docker compose up -d --force-recreate backend
```

---

### ดู logs ทุก service
```bash
docker logs rim-backend --tail 50
docker logs rim-frontend --tail 50
docker logs rim-nginx --tail 50
docker logs rim-db --tail 20
```

---

### สร้าง Super Admin ด้วยตนเอง (กรณี install ล้มเหลวตอน step 5)
```bash
cat > /tmp/create_admin.js << 'JSEOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
async function main() {
  const email    = process.env.A_EMAIL;
  const pass     = process.env.A_PASS;
  const first    = process.env.A_FIRST;
  const last     = process.env.A_LAST;
  const username = process.env.A_USERNAME;
  const hash = await bcrypt.hash(pass, 12);
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (!existing) {
    await prisma.user.create({
      data: { email, password: hash, firstName: first, lastName: last, username,
              status: 'ACTIVE', isProtected: true,
              roles: { create: { role: 'SUPER_ADMIN' } } },
    });
    console.log('✅ สร้าง Super Admin สำเร็จ:', email);
  } else {
    console.log('ℹ️  มีอยู่แล้ว:', email);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
JSEOF

docker cp /tmp/create_admin.js rim-backend:/app/create_admin.js

docker exec \
  -e A_EMAIL="admin@example.com" \
  -e A_PASS="YourPassword" \
  -e A_FIRST="Admin" \
  -e A_LAST="User" \
  -e A_USERNAME="admin" \
  rim-backend node /app/create_admin.js
```

---

### Reset รหัสผ่าน Admin
```bash
docker exec rim-backend node -e "
const {PrismaClient}=require('@prisma/client');
const bcrypt=require('bcrypt');
const prisma=new PrismaClient();
bcrypt.hash('NewPassword123',12).then(h=>
  prisma.user.updateMany({where:{email:'admin@example.com'},data:{password:h}})
).then(()=>{console.log('✅ Reset สำเร็จ');prisma.\$disconnect();});
"
```

---

## คำสั่งที่ใช้บ่อย

```bash
# ดู status ทุก container
docker compose ps

# ดู logs แบบ real-time
docker compose logs -f

# หยุดระบบ (เก็บข้อมูล)
docker compose down

# อัพเดตระบบ
bash update.sh

# Restart เฉพาะ service
docker compose restart backend
docker compose restart nginx
```

---

## ติดต่อ Support
- Email: support@rub-jobb.com
- Tel: 061-228-2879

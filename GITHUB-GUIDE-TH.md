# 🐙 คู่มือ Backup ขึ้น GitHub - ภาษาไทย

**คู่มือสำหรับ RIM System Backend**

---

## 📋 สารบัญ

1. [สิ่งที่ต้องเตรียม](#สิ่งที่ต้องเตรียม)
2. [ติดตั้ง Git](#ติดตั้ง-git)
3. [สร้างบัญชี GitHub](#สร้างบัญชี-github)
4. [เตรียมไฟล์](#เตรียมไฟล์)
5. [เริ่มต้น Git](#เริ่มต้น-git)
6. [Commit ครั้งแรก](#commit-ครั้งแรก)
7. [อัพโหลดขึ้น GitHub](#อัพโหลดขึ้น-github)
8. [คำสั่งที่ใช้ประจำ](#คำสั่งที่ใช้ประจำ)
9. [แก้ปัญหา](#แก้ปัญหา)

---

## ✅ สิ่งที่ต้องเตรียม

### ก่อนเริ่ม ต้องมี:
```
□ Git (โปรแกรม)
□ บัญชี GitHub
□ โปรเจค RIM System บนเครื่อง
□ ไฟล์ที่ดาวน์โหลดมา (7 ไฟล์)
```

---

## 💻 ติดตั้ง Git

### ตรวจสอบว่ามี Git หรือยัง:
```bash
git --version
```

**ถ้ามี:** จะขึ้นเลขเวอร์ชั่น (เช่น git version 2.40.0)  
**ถ้าไม่มี:** ต้องติดตั้ง

### วิธีติดตั้ง Git:

#### Windows:
1. ไปที่ https://git-scm.com/download/win
2. ดาวน์โหลดไฟล์ติดตั้ง
3. เปิดไฟล์แล้วกด Next ไปเรื่อยๆ
4. ติดตั้งเสร็จแล้วเปิด Command Prompt ใหม่
5. ลองพิมพ์ `git --version` ดู

---

## 🌐 สร้างบัญชี GitHub

### ขั้นตอน:

1. **เข้าเว็บ GitHub**
   - ไปที่ https://github.com
   
2. **สมัครสมาชิก (Sign up)**
   - กรอก Email
   - ตั้งรหัสผ่าน
   - ตั้งชื่อผู้ใช้ (username)
   - ยืนยัน Email

3. **สร้าง Repository ใหม่**
   - กด "New repository" (ปุ่มเขียว)
   - ตั้งชื่อ: `rim-system` หรือ `rim-backend`
   - เลือก **Private** (ส่วนตัว) ⭐ แนะนำ
   - **อย่าติ๊ก** "Initialize with README"
   - กด "Create repository"

**เก็บหน้าจอนี้ไว้** จะมี URL ให้คัดลอก

---

## 📁 เตรียมไฟล์

### ไฟล์ที่ต้องคัดลอก (3 ไฟล์สำคัญ!)

จากโฟลเดอร์ที่ดาวน์โหลดมา คัดลอกไฟล์เหล่านี้ไปที่ `D:\Projects\RIM-System\backend\`

#### ไฟล์ที่ 1: .gitignore ⭐⭐⭐ (สำคัญมาก!)
```
จากที่: [downloads]\.gitignore
ไปที่: D:\Projects\RIM-System\backend\.gitignore

หน้าที่: ป้องกันไม่ให้ไฟล์ .env ถูกอัพโหลด
```

#### ไฟล์ที่ 2: README.md
```
จากที่: [downloads]\README.md
ไปที่: D:\Projects\RIM-System\backend\README.md

หน้าที่: เอกสารอธิบายโปรเจค
```

#### ไฟล์ที่ 3: .env.example
```
จากที่: [downloads]\.env.example
ไปที่: D:\Projects\RIM-System\backend\.env.example

หน้าที่: ตัวอย่างการตั้งค่า (ไม่มีรหัสผ่านจริง)
```

### วิธีคัดลอก:

**ใช้ Command Prompt:**
```bash
cd D:\Projects\RIM-System\backend

copy C:\Users\[ชื่อของคุณ]\Downloads\.gitignore .
copy C:\Users\[ชื่อของคุณ]\Downloads\README.md .
copy C:\Users\[ชื่อของคุณ]\Downloads\.env.example .
```

**หรือใช้ File Explorer:**
1. เปิด Downloads folder
2. คัดลอก 3 ไฟล์ข้างบน
3. วางที่ `D:\Projects\RIM-System\backend\`

---

## 🚀 เริ่มต้น Git

### ขั้นตอนที่ 1: เปิด Command Prompt

```bash
# ไปที่โฟลเดอร์โปรเจค
cd D:\Projects\RIM-System\backend
```

### ขั้นตอนที่ 2: เริ่ม Git

```bash
git init
```

**คำอธิบาย:** คำสั่งนี้จะสร้างโฟลเดอร์ `.git` ซ่อนไว้ในโปรเจค

### ขั้นตอนที่ 3: ตั้งค่าข้อมูลของคุณ

```bash
# ใส่ชื่อของคุณ
git config --global user.name "ชื่อของคุณ"

# ใส่ Email ของคุณ
git config --global user.email "email@example.com"
```

**ตัวอย่าง:**
```bash
git config --global user.name "Naitan"
git config --global user.email "naitan@example.com"
```

### ขั้นตอนที่ 4: ตรวจสอบว่า .gitignore ทำงาน

```bash
git status
```

**ต้องไม่เห็นสิ่งเหล่านี้:**
- ❌ `.env` (ห้ามมี!)
- ❌ `node_modules/`
- ❌ `dist/`
- ❌ `*.log`

**ต้องเห็นสิ่งเหล่านี้:**
- ✅ `src/`
- ✅ `prisma/`
- ✅ `package.json`
- ✅ `.gitignore`
- ✅ `README.md`

**ถ้าเห็น .env ในรายการ → หยุด! อย่า commit!** 🚨

---

## 💾 Commit ครั้งแรก

### ขั้นตอนที่ 1: เพิ่มไฟล์ทั้งหมด

```bash
git add .
```

**คำอธิบาย:** จุด (.) หมายถึงทุกไฟล์

### ขั้นตอนที่ 2: ตรวจสอบอีกครั้ง

```bash
git status
```

ดูว่าไฟล์ที่จะ commit ถูกต้องหรือไม่

### ขั้นตอนที่ 3: Commit

```bash
git commit -m "เริ่มต้นโปรเจค RIM System

- มี API 48 endpoints
- ระบบจัดการเหตุการณ์
- ระบบ Role 6 ตำแหน่ง
- ทดสอบแล้ว 29/29 ผ่าน
- พร้อมใช้งาน"
```

**คำอธิบาย:** 
- `-m` คือ message (ข้อความ)
- เขียนว่าทำอะไรใน commit นี้

---

## 🌐 อัพโหลดขึ้น GitHub

### ขั้นตอนที่ 1: สร้าง Personal Access Token

**ทำไมต้องมี?**  
GitHub ไม่ให้ใช้รหัสผ่านปกติแล้ว ต้องสร้าง Token พิเศษ

**วิธีสร้าง:**

1. **ไปที่ GitHub.com**
   - เข้าสู่ระบบ

2. **Settings**
   - คลิกรูปโปรไฟล์ (มุมขวาบน)
   - เลือก "Settings"

3. **Developer settings**
   - เลื่อนลงล่างสุด
   - คลิก "Developer settings"

4. **Personal access tokens**
   - คลิก "Personal access tokens"
   - เลือก "Tokens (classic)"

5. **Generate new token**
   - คลิก "Generate new token (classic)"
   - ตั้งชื่อ: "RIM System - Git Access"
   - Expiration: เลือก "No expiration" (ไม่หมดอายุ)
   - Scopes: **ติ๊กช่อง "repo"** เท่านั้น ⭐
   - คลิก "Generate token" ด้านล่าง

6. **คัดลอก Token**
   - จะขึ้น Token ยาวๆ
   - **คัดลอกทันที!** จะเห็นครั้งเดียว
   - เก็บไว้ในที่ปลอดภัย

**Token จะมีหน้าตาแบบนี้:**
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### ขั้นตอนที่ 2: เชื่อมโยงกับ GitHub

```bash
# เปลี่ยน [username] เป็นชื่อผู้ใช้ GitHub ของคุณ
git remote add origin https://github.com/[username]/rim-system.git
```

**ตัวอย่าง:**
```bash
git remote add origin https://github.com/naitan/rim-system.git
```

### ขั้นตอนที่ 3: อัพโหลด (Push)

```bash
git push -u origin main
```

**จะถาม:**
```
Username: [ใส่ username GitHub ของคุณ]
Password: [วาง Token ที่คัดลอกไว้]
```

**สำคัญ!** Password ไม่ใช่รหัสผ่าน GitHub แต่เป็น **Token** ที่สร้างไว้!

### ขั้นตอนที่ 4: บันทึก Token (ไม่ต้องใส่ซ้ำ)

```bash
git config --global credential.helper store
```

ครั้งต่อไปจะไม่ถาม Username/Password อีก

---

## ✅ ตรวจสอบความสำเร็จ

### บนเครื่องของคุณ:

```bash
# ดู commit ล่าสุด
git log -1

# ดูไฟล์ที่ถูกติดตาม
git ls-files

# ตรวจสอบว่า .env ไม่ได้ถูกติดตาม
git ls-files | grep .env
# ต้องไม่มีผลลัพธ์! ✅
```

### บน GitHub:

1. เปิด https://github.com/[username]/rim-system
2. ควรเห็นไฟล์ต่างๆ
3. **ต้องไม่เห็น** `.env` ✅
4. **ต้องไม่เห็น** `node_modules/` ✅
5. README.md แสดงผลด้านล่าง ✅

**ถ้าทุกอย่างถูกต้อง = สำเร็จ!** 🎉

---

## 📅 คำสั่งที่ใช้ประจำ

### ทุกวันที่ทำงาน:

```bash
# 1. ตรวจสอบว่ามีอะไรเปลี่ยน
git status

# 2. เพิ่มไฟล์ที่เปลี่ยนทั้งหมด
git add .

# 3. Commit พร้อมข้อความ
git commit -m "เพิ่มฟีเจอร์ [อธิบายว่าทำอะไร]"

# 4. อัพโหลดขึ้น GitHub
git push
```

### ตัวอย่างการใช้งานจริง:

```bash
# เช้า - ดึงข้อมูลล่าสุด
git pull

# ทำงานทั้งวัน...

# เย็น - เก็บงานขึ้น GitHub
git add .
git commit -m "แก้บัค TECHNICIAN filtering"
git push
```

---

## 💬 ข้อความ Commit ที่ดี

### รูปแบบ:

```
[ประเภท]: [อธิบายสั้นๆ]

- รายละเอียด 1
- รายละเอียด 2
```

### ประเภทที่ใช้:

```
feat:     เพิ่มฟีเจอร์ใหม่
fix:      แก้บัค
docs:     แก้เอกสาร
style:    แก้การจัดรูปแบบโค้ด
refactor: ปรับโครงสร้างโค้ด
test:     เพิ่มการทดสอบ
chore:    งานบำรุงรักษา
```

### ตัวอย่างดี ✅:

```bash
git commit -m "feat: เพิ่มฟังก์ชัน reopen incident"
git commit -m "fix: แก้ปัญหา TECHNICIAN เห็นข้อมูลคนอื่น"
git commit -m "docs: อัพเดท README"
```

### ตัวอย่างไม่ดี ❌:

```bash
git commit -m "update"
git commit -m "แก้ไข"
git commit -m "test"
```

---

## 🔍 คำสั่งที่ใช้บ่อย

### ดูสถานะ:
```bash
git status              # ดูว่ามีอะไรเปลี่ยน
git log                 # ดู commit ย้อนหลัง
git log --oneline       # ดู commit แบบสั้น
git diff                # ดูว่าเปลี่ยนอะไรบ้าง
```

### ยกเลิกการเปลี่ยนแปลง:
```bash
git restore [ชื่อไฟล์]       # ยกเลิกการเปลี่ยนไฟล์
git reset HEAD~1            # ยกเลิก commit ล่าสุด
```

### ดึงข้อมูลจาก GitHub:
```bash
git pull                # ดึงข้อมูลล่าสุดมา
```

---

## 🚨 แก้ปัญหา

### ปัญหา: เห็น .env ใน git status

**วิธีแก้:**

```bash
# 1. ตรวจสอบว่ามี .gitignore
dir .gitignore

# 2. ถ้าไม่มี ให้คัดลอกจากไฟล์ที่ดาวน์โหลด
copy [downloads]\.gitignore .

# 3. ตรวจสอบอีกครั้ง
git status
```

### ปัญหา: Commit .env ไปแล้ว! 😱

**แก้ทันที!**

```bash
# 1. ลบออกจาก Git
git rm --cached .env

# 2. Commit การลบ
git commit -m "ลบไฟล์ .env ออกจาก git"

# 3. Push ขึ้น GitHub
git push

# 4. สำคัญ! เปลี่ยนรหัสผ่านทั้งหมดทันที!
# - รหัสผ่าน Database
# - JWT Secret
# - ทุกอย่างที่อยู่ใน .env
```

### ปัญหา: ใส่ Username/Password แล้วไม่ได้

**วิธีแก้:**

1. ตรวจสอบว่าใช้ **Token** ไม่ใช่รหัสผ่านปกติ
2. Token ต้องมี permission "repo"
3. ลองสร้าง Token ใหม่

### ปัญหา: Repository not found

**วิธีแก้:**

```bash
# ตรวจสอบ URL
git remote -v

# ถ้าผิด แก้ไข
git remote set-url origin https://github.com/[username-ที่ถูก]/rim-system.git
```

### ปัญหา: node_modules/ ถูก commit

**วิธีแก้:**

```bash
# 1. ลบออกจาก Git
git rm -r --cached node_modules/

# 2. ตรวจสอบว่า .gitignore มี node_modules/
notepad .gitignore
# ต้องมีบรรทัด: node_modules/

# 3. Commit การลบ
git commit -m "ลบ node_modules ออกจาก git"

# 4. Push
git push
```

---

## ⚠️ ข้อควรระวัง

### อย่า Commit สิ่งเหล่านี้! 🚨

```
❌ .env                    (มีรหัสผ่าน!)
❌ node_modules/           (ไฟล์เยอะมาก)
❌ dist/                   (ไฟล์ build)
❌ *.log                   (ไฟล์ log)
❌ รหัสผ่านใดๆ             (อันตราย!)
❌ API keys                (อันตราย!)
❌ Database credentials    (อันตราย!)
```

### ควร Commit สิ่งเหล่านี้: ✅

```
✅ src/                    (โค้ด)
✅ prisma/schema.prisma    (โครงสร้างฐานข้อมูล)
✅ package.json            (รายการ package)
✅ README.md               (เอกสาร)
✅ .gitignore              (กฎป้องกัน)
✅ .env.example            (ตัวอย่าง - ไม่มีรหัสจริง)
```

---

## 📚 เอกสารเพิ่มเติม

### ไฟล์อื่นๆ ที่มี (อ่านเพิ่มเติม):

```
1. GITHUB-SETUP-GUIDE.md        (คู่มือแบบละเอียด)
2. GIT-QUICK-COMMANDS.md        (คำสั่งเร็ว)
3. PRE-COMMIT-CHECKLIST.md      (เช็คก่อน commit)
4. GITHUB-BACKUP-SUMMARY.md     (สรุปรวม)
```

---

## ✅ เช็คลิสต์ก่อน Commit

### ทุกครั้งก่อน Commit:

```
□ git status (ดูว่ามีอะไรเปลี่ยน)
□ git diff (ดูว่าเปลี่ยนอะไร)
□ .env ไม่อยู่ในรายการ ✅
□ ไม่มีรหัสผ่านในโค้ด ✅
□ โค้ด compile ผ่าน ✅
□ ข้อความ commit ชัดเจน ✅
```

### ทุกครั้งก่อน Push:

```
□ git pull ก่อน (ดึงข้อมูลล่าสุด)
□ แก้ conflict ถ้ามี
□ ทดสอบว่าโค้ดยังทำงานได้
□ Commit message ชัดเจน
□ git push
```

---

## 🎯 สรุปคำสั่งหลัก

### ติดตั้งครั้งแรก:
```bash
cd D:\Projects\RIM-System\backend
git init
git config --global user.name "ชื่อคุณ"
git config --global user.email "email@example.com"
git add .
git commit -m "เริ่มต้นโปรเจค"
git remote add origin https://github.com/[username]/rim-system.git
git push -u origin main
```

### ใช้งานประจำ:
```bash
git status          # ดูสถานะ
git add .           # เพิ่มไฟล์
git commit -m "..."  # Commit
git push            # อัพโหลด
```

### ดึงข้อมูลล่าสุด:
```bash
git pull
```

---

## 💡 เคล็ดลับ

### 1. Commit บ่อยๆ
- ทำงานเสร็จแต่ละส่วน ก็ commit
- Commit เล็กๆ ดีกว่า commit ใหญ่

### 2. ตรวจสอบก่อน Commit
- ใช้ `git status` ดูไฟล์
- ใช้ `git diff` ดูการเปลี่ยนแปลง

### 3. ข้อความ Commit ชัดเจน
- บอกว่าทำอะไร
- ทำไมถึงทำ
- อ่านแล้วเข้าใจ

### 4. Pull ก่อน Push
- git pull (ดึงข้อมูลล่าสุดก่อน)
- แก้ conflict ถ้ามี
- แล้วค่อย git push

---

## 🎊 สำเร็จ!

### หลังจากทำตามคู่มือนี้:

✅ โปรเจค backup ขึ้น GitHub แล้ว  
✅ ไฟล์ .env ปลอดภัย (ไม่ถูกอัพโหลด)  
✅ มีเอกสารครบถ้วน  
✅ พร้อมทำงานต่อ  
✅ ข้อมูลไม่สูญหาย  

### ขั้นต่อไป:

1. Commit ทุกวันที่ทำงาน
2. Push ขึ้น GitHub เป็นประจำ
3. เขียนข้อความ Commit ให้ดี
4. ดูแล .env อย่าให้ถูก commit!

---

## 📞 ต้องการความช่วยเหลือ?

### อ่านเพิ่ม:
- คู่มือนี้ (คู่มือภาษาไทย)
- GITHUB-SETUP-GUIDE.md (คู่มือภาษาอังกฤษ ละเอียดกว่า)
- GIT-QUICK-COMMANDS.md (คำสั่งเร็ว)

### ค้นหาออนไลน์:
- Google: "git [ปัญหา] ภาษาไทย"
- YouTube: "สอน git ภาษาไทย"

---

**คู่มือนี้สร้างเพื่อ:** โปรเจค RIM System  
**เวอร์ชั่น:** 1.0 ภาษาไทย  
**วันที่:** 25 ธันวาคม 2568  
**สถานะ:** พร้อมใช้งาน ✅

---

**ขอให้ประสบความสำเร็จกับการใช้ Git และ GitHub!** 🚀

**จำไว้:**
- ❌ อย่า commit .env
- ✅ ใช้ .gitignore เสมอ
- ✅ Commit บ่อยๆ
- ✅ เขียนข้อความชัดเจน

😊✨🇹🇭

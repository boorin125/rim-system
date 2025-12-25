# ⚡ คำสั่ง Git ที่ใช้บ่อย - ภาษาไทย

**อ้างอิงเร็วสำหรับใช้งานประจำวัน**

---

## 🚀 เริ่มต้นครั้งแรก (ทำครั้งเดียว)

```bash
# 1. ไปที่โฟลเดอร์โปรเจค
cd D:\Projects\RIM-System\backend

# 2. คัดลอกไฟล์สำคัญ
copy [downloads]\.gitignore .
copy [downloads]\README.md .
copy [downloads]\.env.example .

# 3. เริ่มต้น Git
git init

# 4. ตั้งค่าข้อมูล
git config --global user.name "ชื่อคุณ"
git config --global user.email "email@example.com"

# 5. เพิ่มไฟล์ทั้งหมด
git add .

# 6. Commit ครั้งแรก
git commit -m "เริ่มต้นโปรเจค RIM System"

# 7. เชื่อมกับ GitHub
git remote add origin https://github.com/[username]/rim-system.git

# 8. อัพโหลด
git push -u origin main
```

---

## 📅 ใช้งานประจำวัน (3 คำสั่งหลัก!)

```bash
# เพิ่มไฟล์
git add .

# Commit พร้อมข้อความ
git commit -m "อธิบายว่าทำอะไร"

# อัพโหลดขึ้น GitHub
git push
```

**แค่นี้! ใช้ทุกวัน** ✅

---

## 🔍 ตรวจสอบสถานะ

```bash
git status              # ดูว่ามีอะไรเปลี่ยน
git log                 # ดู commit ย้อนหลัง
git log --oneline       # ดู commit แบบสั้น
git diff                # ดูว่าแก้อะไรบ้าง
git ls-files            # ดูไฟล์ที่ถูกติดตาม
```

---

## ➕ เพิ่มไฟล์

```bash
git add .                   # เพิ่มทุกไฟล์
git add [ชื่อไฟล์]           # เพิ่มไฟล์เฉพาะ
git add src/                # เพิ่มทั้งโฟลเดอร์
git add *.ts                # เพิ่มไฟล์ .ts ทั้งหมด
```

---

## 💾 Commit

```bash
# Commit ธรรมดา
git commit -m "ข้อความ"

# Commit พร้อมรายละเอียด
git commit -m "เพิ่มฟีเจอร์ X" -m "- รายละเอียด 1
- รายละเอียด 2"

# แก้ไข commit ล่าสุด
git commit --amend
```

---

## 🔄 ดึง/ส่ง ข้อมูล

```bash
git pull                # ดึงข้อมูลล่าสุดจาก GitHub
git fetch               # ดึงแต่ไม่รวม
git push                # ส่งขึ้น GitHub
git push -u origin main # ครั้งแรก
```

---

## ↩️ ยกเลิกการเปลี่ยนแปลง

```bash
# ยกเลิกการเปลี่ยนไฟล์
git restore [ชื่อไฟล์]

# ยกเลิก commit ล่าสุด (เก็บการเปลี่ยนแปลง)
git reset HEAD~1

# ยกเลิก commit ล่าสุด (ลบการเปลี่ยนแปลง) ⚠️
git reset --hard HEAD~1

# ยกเลิกไฟล์เฉพาะ
git checkout HEAD [ชื่อไฟล์]
```

---

## 🗑️ ลบไฟล์

```bash
# ลบจาก Git และเครื่อง
git rm [ชื่อไฟล์]

# ลบจาก Git เท่านั้น (เก็บไฟล์ไว้)
git rm --cached [ชื่อไฟล์]

# สำคัญ! ลบ .env ที่ commit ไปแล้ว
git rm --cached .env
git commit -m "ลบไฟล์ .env"
git push
```

---

## 🌿 Branch (สาขา)

```bash
# ดู branch ทั้งหมด
git branch

# สร้าง branch ใหม่
git branch [ชื่อ]

# สลับ branch
git checkout [ชื่อ]

# สร้างและสลับพร้อมกัน
git checkout -b [ชื่อ]

# ลบ branch
git branch -d [ชื่อ]

# รวม branch
git checkout main
git merge [ชื่อ-branch]
```

---

## 🌐 Remote (GitHub)

```bash
# ดู remote ทั้งหมด
git remote -v

# เพิ่ม remote
git remote add origin [url]

# เปลี่ยน URL
git remote set-url origin [url-ใหม่]

# ลบ remote
git remote remove origin
```

---

## 🚨 แก้เหตุฉุกเฉิน

```bash
# ลบ .env ที่ commit ไปแล้ว
git rm --cached .env
git commit -m "ลบ .env"
git push
# ⚠️ แล้วเปลี่ยนรหัสผ่านทั้งหมดทันที!

# ยกเลิก push ล่าสุด (อันตราย!)
git reset --hard HEAD~1
git push -f  # ⚠️ ใช้เฉพาะ branch ของตัวเอง!

# เก็บงานไว้ก่อน
git stash           # เก็บ
git stash pop       # เอากลับมา

# ยกเลิกทุกอย่างในเครื่อง
git reset --hard HEAD  # ⚠️ ระวัง! คืนไม่ได้!
```

---

## 📝 ข้อความ Commit แบบไทย

### ประเภท:
```
feat:     เพิ่มฟีเจอร์
fix:      แก้บัค
docs:     แก้เอกสาร
style:    จัดรูปแบบโค้ด
refactor: ปรับโครงสร้าง
test:     เพิ่มการทดสอบ
chore:    งานบำรุงรักษา
```

### ตัวอย่าง:
```bash
git commit -m "feat: เพิ่มระบบ login"
git commit -m "fix: แก้ปัญหาไม่สามารถ login ได้"
git commit -m "docs: อัพเดทคู่มือการใช้งาน"
```

---

## 📋 สถานการณ์จริง

### สถานการณ์ที่ 1: ทำงานทุกวัน
```bash
# เช้า
git pull

# ทำงานทั้งวัน...

# เย็น
git add .
git commit -m "งานวันนี้"
git push
```

### สถานการณ์ที่ 2: แก้บัค
```bash
git checkout -b fix/แก้-bug-xxx
# แก้บัค...
git add .
git commit -m "fix: แก้ปัญหา xxx"
git push origin fix/แก้-bug-xxx
# สร้าง Pull Request บน GitHub
```

### สถานการณ์ที่ 3: Commit .env ไปแล้ว! 😱
```bash
git rm --cached .env
git commit -m "ลบ .env"
git push
# เปลี่ยนรหัสผ่านทุกอันทันที!
```

### สถานการณ์ที่ 4: Conflict
```bash
git pull  # เกิด Conflict!
# เปิดไฟล์ที่ขัดแย้ง
# แก้ไข (ลบ <<<<<<< ======= >>>>>>> ออก)
git add .
git commit -m "แก้ไข conflict"
git push
```

---

## ⚠️ ห้ามทำ

```bash
❌ git add .env
❌ commit รหัสผ่าน
❌ git push -f (บน branch หลัก)
❌ git reset --hard (โดยไม่มี backup)
❌ commit ไฟล์ใหญ่ >100MB
❌ commit node_modules/
```

---

## ✅ ควรทำ

```bash
✅ git status ก่อน commit
✅ เขียนข้อความชัดเจน
✅ git pull ก่อน push
✅ ใช้ .gitignore
✅ backup งานสำคัญ
✅ ตรวจสอบก่อน commit
```

---

## 🔑 GitHub Token

### สร้าง Token:
```
1. GitHub.com → Settings
2. Developer settings
3. Personal access tokens → Tokens (classic)
4. Generate new token
5. ติ๊ก "repo"
6. คัดลอก Token
```

### ใช้ Token:
```bash
# เมื่อ push
Username: [ชื่อผู้ใช้ GitHub]
Password: [วาง Token]

# บันทึกไว้ (ไม่ต้องใส่ซ้ำ)
git config --global credential.helper store
```

---

## ⚙️ ตั้งค่า Git

```bash
# ตั้งชื่อ
git config --global user.name "ชื่อคุณ"

# ตั้ง Email
git config --global user.email "email@example.com"

# ตั้ง Editor
git config --global core.editor "notepad"

# ตั้ง branch เริ่มต้น
git config --global init.defaultBranch main

# ดูการตั้งค่า
git config --list
```

---

## 💡 Shortcuts (ทางลัด)

```bash
# สร้างทางลัด
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.pl pull
git config --global alias.ps push

# ใช้งาน
git st      # = git status
git co main # = git checkout main
git pl      # = git pull
git ps      # = git push
```

---

## 🔍 ตรวจสอบก่อน Commit

```bash
# 1. ดูว่ามีอะไรเปลี่ยน
git status

# 2. ดูรายละเอียดการเปลี่ยน
git diff

# 3. ตรวจสอบ .env
git status | findstr .env
# ต้องไม่เจอ! ✅

# 4. ดูว่าจะ commit อะไร
git diff --staged

# 5. ถูกต้อง? Commit เลย!
git commit -m "ข้อความ"
```

---

## 📱 เช็คลิสต์ก่อน Commit

```
ก่อน Commit ทุกครั้ง:
□ git status
□ git diff
□ ไม่มี .env
□ ไม่มีรหัสผ่าน
□ โค้ด compile ผ่าน
□ ข้อความชัดเจน

ก่อน Push ทุกครั้ง:
□ git pull ก่อน
□ แก้ conflict
□ test ผ่าน
□ Commit ถูกต้อง
```

---

## 🎓 เรียนรู้เพิ่ม

```bash
# ดูความช่วยเหลือ
git help [คำสั่ง]
git [คำสั่ง] --help

# ตัวอย่าง
git help commit
git status --help
```

---

## 💡 เทคนิคพิเศษ

### 1. ดู Log แบบสวย
```bash
git log --oneline --graph --all
```

### 2. ค้นหาใน History
```bash
git log --grep="keyword"
git log --author="ชื่อ"
```

### 3. ดูใครแก้อะไร
```bash
git blame [ชื่อไฟล์]
```

### 4. แสดงการเปลี่ยนของ Commit
```bash
git show [commit-hash]
```

---

## 🚀 คำสั่งเฉพาะ RIM System

### Backup ครั้งแรก:
```bash
cd D:\Projects\RIM-System\backend
git init
git add .
git commit -m "เริ่มต้นโปรเจค RIM System

- มี API 48 endpoints
- ทดสอบแล้ว 29/29 ผ่าน
- พร้อมใช้งาน"
git remote add origin https://github.com/[user]/rim-system.git
git push -u origin main
```

### อัพเดทประจำ:
```bash
git add .
git commit -m "feat: [ทำอะไรวันนี้]"
git push
```

---

## 🎯 คำสั่งที่ใช้บ่อย 90%

```bash
git status      # ดูสถานะ
git add .       # เพิ่มไฟล์
git commit -m "..." # Commit
git push        # อัพโหลด
git pull        # ดึงข้อมูล
```

**5 คำสั่งนี้ใช้ทุกวัน!** ✅

---

## 📞 ต้องการความช่วยเหลือ?

### คู่มือ:
- GITHUB-GUIDE-TH.md (คู่มือเต็ม ภาษาไทย)
- GITHUB-SETUP-GUIDE.md (คู่มือภาษาอังกฤษ)

### ออนไลน์:
- Google: "git [คำถาม] ภาษาไทย"
- YouTube: "สอน git ภาษาไทย"

---

**เก็บไฟล์นี้ไว้อ้างอิง!** 📌

**คำสั่งที่ใช้บ่อยสุด:**
```bash
git status
git add .
git commit -m "ข้อความ"
git push
```

**แค่นี้ก็พอใช้ 90% แล้ว!** ✅

---

**สร้างเมื่อ:** 25 ธันวาคม 2568  
**เวอร์ชั่น:** 1.0 ภาษาไทย  
**สำหรับ:** โปรเจค RIM System

🇹🇭 ✨

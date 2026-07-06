# RIM System v1.0.19 — Release Notes

**Release Date:** 2026-07-06  
**Git Commit:** 0b2ca09

---

## New Features

### Outsource — Pay Button Validation
- ปุ่ม **จ่ายเงิน** แสดงสีเขียวเมื่อเงื่อนไขครบ (สีเทาเมื่อยังขาด)
- กดปุ่มขณะเงื่อนไขไม่ครบ → Popup แจ้งสิ่งที่ยังขาด:
  1. งานยังไม่ปิด (Incident ต้องถูก Resolve ก่อน)
  2. ยังไม่ได้ยืนยันรับ Spare Parts คืน
  3. ยังไม่ได้ยืนยันตรวจสอบเอกสาร
- Backend ป้องกัน bypass ผ่าน API ด้วยเงื่อนไขเดียวกัน

### Incident List — เพิ่ม Filter Status
- เพิ่มตัวกรอง **Open**, **Assigned**, **In Progress**
- **Pending** = ทุกสถานะยกเว้น Closed และ Cancelled

### Report — Technician Detail (ปรับใหม่ทั้งหมด)
- คอลัมน์ **Assigned** — งานที่ถูก Assign ในวันนั้น
- คอลัมน์ **Carry Over** — งานค้างสะสมจากก่อนวันนั้น
- คอลัมน์ **Total Jobs** = Carry Over + Assigned
- คอลัมน์ **Closed** — งานที่ปิดในวันนั้น (by resolvedAt)
- **แสดงทุกวัน** ในช่วงที่เลือก แม้วันที่ไม่มี Check-in
- Summary cards: Assigned (period), Avg Assigned/Day, Closed (period), Pending (now)

### Incident — Helpdesk แก้ไข Spare Parts ตอน Confirm Close
- ใน Confirm Close Modal มีปุ่ม **"แก้ไข Spare Parts"** (toggle)
- แก้ไข/เพิ่ม/ลบได้ทั้ง Equipment Replacement และ Component Replacement
- ถ้าไม่แก้ไข → ข้อมูลเดิมถูกใช้ตามปกติ (ไม่ยุ่งกับ DB)
- ลด Reject กลับไปกลับมากรณีช่างใส่ข้อมูลตกหล่น

---

## Bug Fixes (included from v1.0.18 hotfix)

- fix(outsource): Status badge ใน Detail page ใช้ `getDisplayStatus()` ตรงกับ List
- fix(outsource): ค้นหาช่างด้วยชื่อ-นามสกุลรวมกัน
- fix(backup): Differential backup ไม่รวม uploads directory (ลดขนาดไฟล์จาก ~2GB เหลือ ~50MB)

---

## Database Changes

ไม่มี Schema เปลี่ยนแปลงใน v1.0.19

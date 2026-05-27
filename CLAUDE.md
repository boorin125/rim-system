# RIM-System — Claude Instructions

## ⚠️ MANDATORY: อ่าน Memory ทุกครั้งที่เริ่ม session หรือหลัง compaction

**ต้องอ่านไฟล์เหล่านี้ก่อนทำงานใดๆ เสมอ** โดยเฉพาะหลัง context compaction:

```
C:\Users\Administrator\.claude\projects\d--Projects-RIM-System\memory\MEMORY.md
C:\Users\Administrator\.claude\projects\d--Projects-RIM-System\memory\project_docker_hub.md
C:\Users\Administrator\.claude\projects\d--Projects-RIM-System\memory\project_install_issues.md
```

**สาเหตุ:** Memory มี critical rules ที่ถ้าไม่อ่านจะทำให้เกิด bug ซ้ำ เช่น:
- `NEXT_PUBLIC_API_URL=/api` ต้องใส่ใน build command ทุกครั้ง (ห้าม RUNTIME_PLACEHOLDER)
- XT Server ใช้ pinned tag ไม่มี `v` prefix
- DB schema changes ต้องอัพเดต deploy_db_setup.md

## Project Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: NestJS, Prisma ORM, PostgreSQL
- **Docker**: rubjobb/rim-frontend, rubjobb/rim-backend (Docker Hub)

## Build Commands (อ่าน project_docker_hub.md สำหรับ command เต็ม)
```powershell
# Frontend — ต้องใช้ --build-arg NEXT_PUBLIC_API_URL=/api เสมอ
cd D:\Projects\RIM-System; $v="X.X.X"; docker buildx build --no-cache --platform linux/amd64 --build-arg NEXT_PUBLIC_API_URL=/api -t rubjobb/rim-frontend:$v -t rubjobb/rim-frontend:latest --push ./frontend
```

/*
  Warnings:

  - The values [DESKTOP,LAPTOP,SCANNER] on the enum `EquipmentCategory` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[incident_code]` on the table `incidents` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `incident_code` to the `incidents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reported_by` to the `incidents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EquipmentLogAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'TRANSFERRED', 'RETIRED', 'WARRANTY_UPDATED', 'MAINTENANCE_SCHEDULED', 'MAINTENANCE_COMPLETED');

-- AlterEnum
BEGIN;
CREATE TYPE "EquipmentCategory_new" AS ENUM ('NETWORK', 'COMPUTER', 'POS', 'PRINTER', 'ROUTER', 'SWITCH', 'CCTV', 'OTHER');
ALTER TABLE "equipment" ALTER COLUMN "category" TYPE "EquipmentCategory_new" USING ("category"::text::"EquipmentCategory_new");
ALTER TYPE "EquipmentCategory" RENAME TO "EquipmentCategory_old";
ALTER TYPE "EquipmentCategory_new" RENAME TO "EquipmentCategory";
DROP TYPE "public"."EquipmentCategory_old";
COMMIT;

-- AlterEnum
ALTER TYPE "IncidentStatus" ADD VALUE 'ASSIGNED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'FINANCE_ADMIN';

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "category" TEXT,
ADD COLUMN     "incident_code" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reported_by" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "holiday_close" TEXT,
ADD COLUMN     "holiday_open" TEXT,
ALTER COLUMN "province" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "equipment_logs" (
    "id" SERIAL NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "action" "EquipmentLogAction" NOT NULL,
    "description" TEXT NOT NULL,
    "changed_by" INTEGER NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_logs_equipment_id_idx" ON "equipment_logs"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_logs_changed_by_idx" ON "equipment_logs"("changed_by");

-- CreateIndex
CREATE INDEX "equipment_logs_created_at_idx" ON "equipment_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_incident_code_key" ON "incidents"("incident_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "equipment_logs" ADD CONSTRAINT "equipment_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_logs" ADD CONSTRAINT "equipment_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

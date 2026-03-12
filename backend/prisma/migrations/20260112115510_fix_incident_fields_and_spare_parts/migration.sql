/*
  Warnings:

  - You are about to drop the column `afterPhotos` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `beforePhotos` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `checkInAt` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `confirmedAt` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `confirmedById` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `jobType` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedById` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the column `usedSpareParts` on the `incidents` table. All the data in the column will be lost.
  - You are about to drop the `SpareParts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SpareParts" DROP CONSTRAINT "SpareParts_incidentId_fkey";

-- DropForeignKey
ALTER TABLE "incidents" DROP CONSTRAINT "incidents_confirmedById_fkey";

-- DropForeignKey
ALTER TABLE "incidents" DROP CONSTRAINT "incidents_resolvedById_fkey";

-- AlterTable
ALTER TABLE "incidents" DROP COLUMN "afterPhotos",
DROP COLUMN "beforePhotos",
DROP COLUMN "checkInAt",
DROP COLUMN "confirmedAt",
DROP COLUMN "confirmedById",
DROP COLUMN "jobType",
DROP COLUMN "resolvedById",
DROP COLUMN "usedSpareParts",
ADD COLUMN     "after_photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "before_photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "check_in_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_by_id" INTEGER,
ADD COLUMN     "job_type" TEXT,
ADD COLUMN     "resolved_by_id" INTEGER,
ADD COLUMN     "used_spare_parts" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "SpareParts";

-- CreateTable
CREATE TABLE "spare_parts" (
    "id" SERIAL NOT NULL,
    "incident_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "old_serial_no" TEXT NOT NULL,
    "new_serial_no" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spare_parts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

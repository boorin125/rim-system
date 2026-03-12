/*
  Warnings:

  - You are about to drop the column `is_popup` on the `stores` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[store_code,store_status]` on the table `stores` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('PERMANENT', 'POP_UP', 'SEASONAL');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropIndex
DROP INDEX "stores_store_code_key";

-- AlterTable
ALTER TABLE "stores" DROP COLUMN "is_popup",
ADD COLUMN     "area" TEXT,
ADD COLUMN     "close_date" TIMESTAMP(3),
ADD COLUMN     "company" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "google_map_link" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "open_date" TIMESTAMP(3),
ADD COLUMN     "store_status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "store_type" "StoreType" NOT NULL DEFAULT 'PERMANENT';

-- CreateIndex
CREATE INDEX "stores_store_code_idx" ON "stores"("store_code");

-- CreateIndex
CREATE INDEX "stores_company_idx" ON "stores"("company");

-- CreateIndex
CREATE INDEX "stores_store_status_idx" ON "stores"("store_status");

-- CreateIndex
CREATE INDEX "stores_province_idx" ON "stores"("province");

-- CreateIndex
CREATE UNIQUE INDEX "stores_store_code_store_status_key" ON "stores"("store_code", "store_status");

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "afterPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "beforePhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "checkInAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" INTEGER,
ADD COLUMN     "resolvedById" INTEGER,
ADD COLUMN     "usedSpareParts" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SpareParts" (
    "id" SERIAL NOT NULL,
    "incidentId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "oldSerialNo" TEXT NOT NULL,
    "newSerialNo" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpareParts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareParts" ADD CONSTRAINT "SpareParts_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

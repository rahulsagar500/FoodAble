-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "Restaurant_ownerUserId_idx" ON "Restaurant"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the `CustomerAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OwnerAccount` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `ownerUserId` on table `Restaurant` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."CustomerAccount" DROP CONSTRAINT "CustomerAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OwnerAccount" DROP CONSTRAINT "OwnerAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Restaurant" DROP CONSTRAINT "Restaurant_ownerUserId_fkey";

-- AlterTable
ALTER TABLE "Restaurant" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- DropTable
DROP TABLE "public"."CustomerAccount";

-- DropTable
DROP TABLE "public"."OwnerAccount";

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

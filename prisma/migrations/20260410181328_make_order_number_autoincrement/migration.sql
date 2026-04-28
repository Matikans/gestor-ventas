/*
  Warnings:

  - You are about to drop the column `orderNumer` on the `Order` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Order_orderNumer_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "orderNumer",
ADD COLUMN     "orderNumber" SERIAL NOT NULL;

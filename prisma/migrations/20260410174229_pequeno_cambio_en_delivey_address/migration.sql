-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "deliveryAddress" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "deliveryAddress" DROP NOT NULL;

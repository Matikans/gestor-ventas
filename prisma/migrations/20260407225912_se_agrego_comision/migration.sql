-- AlterTable
ALTER TABLE "ApiConfig" ADD COLUMN     "mpUserId" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ALTER COLUMN "paymentPrivateKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "commissionAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "commissionPorcent" DECIMAL(10,2) NOT NULL DEFAULT 1.00;

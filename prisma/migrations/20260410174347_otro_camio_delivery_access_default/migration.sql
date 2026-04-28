/*
  Warnings:

  - Made the column `deliveryAddress` on table `Session` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "deliveryAddress" SET NOT NULL,
ALTER COLUMN "deliveryAddress" SET DEFAULT '';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hoursEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastEarningStart" TIMESTAMP;

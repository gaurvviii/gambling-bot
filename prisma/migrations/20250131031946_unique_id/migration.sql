/*
  Warnings:

  - The primary key for the `Lottery` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `Lottery` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(5)`.
  - The primary key for the `LotteryTicket` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `LotteryTicket` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(5)`.
  - Made the column `main` on table `Lottery` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "LotteryTicket" DROP CONSTRAINT "LotteryTicket_lotteryId_fkey";

-- AlterTable
ALTER TABLE "Lottery" DROP CONSTRAINT "Lottery_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(5),
ALTER COLUMN "main" SET NOT NULL,
ADD CONSTRAINT "Lottery_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "LotteryTicket" DROP CONSTRAINT "LotteryTicket_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(5),
ADD CONSTRAINT "LotteryTicket_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "LotteryTicket" ADD CONSTRAINT "LotteryTicket_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

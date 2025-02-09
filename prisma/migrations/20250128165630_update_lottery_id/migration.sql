/*
  Warnings:

  - The primary key for the `Lottery` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `Lottery` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(5)`.
  - The primary key for the `LotteryTicket` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `LotteryTicket` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(5)`.

*/
-- Step 1: Drop foreign key constraints
ALTER TABLE "LotteryTicket" DROP CONSTRAINT "LotteryTicket_lotteryId_fkey";

-- Step 2: Add the 'main' column (if it does not exist)
ALTER TABLE "Lottery" ADD COLUMN "main" INT UNIQUE DEFAULT 1;

-- Step 3: Re-add the foreign key constraint to `LotteryTicket`
ALTER TABLE "LotteryTicket" ADD CONSTRAINT "LotteryTicket_lotteryId_fkey"
FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE CASCADE;



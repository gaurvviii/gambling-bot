/*
  Warnings:

  - You are about to drop the column `main` on the `Lottery` table. All the data in the column will be lost.

*/

-- Drop existing constraint
ALTER TABLE "Lottery" DROP CONSTRAINT IF EXISTS "Lottery_main_key";

-- Recreate the constraint
ALTER TABLE "Lottery" ADD CONSTRAINT "Lottery_main_key" UNIQUE ("main");

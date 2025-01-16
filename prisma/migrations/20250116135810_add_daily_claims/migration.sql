-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "balance" INTEGER NOT NULL DEFAULT 1000,
    "bank" INTEGER NOT NULL DEFAULT 0,
    "wallet" INTEGER NOT NULL DEFAULT 0,
    "totalWon" INTEGER NOT NULL DEFAULT 0,
    "totalLost" INTEGER NOT NULL DEFAULT 0,
    "lastDaily" DATETIME,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastSalary" DATETIME,
    "dailyClaims" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "claimsMade" INTEGER NOT NULL DEFAULT 0,
    "lastClaimDate" DATETIME
);

-- CreateTable
CREATE TABLE "Lottery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prize" INTEGER NOT NULL,
    "ticketPrice" INTEGER NOT NULL,
    "endTime" DATETIME NOT NULL,
    "winner" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "LotteryTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotteryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "LotteryTicket_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LotteryTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

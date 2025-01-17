-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 1000,
    "bank" INTEGER NOT NULL DEFAULT 0,
    "wallet" INTEGER NOT NULL DEFAULT 0,
    "wantsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "totalWon" INTEGER NOT NULL DEFAULT 0,
    "totalLost" INTEGER NOT NULL DEFAULT 0,
    "lastSalaryClaim" TIMESTAMP,
    "claimsMade" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'Member',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lottery" (
    "id" TEXT NOT NULL,
    "prize" INTEGER NOT NULL,
    "ticketPrice" INTEGER NOT NULL,
    "endTime" TIMESTAMP NOT NULL,
    "winner" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Lottery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryTicket" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LotteryTicket_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LotteryTicket" ADD CONSTRAINT "LotteryTicket_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryTicket" ADD CONSTRAINT "LotteryTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

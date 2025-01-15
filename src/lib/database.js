import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function getUser(userId) {
  let user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    user = await prisma.user.create({
      data: { id: userId }
    });
  }

  return user;
}

export async function updateBalance(userId, amount) {
  return prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: amount } }
  });
} 
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
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
    });

    console.log(`Balance updated successfully for user ${userId}:`, updatedUser);
    return updatedUser;
  } catch (error) {
    console.error(`Error updating balance for user ${userId}:`, error);
    throw error; 
}
}
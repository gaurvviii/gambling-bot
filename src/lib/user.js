import { prisma } from './database.js'; 

export async function getUser(userID) {
  return await prisma.user.findUnique({
    where: { id: userID }
  });
} 
import { Task } from '@sapphire/framework';
import { PrismaClient } from '@prisma/client';
import { SALARY_RATES, WORK_HOURS } from '../lib/constants';
const prisma = new PrismaClient();
export class SalaryDistributionTask extends Task {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'salaryDistribution',
            interval: 1000 * 60 * 60 // Run every hour
        });
    }
    async run() {
        const users = await prisma.user.findMany({
            where: {
                lastSalary: {
                    lt: new Date(Date.now() - 1000 * 60 * 60) // Last salary more than 1 hour ago
                }
            }
        });
        for (const user of users) {
            const hourlyRate = SALARY_RATES[user.role];
            const salary = hourlyRate * WORK_HOURS;
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    bank: { increment: salary },
                    lastSalary: new Date()
                }
            });
        }
    }
}

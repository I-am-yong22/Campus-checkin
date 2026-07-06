import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const date = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const r = await prisma.checkIn.deleteMany({ where: { date } });
console.log(`已删除今日(${date})签到记录: ${r.count} 条（人脸记录保留）`);
await prisma.$disconnect();

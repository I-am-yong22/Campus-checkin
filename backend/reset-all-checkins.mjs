import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const r = await prisma.checkIn.deleteMany({});
console.log(`已清空全部签到记录: ${r.count} 条（人脸数据保留）`);
await prisma.$disconnect();

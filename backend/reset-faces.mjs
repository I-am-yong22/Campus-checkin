import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const deleted = await prisma.faceProfile.deleteMany();
const users = await prisma.user.updateMany({
  data: { faceRegistered: false, seat: null },
});

console.log(`已删除人脸特征记录: ${deleted.count} 条`);
console.log(`已重置用户录脸状态与座位: ${users.count} 人（faceRegistered=false, seat=null）`);

await prisma.$disconnect();

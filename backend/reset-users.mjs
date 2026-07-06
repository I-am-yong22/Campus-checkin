/**
 * 清空 User 表（解除外键引用后删除全部用户）
 * 用法：node reset-users.mjs
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.attendanceTask.updateMany({ data: { publishedById: null } });
  await prisma.teamCreationRequest.updateMany({ data: { reviewerId: null } });
  await prisma.leaveRequest.updateMany({ data: { reviewerId: null } });
  await prisma.auditLog.updateMany({ data: { userId: null } });
  const { count } = await prisma.user.deleteMany({});
  console.log(`已清空 User 表，删除 ${count} 条记录`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

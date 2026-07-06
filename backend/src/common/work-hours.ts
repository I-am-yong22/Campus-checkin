import { CheckIn, Role } from '@prisma/client';

/** 非管理员查看他人签到时，隐藏签退与工时字段 */
export function maskCheckInWorkHours(
  checkIn: CheckIn | null,
  memberUserId: number,
  viewer: { id: number; role: Role },
): CheckIn | null {
  if (!checkIn) return null;
  if (viewer.role === Role.ADMIN || memberUserId === viewer.id) return checkIn;
  return {
    ...checkIn,
    checkOutAt: null,
    checkOutScore: null,
    checkOutType: null,
    workMinutes: null,
  };
}

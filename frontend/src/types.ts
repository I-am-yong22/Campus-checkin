export type Role = 'USER' | 'LEADER' | 'ADMIN';

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  phone?: string | null;
  teamId?: number | null;
  team?: Team | null;
  mustChangePassword: boolean;
  faceRegistered: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Team {
  id: number;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export type CheckInStatus = 'NORMAL' | 'LATE' | 'MAKEUP';

export type CheckOutType = 'MANUAL' | 'AUTO' | 'MAKEUP';

export interface CheckIn {
  id: number;
  userId: number;
  date: string;
  checkInAt: string;
  matchScore: number;
  livenessPassed: boolean;
  status: CheckInStatus;
  remark?: string | null;
  checkOutAt?: string | null;
  checkOutScore?: number | null;
  checkOutType?: CheckOutType | null;
  workMinutes?: number | null;
  user?: User;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LeaveReviewTarget = 'LEADER' | 'ADMIN';

export interface LeaveRequest {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  reviewTarget: LeaveReviewTarget;
  status: LeaveStatus;
  reviewerId?: number | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  user?: User;
  reviewer?: User;
}

-- AlterTable
ALTER TABLE `LeaveRequest` ADD COLUMN `reviewTarget` ENUM('LEADER', 'ADMIN') NOT NULL DEFAULT 'LEADER';

-- CreateIndex
CREATE INDEX `LeaveRequest_reviewTarget_status_idx` ON `LeaveRequest`(`reviewTarget`, `status`);

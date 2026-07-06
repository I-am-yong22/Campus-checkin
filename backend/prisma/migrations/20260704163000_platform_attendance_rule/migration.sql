-- 全平台统一出勤规则：PlatformCheckInRule + AttendanceTask 去 teamId

DELETE FROM `AttendanceTask`;

ALTER TABLE `AttendanceTask` DROP FOREIGN KEY `AttendanceTask_teamId_fkey`;
DROP INDEX `AttendanceTask_teamId_date_key` ON `AttendanceTask`;
DROP INDEX `AttendanceTask_teamId_status_idx` ON `AttendanceTask`;
ALTER TABLE `AttendanceTask` DROP COLUMN `teamId`;

CREATE UNIQUE INDEX `AttendanceTask_date_key` ON `AttendanceTask`(`date`);

CREATE TABLE `PlatformCheckInRule` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `startTime` VARCHAR(191) NOT NULL DEFAULT '08:00',
    `lateTime` VARCHAR(191) NOT NULL DEFAULT '09:00',
    `endTime` VARCHAR(191) NOT NULL DEFAULT '10:00',
    `checkOutStart` VARCHAR(191) NOT NULL DEFAULT '17:00',
    `checkOutEnd` VARCHAR(191) NOT NULL DEFAULT '18:00',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `PlatformCheckInRule` (`id`, `startTime`, `lateTime`, `endTime`, `checkOutStart`, `checkOutEnd`, `enabled`, `updatedAt`)
VALUES (1, '08:00', '09:00', '10:00', '17:00', '18:00', true, CURRENT_TIMESTAMP(3));

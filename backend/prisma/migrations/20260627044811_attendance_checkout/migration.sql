-- AlterTable
ALTER TABLE `CheckIn` ADD COLUMN `checkOutAt` DATETIME(3) NULL,
    ADD COLUMN `checkOutScore` DOUBLE NULL,
    ADD COLUMN `checkOutType` ENUM('MANUAL', 'AUTO', 'MAKEUP') NULL,
    ADD COLUMN `workMinutes` INTEGER NULL;

-- AlterTable
ALTER TABLE `CheckInRule` ADD COLUMN `checkOutEnd` VARCHAR(191) NOT NULL DEFAULT '18:00',
    ADD COLUMN `checkOutStart` VARCHAR(191) NOT NULL DEFAULT '17:00',
    MODIFY `endTime` VARCHAR(191) NOT NULL DEFAULT '10:00';

-- CreateTable
CREATE TABLE `AttendanceTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamId` INTEGER NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `checkInStart` VARCHAR(191) NOT NULL,
    `lateTime` VARCHAR(191) NOT NULL,
    `checkInEnd` VARCHAR(191) NOT NULL,
    `checkOutStart` VARCHAR(191) NOT NULL,
    `checkOutEnd` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `note` TEXT NULL,
    `publishedById` INTEGER NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceTask_teamId_status_idx`(`teamId`, `status`),
    INDEX `AttendanceTask_date_idx`(`date`),
    UNIQUE INDEX `AttendanceTask_teamId_date_key`(`teamId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AttendanceTask` ADD CONSTRAINT `AttendanceTask_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceTask` ADD CONSTRAINT `AttendanceTask_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

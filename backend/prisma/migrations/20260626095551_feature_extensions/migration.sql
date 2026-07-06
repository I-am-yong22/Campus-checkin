-- CreateTable
CREATE TABLE `CalendarExemption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamId` INTEGER NULL,
    `date` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CalendarExemption_date_idx`(`date`),
    UNIQUE INDEX `CalendarExemption_teamId_date_key`(`teamId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KioskHeartbeat` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastCheckInAt` DATETIME(3) NULL,
    `version` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CalendarExemption` ADD CONSTRAINT `CalendarExemption_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

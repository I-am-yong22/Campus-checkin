-- CreateTable
CREATE TABLE `KioskCarouselSlide` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `title` VARCHAR(191) NOT NULL DEFAULT '轮播图',
    `imageUrl` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KioskCountdown` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `targetAt` DATETIME(3) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KioskMissionBoard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `deadlineAt` DATETIME(3) NULL,
    `headline` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KioskMissionBoard_teamId_idx`(`teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KioskMissionGap` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `boardId` INTEGER NOT NULL,
    `deliverable` VARCHAR(191) NOT NULL,
    `assignees` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KioskMissionProgress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `boardId` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `percent` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KioskBirthdayShow` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KioskBirthdayShow_date_idx`(`date`),
    INDEX `KioskBirthdayShow_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KioskMissionBoard` ADD CONSTRAINT `KioskMissionBoard_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KioskMissionGap` ADD CONSTRAINT `KioskMissionGap_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `KioskMissionBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KioskMissionProgress` ADD CONSTRAINT `KioskMissionProgress_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `KioskMissionBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KioskBirthdayShow` ADD CONSTRAINT `KioskBirthdayShow_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `TeamInviteCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamId` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `creatorId` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `disabledAt` DATETIME(3) NULL,

    UNIQUE INDEX `TeamInviteCode_code_key`(`code`),
    INDEX `TeamInviteCode_teamId_status_idx`(`teamId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TeamInviteCode` ADD CONSTRAINT `TeamInviteCode_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamInviteCode` ADD CONSTRAINT `TeamInviteCode_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

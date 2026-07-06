-- CreateTable
CREATE TABLE `TeamCreationRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicantId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `reason` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewerId` INTEGER NULL,
    `reviewComment` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `teamId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TeamCreationRequest_teamId_key`(`teamId`),
    INDEX `TeamCreationRequest_applicantId_idx`(`applicantId`),
    INDEX `TeamCreationRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamInvitation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamId` INTEGER NOT NULL,
    `inviterId` INTEGER NOT NULL,
    `inviteeId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `message` TEXT NULL,
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeamInvitation_inviteeId_status_idx`(`inviteeId`, `status`),
    INDEX `TeamInvitation_teamId_status_idx`(`teamId`, `status`),
    UNIQUE INDEX `TeamInvitation_teamId_inviteeId_key`(`teamId`, `inviteeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TeamCreationRequest` ADD CONSTRAINT `TeamCreationRequest_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamCreationRequest` ADD CONSTRAINT `TeamCreationRequest_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamCreationRequest` ADD CONSTRAINT `TeamCreationRequest_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamInvitation` ADD CONSTRAINT `TeamInvitation_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamInvitation` ADD CONSTRAINT `TeamInvitation_inviterId_fkey` FOREIGN KEY (`inviterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamInvitation` ADD CONSTRAINT `TeamInvitation_inviteeId_fkey` FOREIGN KEY (`inviteeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `TeamMembership` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `teamId` INTEGER NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeamMembership_userId_idx`(`userId`),
    INDEX `TeamMembership_teamId_idx`(`teamId`),
    UNIQUE INDEX `TeamMembership_userId_teamId_key`(`userId`, `teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TeamMembership` ADD CONSTRAINT `TeamMembership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMembership` ADD CONSTRAINT `TeamMembership_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing teamId to memberships
INSERT INTO `TeamMembership` (`userId`, `teamId`, `joinedAt`)
SELECT `id`, `teamId`, NOW(3) FROM `User` WHERE `teamId` IS NOT NULL;

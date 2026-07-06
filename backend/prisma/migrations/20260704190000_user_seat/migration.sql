-- AlterTable
ALTER TABLE `User` ADD COLUMN `seat` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_seat_key` ON `User`(`seat`);

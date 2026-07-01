ALTER TABLE `pairing_sessions` ADD COLUMN `sender_id` text REFERENCES `senders`(`id`);
CREATE INDEX `pairing_sessions_sender_id_idx` ON `pairing_sessions` (`sender_id`);

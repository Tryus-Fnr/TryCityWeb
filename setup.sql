-- ============================================================================
-- TryCityWeb – Datenbank-Setup
-- Auf dem MySQL-Server der Minecraft-Datenbank ausführen.
-- <DATENBANK> und <PASSWORT> ersetzen (Passwort NICHT ins Repo schreiben!).
-- ============================================================================

-- Login-Code-Tabelle (wird auch vom SMPGlobal-Plugin automatisch angelegt)
CREATE TABLE IF NOT EXISTS `smpg_web_login_codes` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `player_name` VARCHAR(16) NOT NULL,
  `player_uuid` VARCHAR(36) NULL DEFAULT NULL,
  `code` VARCHAR(8) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `delivered` TINYINT NOT NULL DEFAULT 0,
  `used` TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_name` (`player_name`),
  INDEX `idx_exp` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- Eigener MySQL-User für die Website:
--  - SELECT auf alles (Statistiken, Preise, Historie)
--  - Schreiben NUR auf die Login-Code-Tabelle
-- ============================================================================
CREATE USER IF NOT EXISTS 'trycity_web'@'localhost' IDENTIFIED BY '<PASSWORT>';

GRANT SELECT ON `<DATENBANK>`.* TO 'trycity_web'@'localhost';
GRANT SELECT, INSERT, UPDATE ON `<DATENBANK>`.`smpg_web_login_codes` TO 'trycity_web'@'localhost';

FLUSH PRIVILEGES;

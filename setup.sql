-- ============================================================================
-- TryCityWeb – Datenbank-Setup
-- Auf dem MySQL-Server der Minecraft-Datenbank ausführen.
-- <DATENBANK> und <PASSWORT> ersetzen (Passwort NICHT ins Repo schreiben!).
--
-- Ausführen:  mysql -u root -p < setup.sql
-- ============================================================================

USE `<DATENBANK>`;

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

-- ============================================================================
-- Mod-Panel: Die SELECT-Berechtigung auf alle Tabellen reicht bereits aus.
-- Mods brauchen nur Lesezugriff auf die folgenden Tabellen:
--   tryus_punishments, tryus_ip_records, tryus_trusts, tryus_bot_actions,
--   friends, tryus_clans, tryus_clan_ranks, tryus_clan_members, tryus_players,
--   tryus_anticheat_flags
--
-- tryus_anticheat_flags wird vom TryusCloudGlobal-Anticheat automatisch angelegt
-- (jeder Flag mit Ping/TPS/Lag-Kontext). Zur Referenz das Schema:
--   CREATE TABLE IF NOT EXISTS tryus_anticheat_flags (
--     id BIGINT NOT NULL AUTO_INCREMENT, uuid VARCHAR(36) NOT NULL, name VARCHAR(16),
--     server VARCHAR(48), check_id VARCHAR(32) NOT NULL, check_name VARCHAR(48),
--     category VARCHAR(24), details VARCHAR(255), ping INT, tps DOUBLE,
--     lagged TINYINT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL,
--     PRIMARY KEY (id), INDEX idx_uuid_time (uuid, created_at)
--   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--
-- LuckPerms-Berechtigung für Mods (ingame vergeben):
--   /lp user <spieler> permission set trycity.webmod true
-- ============================================================================

FLUSH PRIVILEGES;

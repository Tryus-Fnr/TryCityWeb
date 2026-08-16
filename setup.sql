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

-- Neuigkeiten (werden auch vom SMPGlobal-Plugin automatisch angelegt).
-- Geschrieben wird ausschließlich hier im Admin-Bereich der Website; das
-- Plugin liest die Beiträge nur und zeigt sie am Lobby-Anschlagbrett.
CREATE TABLE IF NOT EXISTS `smpg_news` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(24) NOT NULL DEFAULT 'info',
  `title` VARCHAR(128) NOT NULL,
  `summary` VARCHAR(256) NOT NULL DEFAULT '',
  -- Text im ColorUtil-Format (&-Codes, &#RRGGBB, <gradient:…>) + [img:N]
  `body` MEDIUMTEXT NOT NULL,
  -- ANGEZEIGTER Autor – nicht zwingend der Ersteller.
  `author_name` VARCHAR(16) NOT NULL,
  `author_uuid` VARCHAR(36) NULL DEFAULT NULL,
  `published` TINYINT NOT NULL DEFAULT 1,
  `pinned` TINYINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pub` (`published`, `pinned`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bilder eines Beitrags, base64-kodiert. Ingame werden sie nicht gerendert –
-- dort steht nur ein Hinweis auf die Website.
CREATE TABLE IF NOT EXISTS `smpg_news_images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `post_id` INT NOT NULL,
  `idx` INT NOT NULL,
  `mime` VARCHAR(32) NOT NULL DEFAULT 'image/png',
  `caption` VARCHAR(191) NOT NULL DEFAULT '',
  `data` LONGTEXT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_post` (`post_id`, `idx`),
  CONSTRAINT `fk_news_img` FOREIGN KEY (`post_id`) REFERENCES `smpg_news` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- Vorschläge der Spieler.
-- Reine Website-Angelegenheit: eingereicht, abgestimmt und verwaltet wird
-- ausschließlich unter /vorschlaege. Ingame gibt es dafür nichts.
-- ============================================================================
CREATE TABLE IF NOT EXISTS `smpg_suggestions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `author_uuid` VARCHAR(36) NOT NULL,
  `author_name` VARCHAR(16) NOT NULL,
  `category` VARCHAR(24) NOT NULL DEFAULT 'sonstiges',
  `title` VARCHAR(120) NOT NULL,
  -- Titel in Kleinbuchstaben ohne Umlaute und Satzzeichen. Grundlage der
  -- Duplikat-Suche (lib/similarity.ts) – so muss die nicht bei jeder Anfrage
  -- alle Titel neu putzen.
  `title_norm` VARCHAR(160) NOT NULL DEFAULT '',
  `body` TEXT NOT NULL,
  -- offen | geplant | umgesetzt | abgelehnt | duplikat
  `status` VARCHAR(16) NOT NULL DEFAULT 'offen',
  -- Anmerkung des Teams, für alle sichtbar.
  `staff_note` VARCHAR(500) NOT NULL DEFAULT '',
  -- Bei status='duplikat': der Vorschlag, der dasselbe abdeckt.
  `duplicate_of` INT NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_status` (`status`, `created_at`),
  INDEX `idx_author` (`author_uuid`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Eine Stimme je Person und Vorschlag – das stellt der Primärschlüssel sicher,
-- unabhängig davon, was die Schnittstelle durchlässt.
CREATE TABLE IF NOT EXISTS `smpg_suggestion_votes` (
  `suggestion_id` INT NOT NULL,
  `uuid` VARCHAR(36) NOT NULL,
  -- 1 = dafür, -1 = dagegen
  `value` TINYINT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`suggestion_id`, `uuid`),
  CONSTRAINT `fk_suggestion_vote` FOREIGN KEY (`suggestion_id`)
    REFERENCES `smpg_suggestions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- Bug-Meldungen.
-- Die Tabelle `smpg_bugs` legt das SMPGlobal-Plugin an (BugBridge) und liest
-- sie im Admin-GUI (/bug admin). Gemeldet wird seit der Umstellung nur noch
-- auf der Website – ingame zeigt /bug nur noch den Link.
--
-- Die Bilder hängen bewusst ohne Fremdschlüssel daran: `smpg_bugs` entsteht im
-- Plugin, und eine Beziehung auf eine Tabelle, die woanders angelegt wird,
-- scheitert je nach Engine beim Anlegen. Aufgeräumt wird an beiden Stellen von
-- Hand (BugBridge.delete und lib/feedback.ts).
-- ============================================================================
CREATE TABLE IF NOT EXISTS `smpg_bug_images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bug_id` INT NOT NULL,
  `idx` INT NOT NULL,
  `mime` VARCHAR(32) NOT NULL DEFAULT 'image/webp',
  `data` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bug` (`bug_id`, `idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- Eigener MySQL-User für die Website:
--  - SELECT auf alles (Statistiken, Preise, Historie)
--  - Schreiben nur auf die Tabellen, die der Admin-Bereich wirklich pflegt
-- ============================================================================
CREATE USER IF NOT EXISTS 'trycity_web'@'localhost' IDENTIFIED BY '<PASSWORT>';

GRANT SELECT ON `<DATENBANK>`.* TO 'trycity_web'@'localhost';
GRANT SELECT, INSERT, UPDATE ON `<DATENBANK>`.`smpg_web_login_codes` TO 'trycity_web'@'localhost';

-- Neuigkeiten werden ausschließlich über den Admin-Bereich gepflegt.
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DATENBANK>`.`smpg_news` TO 'trycity_web'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DATENBANK>`.`smpg_news_images` TO 'trycity_web'@'localhost';
-- Weitere Verfasser eines Beitrags. Die Tabelle legt das Plugin an (NewsBridge);
-- smpg_news.author_name bleibt der Hauptautor, damit ingame alles bleibt wie es war.
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DATENBANK>`.`smpg_news_authors` TO 'trycity_web'@'localhost';
-- Reaktionen auf Beiträge. Reine Website-Angelegenheit, ingame gibt es sie nicht.
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DATENBANK>`.`smpg_news_reactions` TO 'trycity_web'@'localhost';

-- Vorschläge und Stimmen: eingereicht wird nur hier, gelöscht vom Team oder
-- vom Verfasser selbst.
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DATENBANK>`.`smpg_suggestions`       TO 'trycity_web'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DATENBANK>`.`smpg_suggestion_votes`  TO 'trycity_web'@'localhost';

-- Bug-Meldungen: gemeldet wird auf der Website, verwaltet hier und ingame.
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DATENBANK>`.`smpg_bugs`              TO 'trycity_web'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `<DATENBANK>`.`smpg_bug_images`        TO 'trycity_web'@'localhost';

-- Preis-Verwaltung im Admin-Bereich: dauerhafte Einstellungen und Metas.
-- Bewusst ohne DELETE – aus dem Web wird nichts gelöscht, nur geändert und
-- ergänzt. Der Zähler in smpg_shop_meta sorgt dafür, dass die Minecraft-Server
-- die neuen Werte binnen 20 Sekunden übernehmen.
GRANT UPDATE         ON `<DATENBANK>`.`smpg_dynamic_prices`    TO 'trycity_web'@'localhost';
GRANT INSERT, UPDATE ON `<DATENBANK>`.`smpg_sell_prices`       TO 'trycity_web'@'localhost';
GRANT INSERT         ON `<DATENBANK>`.`smpg_dynamic_price_log` TO 'trycity_web'@'localhost';
GRANT INSERT, UPDATE ON `<DATENBANK>`.`smpg_price_meta`        TO 'trycity_web'@'localhost';
GRANT UPDATE         ON `<DATENBANK>`.`smpg_shop_meta`         TO 'trycity_web'@'localhost';

FLUSH PRIVILEGES;

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

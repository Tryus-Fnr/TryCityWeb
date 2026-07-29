/**
 * Rechte eines Clan-Rangs – Spaltennamen wie in `tryus_clan_ranks`.
 *
 * Bewusst in einer EIGENEN Datei und nicht in queries.ts: Die Liste wird auch
 * von Client-Komponenten gebraucht, und ein Import aus queries.ts würde den
 * MySQL-Treiber mit ins Browser-Bundle ziehen (Next.js bricht dann den Build ab).
 */
export const CLAN_PERMISSIONS = [
  { key: "perm_invite",           label: "Einladen",        desc: "Spieler in den Clan einladen" },
  { key: "perm_kick",             label: "Kicken",          desc: "Mitglieder aus dem Clan entfernen" },
  { key: "perm_promote",          label: "Befördern",       desc: "Mitglieder befördern & degradieren" },
  { key: "perm_manage_ranks",     label: "Ränge verwalten", desc: "Ränge anlegen, löschen, Rechte setzen" },
  { key: "perm_edit_name",        label: "Name ändern",     desc: "Clan-Namen bearbeiten" },
  { key: "perm_edit_tag",         label: "Tag ändern",      desc: "Clan-Tag bearbeiten" },
  { key: "perm_edit_color",       label: "Farbe ändern",    desc: "Farben & Tag-Stil bearbeiten" },
  { key: "perm_edit_description", label: "Beschreibung",    desc: "Clan-Beschreibung bearbeiten" },
  { key: "perm_bank_deposit",     label: "Bank einzahlen",  desc: "Geld ins Clan-Konto einzahlen" },
  { key: "perm_bank_withdraw",    label: "Bank abheben",    desc: "Geld vom Clan-Konto abheben" },
  { key: "perm_home",             label: "Home nutzen",     desc: "Zum Clan-Home teleportieren" },
  { key: "perm_sethome",          label: "Home setzen",     desc: "Clan-Home neu setzen" },
  { key: "perm_friendly_fire",    label: "Friendly Fire",   desc: "Friendly Fire umschalten" },
  { key: "perm_party",            label: "Party",           desc: "Clan-Party starten" },
] as const;

export type ClanPermissionKey = (typeof CLAN_PERMISSIONS)[number]["key"];

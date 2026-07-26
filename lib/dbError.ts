/**
 * Übersetzt einen MySQL-Fehler in eine Meldung, mit der man etwas anfangen kann.
 *
 * Wird nur in Admin-Routen benutzt: dort ist der Aufrufer ohnehin berechtigt,
 * und ohne den echten Fehlercode ist ein „hat nicht geklappt" wertlos – gerade
 * bei fehlender Tabelle oder fehlendem GRANT, die man sonst nur im
 * Server-Log sieht.
 */
export function describeDbError(e: unknown): string {
  const err = e as { code?: string; errno?: number; sqlMessage?: string; message?: string };
  const code = err?.code ?? "";
  const detail = err?.sqlMessage ?? err?.message ?? String(e);

  switch (code) {
    case "ER_NO_SUCH_TABLE":
      return (
        "Die Neuigkeiten-Tabellen fehlen in der Datenbank. " +
        "Führe setup.sql aus (Abschnitt smpg_news / smpg_news_images). " +
        `[${code}] ${detail}`
      );
    case "ER_TABLEACCESS_DENIED_ERROR":
    case "ER_ACCESS_DENIED_ERROR":
    case "ER_DBACCESS_DENIED_ERROR":
      return (
        "Der Datenbank-Benutzer der Website darf hier nicht schreiben. " +
        "Die GRANT-Zeilen für smpg_news und smpg_news_images aus setup.sql fehlen. " +
        `[${code}] ${detail}`
      );
    case "ER_DATA_TOO_LONG":
      return `Ein Feld ist zu lang für die Spalte. [${code}] ${detail}`;
    case "ER_NET_PACKET_TOO_LARGE":
      return (
        "Der Beitrag ist größer als max_allowed_packet der Datenbank – " +
        `meist ein zu großes Bild. [${code}] ${detail}`
      );
    case "ECONNREFUSED":
    case "PROTOCOL_CONNECTION_LOST":
    case "ETIMEDOUT":
      return `Keine Verbindung zur Datenbank. [${code}] ${detail}`;
    default:
      return code ? `[${code}] ${detail}` : detail;
  }
}

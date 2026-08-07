import "server-only";
import lang from "@/lib/lang/de_de.json";
import { englishName } from "@/lib/itemNames";

/**
 * Deutsche Item-Namen aus der Minecraft-Sprachdatei – nur auf dem Server.
 *
 * Die Datei ist dieselbe, die das Plugin benutzt (`lang/de_de.json` in
 * TryusCloudGlobalServer). Sie bleibt bewusst serverseitig: 160 KB JSON im
 * Browser-Bündel wären Verschwendung, wenn ohnehin die Item-Liste über eine
 * Schnittstelle kommt. Die Namen werden dort einfach mitgeliefert.
 *
 * Das Plugin bildet den Schlüssel über `Material.translationKey()`. Ohne Bukkit
 * geht das hier über die beiden möglichen Präfixe – geprüft gegen alle 1229
 * Shop-Materialien, das deckt sie vollständig ab.
 */

const NAMES = lang as Record<string, string>;

/** Deutscher Name, oder der lesbar gemachte Material-Name als Rückfall. */
export function germanName(material: string): string {
  const low = material.toLowerCase();
  return NAMES[`block.minecraft.${low}`] ?? NAMES[`item.minecraft.${low}`] ?? englishName(material);
}

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSessionRevoked, loadIsAdmin, loadIsMod } from "@/lib/queries";

/**
 * Gibt isAdmin zurück (false wenn nicht eingeloggt oder Sitzung widerrufen).
 * Kein DB-Fehler wirft – bei Ausfall wird false zurückgegeben.
 */
export async function getAdminStatus(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session?.uuid) return false;
    const revoked = await isSessionRevoked(session.uuid, session.issuedAt);
    if (revoked) return false;
    return await loadIsAdmin(session.uuid);
  } catch {
    return false;
  }
}

/**
 * Wirft einen 404-Fehler, wenn der anfragende Nutzer kein Admin ist.
 * In Admin-only Page-Komponenten ganz oben aufrufen.
 */
export async function requireAdmin(): Promise<void> {
  const admin = await getAdminStatus();
  if (!admin) notFound();
}

/**
 * Gibt isMod zurück (false wenn nicht eingeloggt oder Sitzung widerrufen).
 * Admins (*) gelten automatisch auch als Mods.
 */
export async function getModStatus(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session?.uuid) return false;
    const revoked = await isSessionRevoked(session.uuid, session.issuedAt);
    if (revoked) return false;
    return await loadIsMod(session.uuid);
  } catch {
    return false;
  }
}

/**
 * Wirft einen 404-Fehler, wenn der anfragende Nutzer kein Mod ist.
 * In Mod-only Page-Komponenten ganz oben aufrufen.
 */
export async function requireMod(): Promise<void> {
  const mod = await getModStatus();
  if (!mod) notFound();
}

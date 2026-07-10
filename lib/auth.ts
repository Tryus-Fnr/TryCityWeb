import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSessionRevoked, loadIsAdmin } from "@/lib/queries";

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


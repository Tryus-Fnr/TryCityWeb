import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Session-Verwaltung über ein signiertes JWT in einem httpOnly-Cookie.
 * AUTH_SECRET muss in der .env gesetzt sein (langer Zufallsstring).
 */
const COOKIE_NAME = "trycity_session";
const SESSION_DAYS = 30;

export type Session = {
  name: string;
  uuid: string | null;
};

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET fehlt oder ist zu kurz (.env prüfen)");
  }
  return new TextEncoder().encode(s);
}

export async function createSession(session: Session): Promise<void> {
  const jwt = await new SignJWT({ name: session.name, uuid: session.uuid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  (await cookies()).set(COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.name !== "string") return null;
    return {
      name: payload.name,
      uuid: typeof payload.uuid === "string" ? payload.uuid : null,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

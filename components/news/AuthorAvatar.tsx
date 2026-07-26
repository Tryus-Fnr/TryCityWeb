"use client";

import { useState } from "react";
import { avatarFallbackUrl, mojavatarUrl } from "@/lib/newsTypes";

/**
 * Skin-Render des Autors im Mojavatar-Stil – der Look aus Minecraft-Foren.
 * Antwortet der Render-Dienst nicht, wird auf den Kopf von mc-heads
 * zurückgefallen, damit nie ein kaputtes Bild stehen bleibt.
 */
export default function AuthorAvatar({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const [src, setSrc] = useState(() => mojavatarUrl(name));

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setSrc(avatarFallbackUrl(name))}
      className={`object-contain ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

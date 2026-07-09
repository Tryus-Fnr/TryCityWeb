"use client";

import { useState } from "react";

interface ItemIconProps {
  material: string;
  size?: number;
  className?: string;
}

/**
 * Zeigt das Minecraft-Textur-Icon für ein Material.
 * Versucht zuerst /textures/item/<name>.png, dann /textures/block/<name>.png.
 */
export default function ItemIcon({ material, size = 32, className = "" }: ItemIconProps) {
  const name = material.toLowerCase();
  const [src, setSrc] = useState(`/textures/item/${name}.png`);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (src.startsWith("/textures/item/")) {
      setSrc(`/textures/block/${name}.png`);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded bg-white/5 text-neutral-600 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        ?
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={handleError}
      className={`object-contain pixelated ${className}`}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}


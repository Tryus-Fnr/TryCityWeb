"use client";

import { useEffect, useState, type CSSProperties } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789§#@%&?";

/**
 * Der `&k`-Effekt aus Minecraft: die Zeichen wechseln laufend.
 * Leerzeichen bleiben stehen, damit die Wortlänge erkennbar bleibt.
 */
export default function Obfuscated({
  text,
  style,
}: {
  text: string;
  style?: CSSProperties;
}) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    const scramble = () =>
      setShown(
        Array.from(text, (c) =>
          c === " " || c === "\n" ? c : CHARS[Math.floor(Math.random() * CHARS.length)]
        ).join("")
      );
    scramble();
    const timer = setInterval(scramble, 70);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <span style={style} title={text} aria-label={text}>
      {shown}
    </span>
  );
}

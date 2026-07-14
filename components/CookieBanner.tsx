"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE_KEY = "trycity_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(COOKIE_KEY, "accepted");
    } catch {}
    setVisible(false);
  }

  function decline() {
    try {
      localStorage.setItem(COOKIE_KEY, "declined");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col sm:flex-row items-start sm:items-center gap-4 px-6 py-4"
      style={{ background: "#000000" }}
    >
      {/* Text */}
      <p className="flex-1 text-sm text-white leading-relaxed">
        We use cookies on our website to see how you interact with it. By
        accepting, you agree to our use of such cookies.{" "}
        <Link
          href="/datenschutz"
          className="underline text-white hover:text-neutral-300 transition-colors"
        >
          Privacy Policy
        </Link>
      </p>

      {/* Buttons */}
      <div className="flex shrink-0 gap-3">
        {/* Decline – only white border */}
        <button
          onClick={decline}
          className="px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          style={{
            background: "transparent",
            border: "1px solid #ffffff",
            borderRadius: 0,
          }}
        >
          Decline All
        </button>

        {/* Accept – solid white */}
        <button
          onClick={accept}
          className="px-5 py-2 text-sm font-semibold transition-colors hover:bg-neutral-200"
          style={{
            background: "#ffffff",
            color: "#000000",
            border: "none",
            borderRadius: 0,
          }}
        >
          Accept All
        </button>
      </div>
    </div>
  );
}


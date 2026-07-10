"use client";

import Link from "next/link";
import { useRef, useEffect, useCallback, useState } from "react";

export interface CarouselTab {
  href: string;
  title: string;
  description: string;
}

export default function TabCarousel({ tabs }: { tabs: CarouselTab[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const [hovered, setHovered] = useState(false);
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number>(0);
  const touchXRef = useRef<number>(0);

  // Triple for seamless infinite scroll
  const items = [...tabs, ...tabs, ...tabs];

  // Scroll to middle set on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Wait one frame for layout
    requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth / 3;
    });
  }, []);

  // RAF-based auto-scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const step = (t: number) => {
      if (!isPausedRef.current) {
        const dt = lastTRef.current ? t - lastTRef.current : 0;
        lastTRef.current = t;
        el.scrollLeft += dt * 0.045;
        const third = el.scrollWidth / 3;
        if (el.scrollLeft >= third * 2) el.scrollLeft -= third;
        if (el.scrollLeft <= 0) el.scrollLeft += third;
      } else {
        lastTRef.current = t;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Non-passive wheel listener so we can call preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollLeft += e.deltaY + e.deltaX;
      const third = el.scrollWidth / 3;
      if (el.scrollLeft >= third * 2) el.scrollLeft -= third;
      if (el.scrollLeft <= 0) el.scrollLeft += third;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    setHovered(true);
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    setHovered(false);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchXRef.current = e.touches[0].clientX;
    isPausedRef.current = true;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const dx = touchXRef.current - e.touches[0].clientX;
      el.scrollLeft += dx;
      touchXRef.current = e.touches[0].clientX;
      const third = el.scrollWidth / 3;
      if (el.scrollLeft >= third * 2) el.scrollLeft -= third;
      if (el.scrollLeft <= 0) el.scrollLeft += third;
    },
    [],
  );

  const onTouchEnd = useCallback(() => {
    isPausedRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex gap-5 overflow-x-hidden py-2 select-none"
      style={{ scrollBehavior: "auto", cursor: hovered ? "grab" : "default" }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {items.map((tab, i) => (
        <Link
          key={i}
          href={tab.href}
          draggable={false}
          className="group flex-shrink-0 w-72 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-200 hover:border-sky-400/40 hover:bg-sky-400/[0.05]"
        >
          <h3 className="text-base font-bold text-neutral-100 group-hover:text-sky-300 transition-colors duration-200">
            {tab.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400 line-clamp-3">
            {tab.description}
          </p>
          <span className="mt-4 inline-block text-xs font-semibold uppercase tracking-wider text-sky-400">
            Öffnen
          </span>
        </Link>
      ))}
    </div>
  );
}


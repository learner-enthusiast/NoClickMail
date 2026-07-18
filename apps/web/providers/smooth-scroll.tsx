"use client";

import Lenis from "lenis";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    // Scroll lives on <main data-scroll-root>, not the window — Lenis must target that node
    // or wheel events get eaten and overflow-y-auto never moves.
    const wrapper = document.querySelector<HTMLElement>("[data-scroll-root]");

    const instance = new Lenis({
      ...(wrapper ? { wrapper, content: wrapper } : {}),
      autoRaf: false,
      lerp: 0.08,
      smoothWheel: true,
      anchors: false,
    });

    setLenis(instance);
    instance.on("scroll", ScrollTrigger.update);

    const update = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(update);
      instance.destroy();
      setLenis(null);
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}

"use client";

import Lenis from "lenis";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

function getScrollRoot() {
  return document.querySelector<HTMLElement>("[data-scroll-root]");
}

/** Pixel offset from top of scroll root — accounts for scroll-margin on the target. */
function getSectionScrollTop(el: HTMLElement, root: HTMLElement) {
  const scrollMargin = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  return (
    el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - scrollMargin
  );
}

function scrollSectionTo(
  id: string,
  opts: { lenis?: Lenis | null; immediate?: boolean } = {},
) {
  const root = getScrollRoot();
  const el = document.getElementById(id);
  if (!root || !el) return false;

  const top = getSectionScrollTop(el, root);
  const { lenis, immediate = false } = opts;

  if (lenis) {
    lenis.resize();
    lenis.scrollTo(top, {
      immediate,
      duration: immediate ? 0 : 1.2,
      force: true,
    });
  } else {
    root.scrollTo({ top, behavior: immediate ? "auto" : "smooth" });
  }

  return true;
}

export function useScrollToSection() {
  const lenis = useLenis();
  return useCallback(
    (id: string, immediate = false) => scrollSectionTo(id, { lenis, immediate }),
    [lenis],
  );
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const wrapper = getScrollRoot();
    const content =
      wrapper?.querySelector<HTMLElement>("[data-scroll-content]") ??
      (wrapper?.firstElementChild as HTMLElement | null) ??
      undefined;

    if (!wrapper || !content) return;

    const instance = new Lenis({
      wrapper,
      content,
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

    function onAnchorClick(event: MouseEvent) {
      if (!getScrollRoot()) return;

      const anchor = (event.target as Element | null)?.closest('a[href^="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const hash = anchor.hash;
      if (!hash || hash === "#") return;

      const id = hash.slice(1);
      if (!document.getElementById(id)) return;

      event.preventDefault();
      scrollSectionTo(id, { lenis: instance });
      history.pushState(null, "", hash);
    }

    document.addEventListener("click", onAnchorClick, true);

    const initialHash = window.location.hash.slice(1);
    if (initialHash) {
      requestAnimationFrame(() => scrollSectionTo(initialHash, { lenis: instance, immediate: true }));
    }

    return () => {
      document.removeEventListener("click", onAnchorClick, true);
      gsap.ticker.remove(update);
      instance.destroy();
      setLenis(null);
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}

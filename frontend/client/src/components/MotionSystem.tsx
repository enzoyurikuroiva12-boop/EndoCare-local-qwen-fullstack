import { useEffect } from "react";
import "./MotionSystem.css";

export function revealObserverOptions(isNarrowScreen: boolean): IntersectionObserverInit {
  return isNarrowScreen
    ? { rootMargin: "0px 0px -6%", threshold: 0.06 }
    : { rootMargin: "0px 0px -2%", threshold: 0.02 };
}

export function MotionSystem() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".site-root");
    const heroVisual = document.querySelector<HTMLElement>(".hero-visual");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isNarrowScreen = window.matchMedia("(max-width: 760px)").matches;
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".section-shell, .blog-page-intro, .blog-posts-section"));
    root?.classList.add("motion-enabled", "is-loaded");
    let frame = 0;

    const updateHeroParallax = () => {
      heroVisual?.style.setProperty("--hero-parallax", `${Math.min(window.scrollY * 0.055, 28)}px`);
      frame = 0;
    };
    const requestParallaxUpdate = () => { if (!frame) frame = window.requestAnimationFrame(updateHeroParallax); };
    updateHeroParallax();
    window.addEventListener("scroll", requestParallaxUpdate, { passive: true });

    if (prefersReducedMotion) {
      sections.forEach((section) => section.classList.add("is-revealed"));
      return () => { window.removeEventListener("scroll", requestParallaxUpdate); if (frame) window.cancelAnimationFrame(frame); };
    }

    sections.forEach((section) => section.classList.add("reveal-ready"));
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.target.classList.toggle("is-revealed", entry.isIntersecting)),
      revealObserverOptions(isNarrowScreen),
    );
    sections.forEach((section) => observer.observe(section));
    return () => {
      window.removeEventListener("scroll", requestParallaxUpdate);
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <div className="page-curtain" aria-hidden="true" />;
}

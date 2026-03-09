export const initHeroParallax = (): void => {
  const hero = document.getElementById("hero") as HTMLElement | null;
  const heroLeft = document.querySelector<HTMLElement>(".hero-left");
  const heroVisual = document.querySelector<HTMLElement>(".hero-visual");
  const isDesktop = window.matchMedia("(min-width: 1025px)").matches;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (!hero) {
    return;
  }

  if (prefersReducedMotion || !isDesktop) {
    if (heroLeft) heroLeft.style.transform = "";
    if (heroVisual) heroVisual.style.transform = "";
    return;
  }

  let ticking = false;

  const updateHeroParallax = (): void => {
    const rect = hero.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.bottom <= 0 || rect.top >= viewportHeight) {
      ticking = false;
      return;
    }

    const progress = Math.max(-1, Math.min(1, rect.top / viewportHeight));
    const leftOffset = progress * -18;
    const visualOffset = progress * -10;

    if (heroLeft) {
      heroLeft.style.transform = `translate3d(0, ${leftOffset}px, 0)`;
    }

    if (heroVisual) {
      heroVisual.style.transform = `translate3d(0, ${visualOffset}px, 0)`;
    }

    ticking = false;
  };

  const onHeroScroll = (): void => {
    if (ticking) return;

    ticking = true;
    window.requestAnimationFrame(updateHeroParallax);
  };

  window.addEventListener("scroll", onHeroScroll, { passive: true });
  window.addEventListener("resize", onHeroScroll);
  onHeroScroll();
};

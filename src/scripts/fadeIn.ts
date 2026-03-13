export const initFadeIn = (): void => {
  const fadeElements = document.querySelectorAll<HTMLElement>(".fade-in");
  const heroFadeElements =
    document.querySelectorAll<HTMLElement>("#hero .fade-in");
  const heroChecks = document.querySelectorAll<HTMLElement>(".hero-checks li");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const hasFadeElements = fadeElements.length > 0;
  const hasHeroFadeElements = heroFadeElements.length > 0;
  const hasHeroChecks = heroChecks.length > 0;

  if (!hasFadeElements && !hasHeroFadeElements && !hasHeroChecks) {
    return;
  }

  if (prefersReducedMotion) {
    fadeElements.forEach((el: HTMLElement) => el.classList.add("visible"));
    heroFadeElements.forEach((el: HTMLElement) => el.classList.add("visible"));
    heroChecks.forEach((li: HTMLElement) => li.classList.add("visible"));
    return;
  }

  if (hasFadeElements) {
    const fadeObserver = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]): void => {
        entries.forEach((entry: IntersectionObserverEntry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("visible");
            fadeObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
      },
    );

    fadeElements.forEach((el: HTMLElement) => fadeObserver.observe(el));
  }

  if (hasHeroFadeElements) {
    heroFadeElements.forEach((el: HTMLElement, index: number) => {
      window.setTimeout(
        (): void => {
          el.classList.add("visible");
        },
        200 + index * 150,
      );
    });
  }

  if (hasHeroChecks) {
    window.setTimeout((): void => {
      heroChecks.forEach((li: HTMLElement, index: number) => {
        window.setTimeout((): void => {
          li.classList.add("visible");
        }, index * 200);
      });
    }, 800);
  }
};

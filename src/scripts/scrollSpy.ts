export const initScrollSpy = (): void => {
  const navLinks = document.querySelectorAll<HTMLAnchorElement>(".nav-link");
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("section[id]"),
  );

  if (navLinks.length === 0 || sections.length === 0) {
    return;
  }

  const setActiveById = (id: string): void => {
    if (!id) return;
    navLinks.forEach((link: HTMLAnchorElement) => {
      link.classList.remove("active");
      if (link.getAttribute("href") === `#${id}`) {
        link.classList.add("active");
      }
    });
  };

  const getActiveSectionId = (): string | null => {
    const referenceY = window.innerHeight * 0.32;
    let bestId: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const spansReference = rect.top <= referenceY && rect.bottom >= referenceY;

      if (spansReference) {
        bestId = section.id;
        bestDistance = 0;
        return;
      }

      const distance = Math.min(
        Math.abs(rect.top - referenceY),
        Math.abs(rect.bottom - referenceY),
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = section.id;
      }
    });

    return bestId;
  };

  let rafId = 0;
  const updateActiveOnScroll = (): void => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      const id = getActiveSectionId();
      if (id) setActiveById(id);
    });
  };

  const syncFromHash = (): void => {
    const hash = window.location.hash;
    if (!hash) return;
    setActiveById(hash.replace("#", ""));
  };

  // Ensure initial load + hash navigation are reflected, then fall back to scroll.
  syncFromHash();
  updateActiveOnScroll();

  window.addEventListener("scroll", updateActiveOnScroll, { passive: true });
  window.addEventListener("resize", updateActiveOnScroll, { passive: true });
  window.addEventListener("hashchange", syncFromHash, { passive: true });
};

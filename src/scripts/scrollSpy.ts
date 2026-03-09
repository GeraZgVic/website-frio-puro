export const initScrollSpy = (): void => {
  const navLinks = document.querySelectorAll<HTMLAnchorElement>(".nav-link");
  const sections = document.querySelectorAll<HTMLElement>("section[id], #hero");

  if (navLinks.length === 0 || sections.length === 0) {
    return;
  }

  const spyObserver = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]): void => {
      entries.forEach((entry: IntersectionObserverEntry) => {
        if (!entry.isIntersecting) return;

        const id = (entry.target as HTMLElement).id;

        navLinks.forEach((link: HTMLAnchorElement) => {
          link.classList.remove("active");

          if (link.getAttribute("href") === `#${id}`) {
            link.classList.add("active");
          }
        });
      });
    },
    {
      threshold: 0.35,
    },
  );

  sections.forEach((section: HTMLElement) => spyObserver.observe(section));
};

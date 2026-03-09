export const initCounters = (): void => {
  const counterSection = document.getElementById(
    "beneficios",
  ) as HTMLElement | null;
  const counterElements =
    document.querySelectorAll<HTMLElement>(".counter-num");

  if (!counterSection || counterElements.length === 0) {
    return;
  }

  let countersStarted = false;

  const animateCounter = (el: HTMLElement): void => {
    const rawTarget = el.getAttribute("data-target");
    const target = rawTarget ? Number.parseInt(rawTarget, 10) : NaN;
    if (Number.isNaN(target)) return;

    const duration = 2000;
    const start = performance.now();

    const update = (time: number): void => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      el.textContent = Math.floor(eased * target).toString();

      if (progress < 1) {
        window.requestAnimationFrame(update);
      } else {
        el.textContent = `${target}`;
      }
    };

    window.requestAnimationFrame(update);
  };

  const counterObserver = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]): void => {
      entries.forEach((entry: IntersectionObserverEntry) => {
        if (entry.isIntersecting && !countersStarted) {
          countersStarted = true;
          counterElements.forEach((el: HTMLElement) => animateCounter(el));
        }
      });
    },
    {
      threshold: 0.3,
    },
  );

  counterObserver.observe(counterSection);
};

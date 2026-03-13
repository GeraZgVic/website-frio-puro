export const initThemeColorSections = (): void => {
  const themeMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!themeMeta || !('IntersectionObserver' in window)) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const colors = {
    dark: rootStyle.getPropertyValue("--color-dark").trim() || "#1a1f4e",
    primary:
      rootStyle.getPropertyValue("--color-primary").trim() || "#323b81",
    footer:
      rootStyle.getPropertyValue("--color-footer").trim() || "#0d1240",
  };

  const sectionColors: Array<[string, string]> = [
    ["#inicio", colors.dark],
    ["#nosotros", colors.primary],
    ["#productos", colors.primary],
    ["#como-pedir", colors.primary],
    ["#beneficios", colors.primary],
    ["#cobertura", colors.primary],
    ["#testimonios", colors.primary],
    ["#contacto", colors.primary],
    ["footer", colors.footer],
  ];

  const targets: Array<{ el: Element; color: string }> = [];
  sectionColors.forEach(([selector, color]) => {
    const el = document.querySelector(selector);
    if (el) targets.push({ el, color });
  });

  if (targets.length === 0) return;

  const ratios = new Map<Element, number>();
  let currentColor = themeMeta.getAttribute("content") || "";

  const setThemeColorIfChanged = (color: string): void => {
    if (!color || color === currentColor) return;
    themeMeta.setAttribute("content", color);
    currentColor = color;
  };

  const pickDominant = (): void => {
    let best: { el: Element; ratio: number; color: string } | null = null;

    targets.forEach(({ el, color }) => {
      const ratio = ratios.get(el) ?? 0;
      if (!best || ratio > best.ratio) {
        best = { el, ratio, color };
      }
    });

    if (!best || best.ratio < 0.4) return;
    setThemeColorIfChanged(best.color);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        ratios.set(entry.target, entry.intersectionRatio);
      });
      pickDominant();
    },
    {
      threshold: [0, 0.25, 0.5, 0.75],
      rootMargin: "-15% 0px -15% 0px",
    },
  );

  targets.forEach(({ el }) => observer.observe(el));

  // Initial pick after observers attach.
  requestAnimationFrame(pickDominant);
};

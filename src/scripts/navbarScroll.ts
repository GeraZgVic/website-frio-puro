export const initNavbarScroll = (): void => {
  const navbar = document.getElementById("navbar") as HTMLElement | null;
  const backTop = document.getElementById("back-top") as HTMLElement | null;
  const themeMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  const rootStyle = getComputedStyle(document.documentElement);
  const topThemeColor =
    rootStyle.getPropertyValue("--color-dark").trim() || "#1a1f4e";
  const scrolledThemeColor =
    rootStyle.getPropertyValue("--color-primary").trim() || "#323b81";

  let isScrolled = window.scrollY > 60;

  const applyThemeColor = (color: string): void => {
    if (!themeMeta) return;
    if (themeMeta.getAttribute("content") === color) return;
    themeMeta.setAttribute("content", color);
  };

  const onScroll = (): void => {
    const nextScrolled = window.scrollY > 60;

    if (nextScrolled !== isScrolled) {
      isScrolled = nextScrolled;
      navbar?.classList.toggle("scrolled", isScrolled);
      applyThemeColor(isScrolled ? scrolledThemeColor : topThemeColor);
    }

    if (backTop) {
      backTop.classList.toggle("visible", window.scrollY > 300);
    }
  };

  applyThemeColor(isScrolled ? scrolledThemeColor : topThemeColor);
  navbar?.classList.toggle("scrolled", isScrolled);

  if (backTop) {
    backTop.classList.toggle("visible", window.scrollY > 300);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
};

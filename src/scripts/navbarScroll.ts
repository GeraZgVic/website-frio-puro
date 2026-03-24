import type { ThemeSectionChangeDetail } from "./themeColorSections";

const THEME_SECTION_CHANGE_EVENT = "theme:section-change";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const setActiveLinks = (id: string): void => {
  if (!id) return;

  const desktopLinks = document.querySelectorAll<HTMLAnchorElement>(".nav-link");
  const mobileLinks = document.querySelectorAll<HTMLAnchorElement>(".mobile-link");

  for (const link of desktopLinks) {
    const shouldBeActive = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("active", shouldBeActive);
  }

  for (const link of mobileLinks) {
    const shouldBeActive = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("active", shouldBeActive);
  }
};

const isThemeSectionChangeEvent = (
  event: Event,
): event is CustomEvent<ThemeSectionChangeDetail> => {
  return event instanceof CustomEvent && typeof event.detail === "object" && event.detail !== null;
};

export const initNavbarScroll = (): void => {
  const navbar = document.getElementById("navbar") as HTMLElement | null;
  const backTop = document.getElementById("back-top") as HTMLElement | null;
  const whatsappFab = document.getElementById("whatsapp-fab") as HTMLElement | null;

  if (!navbar) return;

  // Used to apply "hero hold" for visual motion (do not mutate inside hero).
  let dominantId = "";

  const applyNavMode = (mode: "dark" | "light"): void => {
    navbar.dataset.navMode = mode;
    navbar.classList.toggle("nav--light", mode === "light");
    navbar.classList.toggle("nav--dark", mode === "dark");
  };

  const applyFromDetail = (detail: ThemeSectionChangeDetail): void => {
    dominantId = detail.id;
    applyNavMode(detail.navMode);
    setActiveLinks(detail.navId || detail.id);
    scheduleVisualUpdate();
  };

  const onThemeSectionChange = (event: Event): void => {
    if (!isThemeSectionChangeEvent(event)) return;
    applyFromDetail(event.detail);
  };

  window.addEventListener(THEME_SECTION_CHANGE_EVENT, onThemeSectionChange);

  const syncFromHash = (): void => {
    const hash = window.location.hash;
    if (!hash) return;
    setActiveLinks(hash.replace("#", ""));
  };

  let navSurface: "glass" | "solid" = "glass";
  const setNavSurface = (surface: "glass" | "solid"): void => {
    navSurface = surface;
    navbar.dataset.navSurface = surface;
    navbar.classList.toggle("nav--glass", surface === "glass");
    navbar.classList.toggle("nav--solid", surface === "solid");
  };

  const setNavElevated = (isElevated: boolean): void => {
    navbar.classList.toggle("nav--elevated", isElevated);
  };

  const SCROLL_NORM_PX = 220;
  const HERO_SCROLL_CAP = 0.12;
  const SURFACE_SOLID_ON = 0.34;
  const SURFACE_GLASS_ON = 0.22;

  let currentT = 0;
  let targetT = 0;
  let rafId = 0;

  const applyVisualState = (scrollY: number): void => {
    const rawTarget = clamp01(scrollY / SCROLL_NORM_PX);
    const cappedTarget = dominantId === "inicio" ? Math.min(rawTarget, HERO_SCROLL_CAP) : rawTarget;
    targetT = cappedTarget;

    if (rafId) return;
    rafId = window.requestAnimationFrame(tick);
  };

  const tick = (): void => {
    rafId = 0;

    const delta = targetT - currentT;
    if (Math.abs(delta) < 0.0025) {
      currentT = targetT;
    } else {
      currentT += delta * 0.11;
    }

    navbar.style.setProperty("--nav-scroll", currentT.toFixed(4));

    // Smooth boosts (avoid snap between glass/solid/elevated).
    const isHero = dominantId === "inicio";
    const solidBoost = isHero ? 0 : smoothstep(0.18, 0.72, currentT) * 0.16;
    const elevate = smoothstep(0.52, 0.95, currentT);

    navbar.style.setProperty("--nav-solid-boost", solidBoost.toFixed(4));
    navbar.style.setProperty("--nav-elevate", elevate.toFixed(4));

    navbar.dataset.navScrolled = currentT > 0.05 ? "true" : "false";

    if (isHero) {
      setNavSurface("glass");
      setNavElevated(false);
    } else {
      if (navSurface === "glass" && currentT > SURFACE_SOLID_ON) setNavSurface("solid");
      if (navSurface === "solid" && currentT < SURFACE_GLASS_ON) setNavSurface("glass");
      setNavElevated(elevate > 0.82);
    }

    // Keep legacy class for any remaining CSS / future hooks.
    navbar.classList.toggle("scrolled", (window.scrollY || 0) > 60);

    // Continue animating if needed.
    if (currentT !== targetT) {
      rafId = window.requestAnimationFrame(tick);
    }
  };

  const scheduleVisualUpdate = (): void => {
    applyVisualState(window.scrollY || 0);
  };

  const onScrollOrResize = (): void => {
    scheduleVisualUpdate();

    const scrollY = window.scrollY || 0;
    const showFloating = scrollY > 300;
    if (backTop) backTop.classList.toggle("visible", showFloating);
    if (whatsappFab) whatsappFab.classList.toggle("visible", showFloating);
  };

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
  window.addEventListener("hashchange", syncFromHash, { passive: true });

  const last = (
    window as typeof window & {
      __frioPuroThemeSection?: ThemeSectionChangeDetail;
    }
  ).__frioPuroThemeSection;

  if (last) applyFromDetail(last);
  else syncFromHash();

  onScrollOrResize();
};

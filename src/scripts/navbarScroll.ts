import type { ThemeSectionChangeDetail } from "./themeColorSections";

const THEME_SECTION_CHANGE_EVENT = "theme:section-change";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const setActiveLinks = (id: string): void => {
  if (!id) return;

  const desktopLinks =
    document.querySelectorAll<HTMLAnchorElement>(".nav-link");
  const mobileLinks =
    document.querySelectorAll<HTMLAnchorElement>(".mobile-link");

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
  return (
    event instanceof CustomEvent &&
    typeof event.detail === "object" &&
    event.detail !== null
  );
};

export const initNavbarScroll = (): void => {
  const navbar = document.getElementById("navbar") as HTMLElement | null;
  const backTop = document.getElementById("back-top") as HTMLElement | null;
  const whatsappFab = document.getElementById(
    "whatsapp-fab",
  ) as HTMLElement | null;

  if (!navbar) return;

  // Used to apply "hero hold" for visual motion (do not mutate inside hero).
  let dominantId = "";
  let currentModeBlend = 0; // 0 = dark, 1 = light
  let targetModeBlend = 0;
  let currentTextModeBlend = 0; // 0 = dark ink, 1 = light ink (tracks target slightly faster)

  const applyNavMode = (mode: "dark" | "light"): void => {
    navbar.dataset.navMode = mode;
    navbar.classList.toggle("nav--light", mode === "light");
    navbar.classList.toggle("nav--dark", mode === "dark");
    targetModeBlend = mode === "light" ? 1 : 0;
  };

  const applyFromDetail = (detail: ThemeSectionChangeDetail): void => {
    const wasUninitialized = dominantId === "";
    dominantId = detail.id;
    applyNavMode(detail.navMode);
    setActiveLinks(detail.navId || detail.id);

    if (wasUninitialized) {
      currentModeBlend = targetModeBlend;
      currentTextModeBlend = targetModeBlend;
      navbar.style.setProperty("--nav-mode-blend", currentModeBlend.toFixed(4));
      navbar.style.setProperty(
        "--nav-text-blend",
        currentTextModeBlend.toFixed(4),
      );
    }

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
  const SURFACE_SOLID_ON = 0.07;
  const SURFACE_GLASS_ON = 0.03;
  const ELEVATE_ON = 0.86;
  const ELEVATE_OFF = 0.74;

  // Motion calibration:
  // - scroll/background slightly slower (more "inertia")
  // - mode blend slower (reduce perceptual snap on light<->dark)
  // - solid boost smoother (avoid glass<->solid "hit")
  // - elevation a touch more responsive (shadow can lead subtly)
  const LERP_SCROLL = 0.085;
  // Mode blend: cuando cambia de seccion (dark <-> light) el delta es grande y el
  // estado hibrido puede sentirse "fuera de fase" con el fondo real detras del navbar.
  // Hacemos el blend adaptativo: rapido cuando esta lejos, suave al acercarse.
  const LERP_MODE_MIN = 0.08;
  const LERP_MODE_MAX = 0.18;
  // Text needs to solve contrast fast (legibility > cinematic for ink).
  // Adaptive rate: aggressive catch-up when far, softer close when near.
  const LERP_TEXT_MODE_MIN = 0.28;
  const LERP_TEXT_MODE_MAX = 0.52;
  const TEXT_SNAP_FAR_DELTA = 0.24;
  const LERP_SOLID_BOOST = 0.065;
  const LERP_ELEVATE = 0.18;

  let currentT = 0;
  let targetT = 0;
  let currentSolidBoost = 0;
  let currentElevate = 0;
  let rafId = 0;

  const applyVisualState = (scrollY: number): void => {
    const rawTarget = clamp01(scrollY / SCROLL_NORM_PX);
    const cappedTarget =
      dominantId === "inicio"
        ? Math.min(rawTarget, HERO_SCROLL_CAP)
        : rawTarget;
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
      currentT += delta * LERP_SCROLL;
    }

    navbar.style.setProperty("--nav-scroll", currentT.toFixed(4));

    const modeDelta = targetModeBlend - currentModeBlend;
    const modeDeltaAbs = Math.abs(modeDelta);
    if (modeDeltaAbs < 0.0025) {
      currentModeBlend = targetModeBlend;
    } else {
      const urgency = clamp01(modeDeltaAbs / 0.5);
      const lerpMode =
        LERP_MODE_MIN + (LERP_MODE_MAX - LERP_MODE_MIN) * urgency;
      currentModeBlend += modeDelta * lerpMode;
    }

    currentModeBlend = clamp01(currentModeBlend);
    navbar.style.setProperty("--nav-mode-blend", currentModeBlend.toFixed(4));

    // Text blend: much more responsive than material to avoid contrast "dip"
    // when the material darkens/lightens before ink finishes adapting.
    const textDelta = targetModeBlend - currentTextModeBlend;
    const textDeltaAbs = Math.abs(textDelta);

    // Perceptual snap (kills the low-contrast gray mid state)
    if (textDeltaAbs >= TEXT_SNAP_FAR_DELTA) {
      currentTextModeBlend = targetModeBlend;
    } else if (textDeltaAbs < 0.03) {
      currentTextModeBlend = targetModeBlend;
    } else {
      const urgency = clamp01(textDeltaAbs / 0.18);
      const lerpText =
        LERP_TEXT_MODE_MIN +
        (LERP_TEXT_MODE_MAX - LERP_TEXT_MODE_MIN) * urgency;

      currentTextModeBlend += textDelta * lerpText;
    }

    currentTextModeBlend = clamp01(currentTextModeBlend);
    // Perceptual lead: bias the visible blend away from mid-gray to preserve contrast.
    // This makes the text "commit" earlier without speeding up the material.
    const perceptualTextBlend =
      targetModeBlend === 0
        ? currentTextModeBlend * currentTextModeBlend
        : 1 - (1 - currentTextModeBlend) * (1 - currentTextModeBlend);

    navbar.style.setProperty("--nav-text-blend", perceptualTextBlend.toFixed(4));

    // Smooth boosts (avoid snap between glass/solid/elevated).
    const isHero = dominantId === "inicio";
    const targetSolidBoost = isHero
      ? 0
      : smoothstep(0.2, 0.82, currentT) * 0.14;
    const solidDelta = targetSolidBoost - currentSolidBoost;
    if (Math.abs(solidDelta) < 0.0015) {
      currentSolidBoost = targetSolidBoost;
    } else {
      currentSolidBoost += solidDelta * LERP_SOLID_BOOST;
    }

    const targetElevate = isHero ? 0 : smoothstep(0.46, 0.92, targetT);
    const elevDelta = targetElevate - currentElevate;
    if (Math.abs(elevDelta) < 0.0015) {
      currentElevate = targetElevate;
    } else {
      currentElevate += elevDelta * LERP_ELEVATE;
    }

    navbar.style.setProperty("--nav-solid-boost", currentSolidBoost.toFixed(4));
    navbar.style.setProperty("--nav-elevate", currentElevate.toFixed(4));

    navbar.dataset.navScrolled = currentT > 0.05 ? "true" : "false";

    if (isHero) {
      setNavSurface("glass");
      setNavElevated(false);
    } else {
      if (navSurface === "glass" && currentSolidBoost > SURFACE_SOLID_ON)
        setNavSurface("solid");
      if (navSurface === "solid" && currentSolidBoost < SURFACE_GLASS_ON)
        setNavSurface("glass");

      const isElevated = navbar.classList.contains("nav--elevated");
      if (!isElevated && currentElevate > ELEVATE_ON) setNavElevated(true);
      if (isElevated && currentElevate < ELEVATE_OFF) setNavElevated(false);
    }

    // Keep legacy class for any remaining CSS / future hooks.
    navbar.classList.toggle("scrolled", (window.scrollY || 0) > 60);

    const needsMore =
      Math.abs(targetT - currentT) > 0.0025 ||
      Math.abs(targetModeBlend - currentModeBlend) > 0.0025 ||
      Math.abs(targetModeBlend - currentTextModeBlend) > 0.0025 ||
      Math.abs(targetSolidBoost - currentSolidBoost) > 0.0015 ||
      Math.abs(targetElevate - currentElevate) > 0.0015;

    if (needsMore) {
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

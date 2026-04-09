export const initSiteScripts = (): void => {
  const prefersReducedMotion =
    "matchMedia" in window &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hasNavbar = Boolean(document.getElementById("navbar"));
  const hasMobileMenu = Boolean(document.getElementById("mobileMenu"));
  const hasHamburger = Boolean(document.getElementById("hamburger"));

  const shouldRunTransitions = Boolean(
    document.querySelector("a[data-page-transition]") ||
      document.querySelector("#navbar a, #mobileMenu a, .mobile-menu a"),
  );

  if (shouldRunTransitions) {
    void import("./pageTransitions").then(({ initPageTransitions }) => {
      initPageTransitions();
    });
  }

  if (hasNavbar) {
    void import("./navbarScroll").then(({ initNavbarScroll }) => {
      initNavbarScroll();
    });
  }

  if (document.querySelector('meta[name="theme-color"]')) {
    void import("./themeColorSections").then(({ initThemeColorSections }) => {
      initThemeColorSections();
    });
  }

  if (hasMobileMenu || hasHamburger) {
    void import("./mobileMenu").then(({ initMobileMenu }) => {
      initMobileMenu();
    });
  }

  if (
    document.querySelector(".tab-btn") &&
    document.querySelector(".product-card")
  ) {
    void import("./productTabs").then(({ initProductTabs }) => {
      initProductTabs();
    });
  }

  if (document.querySelector(".counter-num") && document.getElementById("beneficios")) {
    void import("./counters").then(({ initCounters }) => {
      initCounters();
    });
  }

  if (
    document.querySelector(".fade-in") ||
    document.querySelector(".hero-checks li")
  ) {
    void import("./fadeIn").then(({ initFadeIn }) => {
      initFadeIn();
    });
  }

  const isDesktop =
    "matchMedia" in window && window.matchMedia("(min-width: 1025px)").matches;
  if (isDesktop && !prefersReducedMotion && document.getElementById("hero")) {
    void import("./heroParallax").then(({ initHeroParallax }) => {
      initHeroParallax();
    });
  }

  const canHover =
    "matchMedia" in window &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHover && document.getElementById("cursor")) {
    void import("./customCursor").then(({ initCustomCursor }) => {
      initCustomCursor();
    });
  }

  if (
    !prefersReducedMotion &&
    window.innerWidth > 480 &&
    document.getElementById("hero-particles-canvas") &&
    document.getElementById("hero")
  ) {
    void import("./heroParticles").then(({ initHeroParticles }) => {
      initHeroParticles();
    });
  }

  if (window.location.hash || document.querySelector('a[href^="#"]')) {
    void import("./hashNavigation").then(({ initHashNavigation }) => {
      initHashNavigation();
    });
  }
};

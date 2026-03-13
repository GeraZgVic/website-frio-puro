export const initSiteScripts = (): void => {
  void import("./testimonialsSlider").then(({ initTestimonialsSlider }) => {
    initTestimonialsSlider();
  });
  void import("./navbarScroll").then(({ initNavbarScroll }) => {
    initNavbarScroll();
  });
  void import("./themeColorSections").then(({ initThemeColorSections }) => {
    initThemeColorSections();
  });
  void import("./mobileMenu").then(({ initMobileMenu }) => {
    initMobileMenu();
  });
  void import("./productTabs").then(({ initProductTabs }) => {
    initProductTabs();
  });
  void import("./counters").then(({ initCounters }) => {
    initCounters();
  });
  void import("./fadeIn").then(({ initFadeIn }) => {
    initFadeIn();
  });
  void import("./scrollSpy").then(({ initScrollSpy }) => {
    initScrollSpy();
  });
  void import("./heroParallax").then(({ initHeroParallax }) => {
    initHeroParallax();
  });
  void import("./customCursor").then(({ initCustomCursor }) => {
    initCustomCursor();
  });
  void import("./heroParticles").then(({ initHeroParticles }) => {
    initHeroParticles();
  });
};

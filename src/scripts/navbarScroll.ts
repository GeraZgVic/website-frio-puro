export const initNavbarScroll = (): void => {
  const navbar = document.getElementById("navbar") as HTMLElement | null;
  const backTop = document.getElementById("back-top") as HTMLElement | null;

  const onScroll = (): void => {
    if (window.scrollY > 60) {
      navbar?.classList.add("scrolled");
    } else {
      navbar?.classList.remove("scrolled");
    }

    if (backTop) {
      if (window.scrollY > 300) {
        backTop.classList.add("visible");
      } else {
        backTop.classList.remove("visible");
      }
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
};

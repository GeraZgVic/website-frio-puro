export const initNavbarScroll = (): void => {
  const navbar = document.getElementById("navbar") as HTMLElement | null;
  const backTop = document.getElementById("back-top") as HTMLElement | null;
  const whatsappFab = document.getElementById("whatsapp-fab") as
    | HTMLElement
    | null;

  const onScroll = (): void => {
    if (window.scrollY > 60) {
      navbar?.classList.add("scrolled");
    } else {
      navbar?.classList.remove("scrolled");
    }

    if (backTop) {
      backTop.classList.toggle("visible", window.scrollY > 300);
    }

    if (whatsappFab) {
      whatsappFab.classList.toggle("visible", window.scrollY > 300);
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
};

export const initMobileMenu = (): void => {
  const hamburger = document.getElementById("hamburger") as HTMLElement | null;
  const mobileMenu = document.getElementById("mobileMenu") as HTMLElement | null;
  const body = document.body;

  const setMobileMenuAria = (isOpen: boolean): void => {
    if (hamburger) {
      hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      hamburger.setAttribute(
        "aria-label",
        isOpen ? "Cerrar menú" : "Abrir menú",
      );
    }
    if (mobileMenu) {
      mobileMenu.setAttribute("aria-hidden", isOpen ? "false" : "true");
    }
  };

  const closeMobileMenu = (): void => {
    hamburger?.classList.remove("open");
    mobileMenu?.classList.remove("open");
    body.style.overflow = "";
    setMobileMenuAria(false);
  };

  const openMobileMenu = (): void => {
    hamburger?.classList.add("open");
    mobileMenu?.classList.add("open");
    body.style.overflow = "hidden";
    setMobileMenuAria(true);
  };

  hamburger?.addEventListener("click", (): void => {
    const isOpen = hamburger.classList.contains("open");

    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  document.querySelectorAll<HTMLElement>(".mobile-link").forEach((link) => {
    link.addEventListener("click", (): void => {
      closeMobileMenu();
    });
  });

  document.addEventListener("keydown", (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (hamburger?.classList.contains("open")) {
      closeMobileMenu();
    }
  });

  window.addEventListener("resize", (): void => {
    if (window.innerWidth > 768) {
      closeMobileMenu();
    }
  });
};


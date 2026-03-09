export const initProductTabs = (): void => {
  const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const productCards = document.querySelectorAll<HTMLElement>(".product-card");

  if (tabButtons.length === 0 || productCards.length === 0) {
    return;
  }

  tabButtons.forEach((button: HTMLButtonElement) => {
    button.addEventListener("click", (): void => {
      tabButtons.forEach((item: HTMLButtonElement) => item.classList.remove("active"));
      button.classList.add("active");

      const filter = button.getAttribute("data-filter");

      productCards.forEach((card: HTMLElement) => {
        const type = card.getAttribute("data-type");

        if (filter === "all" || type === filter) {
          card.classList.remove("hidden");
          card.style.opacity = "0";
          card.style.transform = "scale(0.95)";

          window.requestAnimationFrame((): void => {
            window.setTimeout((): void => {
              card.style.opacity = "";
              card.style.transform = "";
            }, 30);
          });
        } else {
          card.style.opacity = "0";
          card.style.transform = "scale(0.95)";

          window.setTimeout((): void => {
            card.classList.add("hidden");
          }, 300);
        }
      });
    });
  });

  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (canHover && !prefersReducedMotion) {
    document
      .querySelectorAll<HTMLElement>(".product-card")
      .forEach((card: HTMLElement) => {
        const inner = card.querySelector<HTMLElement>(".product-card-inner");
        if (!inner) return;

        card.addEventListener("pointermove", (e: PointerEvent): void => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateY = ((x - centerX) / centerX) * 8;
          const rotateX = ((centerY - y) / centerY) * 5;

          inner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener("pointerleave", (): void => {
          inner.style.transform = "perspective(1000px) rotateX(0) rotateY(0)";
        });
      });
  }
};

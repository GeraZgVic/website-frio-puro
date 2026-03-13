export const initTestimonialsSlider = (): void => {
  // ===== SLIDER =====
  const track = document.getElementById("sliderTrack") as HTMLElement | null;
  const dots = document.querySelectorAll<HTMLButtonElement>(".dot");
  const nextBtn = document.getElementById(
    "nextBtn",
  ) as HTMLButtonElement | null;
  const prevBtn = document.getElementById(
    "prevBtn",
  ) as HTMLButtonElement | null;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (!track) return;

  let currentSlide = 0;
  const totalSlides =
    document.querySelectorAll<HTMLElement>(".testimonial-slide").length;
  if (totalSlides === 0) return;
  let autoSlide: number | undefined;

  const goToSlide = (index: number): void => {
    currentSlide = (index + totalSlides) % totalSlides;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    dots.forEach((dot: HTMLButtonElement, dotIndex: number) => {
      const isActive = dotIndex === currentSlide;
      dot.classList.toggle("active", isActive);
      if (isActive) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });
  };

  const stopAuto = (): void => {
    if (autoSlide !== undefined) {
      window.clearInterval(autoSlide);
    }
  };

  const startAuto = (): void => {
    if (prefersReducedMotion) {
      stopAuto();
      return;
    }
    stopAuto();
    autoSlide = window.setInterval((): void => {
      goToSlide(currentSlide + 1);
    }, 4000);
  };

  nextBtn?.addEventListener("click", (): void => {
    stopAuto();
    goToSlide(currentSlide + 1);
    startAuto();
  });

  prevBtn?.addEventListener("click", (): void => {
    stopAuto();
    goToSlide(currentSlide - 1);
    startAuto();
  });

  dots.forEach((dot: HTMLButtonElement, index: number) => {
    dot.addEventListener("click", (): void => {
      stopAuto();
      goToSlide(index);
      startAuto();
    });

    dot.addEventListener("keydown", (event: KeyboardEvent): void => {
      const key = event.key;
      if (
        key !== "ArrowLeft" &&
        key !== "ArrowRight" &&
        key !== "Home" &&
        key !== "End"
      ) {
        return;
      }

      event.preventDefault();

      let nextIndex = index;
      if (key === "ArrowLeft") nextIndex = index - 1;
      if (key === "ArrowRight") nextIndex = index + 1;
      if (key === "Home") nextIndex = 0;
      if (key === "End") nextIndex = totalSlides - 1;

      stopAuto();
      goToSlide(nextIndex);
      dots[currentSlide]?.focus();
      startAuto();
    });
  });

  goToSlide(0);
  startAuto();

  document.addEventListener("visibilitychange", (): void => {
    if (prefersReducedMotion || document.visibilityState === "hidden") {
      stopAuto();
    } else {
      startAuto();
    }
  });
};

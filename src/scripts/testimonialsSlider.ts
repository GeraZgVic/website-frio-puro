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

  if (!track) return;

  let currentSlide = 0;
  const totalSlides =
    document.querySelectorAll<HTMLElement>(".testimonial-slide").length;
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
  });

  startAuto();

  document.addEventListener("visibilitychange", (): void => {
    if (document.visibilityState === "hidden") {
      stopAuto();
    } else {
      startAuto();
    }
  });
};

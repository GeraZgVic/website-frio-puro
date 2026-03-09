export const initCustomCursor = (): void => {
  const cursor = document.getElementById("cursor") as HTMLDivElement | null;
  const cursorRing = document.getElementById(
    "cursor-ring",
  ) as HTMLDivElement | null;
  const canHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;

  if (!cursor || !cursorRing || !canHover) {
    return;
  }

  let pageVisible = document.visibilityState === "visible";
  let mouseX: number = window.innerWidth / 2;
  let mouseY: number = window.innerHeight / 2;
  let ringX: number = mouseX;
  let ringY: number = mouseY;
  let cursorRafId: number | undefined;

  const showCursor = (): void => {
    cursor.classList.add("is-visible");
    cursorRing.classList.add("is-visible");
  };

  const moveCursor = (e: PointerEvent): void => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    cursor.style.left = `${mouseX}px`;
    cursor.style.top = `${mouseY}px`;

    showCursor();
  };

  const animateRing = (): void => {
    if (!pageVisible) {
      cursorRafId = undefined;
      return;
    }

    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;

    cursorRing.style.left = `${ringX}px`;
    cursorRing.style.top = `${ringY}px`;

    cursorRafId = window.requestAnimationFrame(animateRing);
  };

  const bindCursorHoverTargets = (): void => {
    document
      .querySelectorAll<HTMLElement>(
        "a, button, .tab-btn, .dot, .client-card, .card, .interactive, input, textarea, select, label",
      )
      .forEach((el: HTMLElement) => {
        el.addEventListener("pointerenter", (): void => {
          cursor.classList.add("hover");
          cursorRing.classList.add("hover");
        });

        el.addEventListener("pointerleave", (): void => {
          cursor.classList.remove("hover");
          cursorRing.classList.remove("hover");
        });
      });
  };

  document.addEventListener("visibilitychange", (): void => {
    pageVisible = document.visibilityState === "visible";
    if (!pageVisible && cursorRafId !== undefined) {
      window.cancelAnimationFrame(cursorRafId);
      cursorRafId = undefined;
    }
    if (pageVisible && cursorRafId === undefined) {
      animateRing();
    }
  });

  document.addEventListener("pointermove", moveCursor, { passive: true });
  document.addEventListener("pointerdown", (): void => {
    cursor.style.transform = "translate3d(-50%, -50%, 0) scale(0.88)";
    cursorRing.style.transform = "translate3d(-50%, -50%, 0) scale(0.92)";
  });
  document.addEventListener("pointerup", (): void => {
    cursor.style.transform = "";
    cursorRing.style.transform = "";
  });
  document.addEventListener("pointerleave", (): void => {
    cursor.classList.remove("is-visible", "hover");
    cursorRing.classList.remove("is-visible", "hover");
  });

  bindCursorHoverTargets();
  animateRing();
};

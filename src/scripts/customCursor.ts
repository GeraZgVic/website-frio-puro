export const initCustomCursor = (): void => {
  const cursor = document.getElementById("cursor") as HTMLDivElement | null;
  const canHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;

  if (!cursor || !canHover) {
    return;
  }

  let pageVisible = document.visibilityState === "visible";

  const showCursor = (): void => {
    cursor.classList.add("is-visible");
  };

  const moveCursor = (e: PointerEvent): void => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;

    showCursor();
  };

  const bindCursorHoverTargets = (): void => {
    document
      .querySelectorAll<HTMLElement>(
        "a, button, .tab-btn, .dot, .client-card, .card, .interactive, input, textarea, select, label",
      )
      .forEach((el: HTMLElement) => {
        el.addEventListener("pointerenter", (): void => {
          cursor.classList.add("hover");
        });

        el.addEventListener("pointerleave", (): void => {
          cursor.classList.remove("hover");
        });
      });
  };

  document.addEventListener("visibilitychange", (): void => {
    pageVisible = document.visibilityState === "visible";
    if (!pageVisible) cursor.classList.remove("is-visible", "hover");
  });

  document.addEventListener("pointermove", moveCursor, { passive: true });
  document.addEventListener("pointerdown", (): void => {
    cursor.style.transform = "translate3d(-50%, -50%, 0) scale(0.88)";
  });
  document.addEventListener("pointerup", (): void => {
    cursor.style.transform = "";
  });
  document.addEventListener("pointerleave", (): void => {
    cursor.classList.remove("is-visible", "hover");
  });

  bindCursorHoverTargets();
};

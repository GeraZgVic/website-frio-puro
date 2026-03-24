import type { ThemeSectionChangeDetail } from "./themeColorSections";

const THEME_SECTION_CHANGE_EVENT = "theme:section-change";

const isThemeSectionChangeEvent = (
  event: Event,
): event is CustomEvent<ThemeSectionChangeDetail> => {
  return event instanceof CustomEvent && typeof event.detail === "object" && event.detail !== null;
};

export const initScrollSpy = (): void => {
  const navLinks = document.querySelectorAll<HTMLAnchorElement>(".nav-link");
  if (navLinks.length === 0) return;

  const setActiveById = (id: string): void => {
    if (!id) return;
    const href = `#${id}`;

    let hasMatch = false;
    for (const link of navLinks) {
      if (link.getAttribute("href") === href) {
        hasMatch = true;
        break;
      }
    }

    if (!hasMatch) return;

    for (const link of navLinks) {
      link.classList.toggle("active", link.getAttribute("href") === href);
    }
  };

  const applyFromDetail = (detail: ThemeSectionChangeDetail): void => {
    setActiveById(detail.navId || detail.id);
  };

  const syncFromHash = (): void => {
    const hash = window.location.hash;
    if (!hash) return;
    setActiveById(hash.replace("#", ""));
  };

  const last = (
    window as typeof window & {
      __frioPuroThemeSection?: ThemeSectionChangeDetail;
    }
  ).__frioPuroThemeSection;

  if (last) applyFromDetail(last);
  else syncFromHash();

  window.addEventListener(
    THEME_SECTION_CHANGE_EVENT,
    (event: Event) => {
      if (!isThemeSectionChangeEvent(event)) return;
      applyFromDetail(event.detail);
    },
    { passive: true },
  );

  window.addEventListener("hashchange", syncFromHash, { passive: true });
};

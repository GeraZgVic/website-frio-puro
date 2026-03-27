type PendingHashPayload = {
  hash: string;
  ts: number;
  pathname: string;
  search: string;
};

const PENDING_HASH_KEY = "__frioPuroPendingHash";
const PENDING_HASH_TTL_MS = 12_000;

const prefersReducedMotion = (): boolean => {
  if (!("matchMedia" in window)) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const getNavbarOffsetPx = (): number => {
  const navbar = document.getElementById("navbar");
  if (!navbar) return 0;

  const rect = navbar.getBoundingClientRect();
  const styles = window.getComputedStyle(navbar);
  const top = Number.parseFloat(styles.top || "0");
  const topPx = Number.isFinite(top) ? top : 0;

  // Extra cushion to avoid the section title touching the navbar edge.
  return Math.ceil(rect.height + topPx + 14);
};

const setCssNavOffset = (offsetPx: number): void => {
  if (!offsetPx) return;
  document.documentElement.style.setProperty("--nav-offset-px", `${offsetPx}px`);
};

const findTargetForHash = (hash: string): HTMLElement | null => {
  if (!hash || hash === "#") return null;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const id = decodeURIComponent(raw);
  if (!id) return null;

  const elById = document.getElementById(id);
  if (elById instanceof HTMLElement) return elById;

  // Back-compat: corporate form anchor (avoid requiring an explicit ID in markup).
  if (id === "formulario-corporativo") {
    const card = document.querySelector(".form-card");
    if (card instanceof HTMLElement) return card;

    const form = document.getElementById("corpQuoteForm");
    if (form instanceof HTMLElement) return form;
  }

  // Support legacy named anchors.
  const named = document.querySelector(`[name="${CSS.escape(id)}"]`);
  return named instanceof HTMLElement ? named : null;
};

const waitForDomStable = async (): Promise<void> => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  if ("fonts" in document && "ready" in document.fonts) {
    await document.fonts.ready.catch(() => undefined);
  }

  await new Promise<void>((resolve) => setTimeout(resolve, 40));
};

const scrollToElementWithOffset = async (
  el: HTMLElement,
  opts?: { offsetPx?: number; behavior?: ScrollBehavior },
): Promise<void> => {
  const offsetPx = opts?.offsetPx ?? getNavbarOffsetPx();
  setCssNavOffset(offsetPx);

  const behavior: ScrollBehavior =
    prefersReducedMotion() ? "auto" : (opts?.behavior ?? "smooth");

  const startY = window.scrollY || 0;
  const targetY = startY + el.getBoundingClientRect().top - offsetPx;
  const clampedTargetY = Math.max(0, Math.round(targetY));

  window.scrollTo({ top: clampedTargetY, behavior });

  const distance = Math.abs(clampedTargetY - startY);
  const settleMs = prefersReducedMotion()
    ? 0
    : Math.min(950, Math.max(320, Math.round(distance * 0.32)));

  if (settleMs) {
    await new Promise<void>((resolve) => setTimeout(resolve, settleMs));
  }

  // Corrective pass in case late-loading assets shift layout.
  const correctedTargetY =
    (window.scrollY || 0) + el.getBoundingClientRect().top - offsetPx;
  const corrected = Math.max(0, Math.round(correctedTargetY));
  const delta = Math.abs(corrected - (window.scrollY || 0));
  if (delta > 6) {
    window.scrollTo({ top: corrected, behavior: "auto" });
  }
};

const focusFirstField = (root: HTMLElement): void => {
  const active = document.activeElement;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
  ) {
    return;
  }

  const candidate = root.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
  );
  if (!candidate) return;

  try {
    candidate.focus({ preventScroll: true });
  } catch {
    candidate.focus();
  }
};

const dispatchHashChange = (): void => {
  try {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } catch {
    window.dispatchEvent(new Event("hashchange"));
  }
};

const readPendingHash = (): PendingHashPayload | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_HASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingHashPayload>;
    if (typeof parsed?.hash !== "string") return null;
    if (typeof parsed?.ts !== "number") return null;
    if (typeof parsed?.pathname !== "string") return null;
    if (typeof parsed?.search !== "string") return null;
    return parsed as PendingHashPayload;
  } catch {
    return null;
  }
};

const clearPendingHash = (): void => {
  try {
    sessionStorage.removeItem(PENDING_HASH_KEY);
  } catch {
    // ignore
  }
};

export const scrollToHashTarget = async (
  hash: string,
  opts?: { focus?: boolean; offsetPx?: number },
): Promise<boolean> => {
  await waitForDomStable();

  // Retry briefly (in case the target is rendered after initial paint).
  let target: HTMLElement | null = null;
  for (let i = 0; i < 14; i += 1) {
    target = findTargetForHash(hash);
    if (target) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 60));
  }

  if (!target) return false;

  await scrollToElementWithOffset(target, { offsetPx: opts?.offsetPx });

  if (opts?.focus) {
    focusFirstField(target);
  }

  return true;
};

export const initHashNavigation = (): void => {
  let suppressNextHashScroll = false;

  const applyHashNavigation = async (hash: string, mode: "replace" | "push") => {
    if (!hash || hash === "#") return;

    const shouldFocus = hash === "#formulario-corporativo";

    suppressNextHashScroll = true;
    if (mode === "push") {
      history.pushState(null, "", window.location.pathname + window.location.search + hash);
    } else {
      history.replaceState(null, "", window.location.pathname + window.location.search + hash);
    }
    dispatchHashChange();
    suppressNextHashScroll = false;

    await scrollToHashTarget(hash, { focus: shouldFocus });
  };

  const pending = readPendingHash();
  if (
    pending &&
    pending.pathname === window.location.pathname &&
    Date.now() - pending.ts <= PENDING_HASH_TTL_MS
  ) {
    clearPendingHash();
    void applyHashNavigation(pending.hash, "replace");
  } else if (window.location.hash) {
    void applyHashNavigation(window.location.hash, "replace");
  }

  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("data-no-smooth-scroll")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Same-page hash navigation: handle with offset + smooth scroll.
      if (href.startsWith("#")) {
        if (href === "#") return;
        event.preventDefault();
        void applyHashNavigation(href, "push");
        return;
      }
    },
    { capture: true },
  );

  window.addEventListener("hashchange", () => {
    if (suppressNextHashScroll) return;
    if (!window.location.hash) return;
    void scrollToHashTarget(window.location.hash, {
      focus: window.location.hash === "#formulario-corporativo",
    });
  });

  window.addEventListener("popstate", () => {
    if (!window.location.hash) return;
    void scrollToHashTarget(window.location.hash, {
      focus: window.location.hash === "#formulario-corporativo",
    });
  });
};

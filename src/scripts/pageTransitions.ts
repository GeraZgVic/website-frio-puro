type PageTransitionPayload = {
  ts: number;
  href: string;
  variant?: string;
  fromPath?: string;
  toPath?: string;
};

const PAGE_TRANSITION_KEY = "__frioPuroPageTransition";
const PAGE_TRANSITION_TTL_MS = 12_000;

const isCriticalPathname = (pathname: string): boolean => {
  const clean = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return clean === "/" || clean === "/cotizacion-corporativa";
};

const prefersReducedMotion = (): boolean => {
  if (!("matchMedia" in window)) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const isSameOrigin = (url: URL): boolean => url.origin === window.location.origin;

const getBaseDocumentHref = (url: URL): string => `${url.origin}${url.pathname}${url.search}`;

const isModifiedClick = (event: MouseEvent): boolean =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

const isEligibleAnchor = (anchor: HTMLAnchorElement): boolean => {
  if (anchor.hasAttribute("download")) return false;
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return false;
  const rel = (anchor.getAttribute("rel") || "").toLowerCase();
  if (rel.includes("external")) return false;
  if (anchor.hasAttribute("data-no-page-transition")) return false;
  return true;
};

const isTransitionScoped = (anchor: HTMLAnchorElement): boolean => {
  if (anchor.hasAttribute("data-page-transition")) return true;
  return Boolean(anchor.closest("#navbar, #mobileMenu, .mobile-menu"));
};

const sanitizeVariant = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const readPayload = (): PageTransitionPayload | null => {
  try {
    const raw = sessionStorage.getItem(PAGE_TRANSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PageTransitionPayload>;
    if (typeof parsed?.ts !== "number") return null;
    if (typeof parsed?.href !== "string") return null;
    return parsed as PageTransitionPayload;
  } catch {
    return null;
  }
};

const writePayload = (href: string): void => {
  try {
    const payload: PageTransitionPayload = { ts: Date.now(), href };
    sessionStorage.setItem(PAGE_TRANSITION_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
};

const writePayloadWithMeta = (
  href: string,
  meta: { variant?: string; fromPath?: string; toPath?: string },
): void => {
  try {
    const payload: PageTransitionPayload = {
      ts: Date.now(),
      href,
      variant: meta.variant,
      fromPath: meta.fromPath,
      toPath: meta.toPath,
    };
    sessionStorage.setItem(PAGE_TRANSITION_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
};

const clearPayload = (): void => {
  try {
    sessionStorage.removeItem(PAGE_TRANSITION_KEY);
  } catch {
    // ignore
  }
};

const shouldPlayEnterTransition = (): boolean => {
  const payload = readPayload();
  if (!payload) return false;
  if (Date.now() - payload.ts > PAGE_TRANSITION_TTL_MS) {
    clearPayload();
    return false;
  }
  // Payload is cleared by BaseLayout early script after it adds the class.
  return true;
};

const prefetchDocument = (href: string): void => {
  try {
    const url = new URL(href, window.location.href);
    if (!isSameOrigin(url)) return;
    if (!isCriticalPathname(url.pathname)) return;

    const base = getBaseDocumentHref(url);
    if (base === getBaseDocumentHref(new URL(window.location.href))) return;

    if (document.querySelector(`link[rel="prefetch"][href="${CSS.escape(base)}"]`)) return;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = base;
    document.head.appendChild(link);
  } catch {
    // ignore
  }
};

const runLeaveTransition = async (): Promise<void> => {
  const root = document.documentElement;
  root.classList.add("pt-leave");

  // Failsafe: if navigation is interrupted, never leave UI in a washed transition state.
  window.setTimeout(() => {
    root.classList.remove("pt-enter");
    root.classList.remove("pt-leave");
    root.classList.forEach((c) => {
      if (c.startsWith("pt-variant-")) root.classList.remove(c);
    });
  }, 700);

  if (prefersReducedMotion()) return;

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 150);
  });
};

export const initPageTransitions = (): void => {
  // No-op if reduced motion. Keep prefetch though.
  const root = document.documentElement;

  // Hard failsafe: never keep transition classes beyond a short window.
  window.setTimeout(() => {
    root.classList.remove("pt-enter");
    root.classList.remove("pt-leave");
    root.classList.forEach((c) => {
      if (c.startsWith("pt-variant-")) root.classList.remove(c);
    });
  }, 900);

  // If we landed here via an enhanced transition, ensure the "enter" class is removed
  // (BaseLayout adds it; this is a safety net for edge cases like bfcache restores).
  if (shouldPlayEnterTransition()) {
    window.addEventListener(
      "pageshow",
      () => {
        root.classList.remove("pt-enter");
      },
      { once: true },
    );
  }

  document.addEventListener(
    "pointerenter",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isEligibleAnchor(anchor)) return;
      if (!isTransitionScoped(anchor)) return;
      if (!anchor.href) return;
      prefetchDocument(anchor.href);
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "touchstart",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isEligibleAnchor(anchor)) return;
      if (!isTransitionScoped(anchor)) return;
      if (!anchor.href) return;
      prefetchDocument(anchor.href);
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!(event instanceof MouseEvent)) return;
      if (event.defaultPrevented) return;
      if (isModifiedClick(event)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isEligibleAnchor(anchor)) return;
      if (!isTransitionScoped(anchor)) return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr) return;
      // Same-page hashes are handled by hashNavigation.ts
      if (hrefAttr.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (!isSameOrigin(url)) return;
      if (!isCriticalPathname(url.pathname)) return;

      const current = new URL(window.location.href);
      if (!isCriticalPathname(current.pathname)) return;
      const nextBase = `${url.pathname}${url.search}`;
      const currentBase = `${current.pathname}${current.search}`;
      if (nextBase === currentBase) return;

      event.preventDefault();

      const declaredVariant = anchor.getAttribute("data-page-transition") || "";
      const fromPath = current.pathname;
      const toPath = url.pathname;
      const inferredVariant =
        isCriticalPathname(fromPath) && isCriticalPathname(toPath)
          ? fromPath.startsWith("/cotizacion-corporativa") && toPath === "/"
            ? "corporate-to-home"
            : fromPath === "/" && toPath.startsWith("/cotizacion-corporativa")
              ? "home-to-corporate"
              : "route-change"
          : "route-change";

      const variant = sanitizeVariant(declaredVariant) || inferredVariant;

      writePayloadWithMeta(url.href, { variant, fromPath, toPath });

      void (async () => {
        await runLeaveTransition();
        window.location.assign(url.href);
      })();
    },
    { capture: true },
  );

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    root.classList.remove("pt-leave");
  });
};

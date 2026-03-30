type ThemeTarget = {
  selector: string;
  el: Element;
  color: string;
  navMode: 'dark' | 'light';
  navId: string;
};

type Candidate = {
  target: ThemeTarget;
  score: number;
  viewportCoverage: number;
  containsLeadLine: boolean;
  containsCenterLine: boolean;
};

export type ThemeSectionChangeDetail = {
  id: string;
  navId: string;
  selector: string;
  color: string;
  navMode: 'dark' | 'light';
  element: Element;
};

const THEME_SECTION_CHANGE_EVENT = 'theme:section-change';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const distanceToVerticalLine = (top: number, bottom: number, y: number): number => {
  if (y < top) return top - y;
  if (y > bottom) return y - bottom;
  return 0;
};

const computeViewportCoverage = (rect: DOMRect, viewportHeight: number): number => {
  const visiblePx = Math.max(
    0,
    Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0),
  );
  return clamp01(visiblePx / Math.max(1, viewportHeight));
};

const getStableIdForTarget = (target: ThemeTarget): string => {
  if (target.el instanceof HTMLElement && target.el.id) return target.el.id;
  if (target.selector.startsWith('#')) return target.selector.slice(1);
  return target.selector;
};

export const initThemeColorSections = (): void => {
  const themeMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  if (!themeMeta || !('IntersectionObserver' in window)) return;

  const rootStyle = getComputedStyle(document.documentElement);

  const colors = {
    dark: rootStyle.getPropertyValue('--color-dark').trim() || '#1a1f4e',
    primary: rootStyle.getPropertyValue('--color-primary').trim() || '#323b81',
    footer: rootStyle.getPropertyValue('--color-footer').trim() || '#0d1240',
  };

  // Nota: `#proceso` existe en el DOM (Process.astro) y no estaba incluido.
  const sectionColors: Array<{
    selector: string;
    color: string;
    navMode: 'dark' | 'light';
    navId: string;
  }> = [
    { selector: '#inicio', color: colors.dark, navMode: 'dark', navId: 'inicio' },
    { selector: '#clientes', color: colors.primary, navMode: 'light', navId: 'clientes' },
    { selector: '#productos', color: colors.primary, navMode: 'light', navId: 'productos' },
    { selector: '#proceso', color: colors.primary, navMode: 'light', navId: 'proceso' },
    { selector: '#como-pedir', color: colors.primary, navMode: 'dark', navId: 'proceso' },
    { selector: '#beneficios', color: colors.primary, navMode: 'light', navId: 'proceso' },
    { selector: '#cobertura', color: colors.primary, navMode: 'light', navId: 'proceso' },
    { selector: '#testimonios', color: colors.primary, navMode: 'light', navId: 'proceso' },
    { selector: '#contacto', color: colors.primary, navMode: 'dark', navId: 'contacto' },
    { selector: 'footer', color: colors.footer, navMode: 'dark', navId: 'contacto' },
  ];

  const targets: ThemeTarget[] = [];

  for (const { selector, color, navMode, navId } of sectionColors) {
    const el = document.querySelector(selector);
    if (el) targets.push({ selector, el, color, navMode, navId });
  }

  if (targets.length === 0) return;

  // IntersectionObserver se usa solo para saber que secciones estan "cerca" del viewport
  // y para disparar recalculos: la decision final se basa en geometria real del viewport.
  const ioRatios = new Map<Element, number>();
  const nearby = new Set<Element>();

  let currentColor = themeMeta.getAttribute('content') || '';
  let currentTargetEl: Element | null = null;
  let currentTargetId = '';
  let rafId = 0;
  let lastSwitchAt = 0;
  let lastScrollY = window.scrollY || 0;
  let scrollDir: -1 | 1 = 1;

  const SWITCH_COOLDOWN_MS = 110;
  const MIN_VIEWPORT_COVERAGE = 0.08;
  const SWITCH_MARGIN = 0.08;
  const HERO_LOCK_EXIT_GAP_PX = 8;

  // "Premium feel": el navbar vive en la parte superior, asi que priorizamos una
  // linea de activacion cercana al area del navbar (no el centro completo del viewport).
  // Esto reduce la sensacion de "desfase" entre el fondo real detras del navbar y
  // el modo/material que adopta al cambiar de seccion.
  const CENTER_LINE_RATIO = 0.5;
  const LEAD_LINE_RATIO = 0.32;
  const NAV_LEAD_LINE_DOWN_PX = 110;
  const NAV_LEAD_LINE_UP_PX = 64;
  const NAV_LEAD_LINE_MIN_PX = 44;

  const setThemeColorIfChanged = (color: string, el: Element): void => {
    if (!color || color === currentColor) return;

    const now = performance.now();
    if (now - lastSwitchAt < SWITCH_COOLDOWN_MS) return;

    themeMeta.setAttribute('content', color);
    currentColor = color;
    currentTargetEl = el;
    lastSwitchAt = now;
  };

  const emitSectionChange = (target: ThemeTarget): void => {
    const id = getStableIdForTarget(target);
    if (!id || id === currentTargetId) return;

    currentTargetId = id;

    const detail: ThemeSectionChangeDetail = {
      id,
      navId: target.navId,
      selector: target.selector,
      color: target.color,
      navMode: target.navMode,
      element: target.el,
    };

    (
      window as typeof window & {
        __frioPuroThemeSection?: ThemeSectionChangeDetail;
      }
    ).__frioPuroThemeSection = detail;

    window.dispatchEvent(
      new CustomEvent<ThemeSectionChangeDetail>(THEME_SECTION_CHANGE_EVENT, {
        detail,
      }),
    );
  };

  const getCandidateForTarget = (
    target: ThemeTarget,
    viewportHeight: number,
    leadLineY: number,
    centerLineY: number,
  ): Candidate | null => {
    const rect = target.el.getBoundingClientRect();
    const viewportCoverage = computeViewportCoverage(rect, viewportHeight);
    if (viewportCoverage <= 0) return null;

    const distLead = distanceToVerticalLine(rect.top, rect.bottom, leadLineY);
    const distCenter = distanceToVerticalLine(rect.top, rect.bottom, centerLineY);

    const containsLeadLine = distLead === 0;
    const containsCenterLine = distCenter === 0;

    const leadCloseness = 1 - clamp01(distLead / (viewportHeight * 0.7));
    const centerCloseness = 1 - clamp01(distCenter / (viewportHeight * 0.85));

    const ioRatio = ioRatios.get(target.el) ?? 0;

    // Score compuesto:
    // - cobertura real del viewport (evita que secciones gigantes dominen por ratio IO)
    // - cercania al centro del viewport
    // - cercania a la linea de activacion (para transiciones mas naturales)
    // - IO ratio como senal secundaria (suaviza decisiones cuando hay empates)
    let score =
      viewportCoverage * 0.5 +
      leadCloseness * 0.3 +
      centerCloseness * 0.18 +
      clamp01(ioRatio) * 0.02;

    // Boost claro cuando una seccion ya "toma" la zona de lectura principal.
    if (containsLeadLine) score += 0.32;

    return { target, score, viewportCoverage, containsLeadLine, containsCenterLine };
  };

  const pickDominant = (): void => {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (viewportHeight <= 0) return;

    const scrollY = window.scrollY || 0;
    const scrollDelta = scrollY - lastScrollY;
    // Deadzone avoids jitter when the scroll position oscillates by sub-pixel.
    if (Math.abs(scrollDelta) >= 2) scrollDir = scrollDelta > 0 ? 1 : -1;
    lastScrollY = scrollY;

    const centerLineY = viewportHeight * CENTER_LINE_RATIO;
    const leadLinePxCap = scrollDir < 0 ? NAV_LEAD_LINE_UP_PX : NAV_LEAD_LINE_DOWN_PX;
    const leadLineY = Math.max(
      NAV_LEAD_LINE_MIN_PX,
      Math.min(viewportHeight * LEAD_LINE_RATIO, leadLinePxCap),
    );

    // Hero lock: mientras el lead line siga dentro del hero, no dejamos que el navbar/theme
    // mute por secciones que "asoman". El cambio ocurre cuando el hero realmente termina.
    let heroTarget: ThemeTarget | null = null;
    for (const target of targets) {
      if (target.selector === '#inicio') {
        heroTarget = target;
        break;
      }
    }

    if (heroTarget) {
      const heroRect = heroTarget.el.getBoundingClientRect();
      const heroStillOwnsLeadLine =
        heroRect.bottom > leadLineY + HERO_LOCK_EXIT_GAP_PX &&
        heroRect.top < viewportHeight - HERO_LOCK_EXIT_GAP_PX;

      if (heroStillOwnsLeadLine) {
        const heroCandidate = getCandidateForTarget(
          heroTarget,
          viewportHeight,
          leadLineY,
          centerLineY,
        );

        if (heroCandidate && heroCandidate.viewportCoverage > 0) {
          currentTargetEl = heroTarget.el;
          emitSectionChange(heroTarget);
          setThemeColorIfChanged(heroTarget.color, heroTarget.el);
          return;
        }
      }
    }

    const candidatesSource: ThemeTarget[] = [];

    // Preferimos evaluar solo candidatos cercanos; si por cualquier razon esta vacio,
    // se evaluan todos (son pocos, y es seguro).
    for (const target of targets) {
      if (nearby.size === 0 || nearby.has(target.el)) candidatesSource.push(target);
    }

    let best: Candidate | null = null;
    let current: Candidate | null = null;

    for (const target of candidatesSource) {
      const candidate = getCandidateForTarget(
        target,
        viewportHeight,
        leadLineY,
        centerLineY,
      );

      if (!candidate) continue;

      if (currentTargetEl && target.el === currentTargetEl) {
        current = candidate;
      }

      if (best === null || candidate.score > best.score) {
        best = candidate;
      }
    }

    if (!best) return;
    if (best.viewportCoverage < MIN_VIEWPORT_COVERAGE && !best.containsLeadLine) return;

    const isSwitchCandidate = currentTargetEl !== null && best.target.el !== currentTargetEl;

    if (isSwitchCandidate && current) {
      const shouldSwitch =
        // Si la nueva seccion ya cruzo la linea de activacion y la actual no, cambiamos rapido.
        (best.containsLeadLine && !current.containsLeadLine) ||
        // Si el score supera por un margen, cambiamos estable (evita flicker en empates).
        best.score >= current.score + SWITCH_MARGIN ||
        // Si la actual ya casi no cubre viewport, dejamos que la mejor gane.
        (current.viewportCoverage < MIN_VIEWPORT_COVERAGE &&
          best.viewportCoverage >= MIN_VIEWPORT_COVERAGE);

      if (!shouldSwitch) return;
    }

    if (currentTargetEl === null || best.target.el !== currentTargetEl) {
      currentTargetEl = best.target.el;
    }

    emitSectionChange(best.target);
    setThemeColorIfChanged(best.target.color, best.target.el);
  };

  const schedulePick = (): void => {
    if (rafId !== 0) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      pickDominant();
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        ioRatios.set(entry.target, entry.intersectionRatio);
        if (entry.isIntersecting) nearby.add(entry.target);
        else nearby.delete(entry.target);
      }

      schedulePick();
    },
    {
      // Margen amplio para que la siguiente seccion sea "candidata" desde antes
      // (el calculo real de dominancia lo hace `pickDominant()`).
      rootMargin: '45% 0px 45% 0px',
      threshold: [0, 0.01, 0.08, 0.16, 0.28, 0.46, 0.64, 0.82, 1],
    },
  );

  for (const { el } of targets) observer.observe(el);

  window.addEventListener('scroll', schedulePick, { passive: true });
  window.addEventListener('resize', schedulePick);

  const onPageHide = (): void => {
    window.removeEventListener('scroll', schedulePick);
    window.removeEventListener('resize', schedulePick);
    window.removeEventListener('pagehide', onPageHide);
    observer.disconnect();
    if (rafId !== 0) cancelAnimationFrame(rafId);
  };

  window.addEventListener('pagehide', onPageHide, { once: true });

  schedulePick();
};

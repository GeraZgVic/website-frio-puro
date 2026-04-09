type ParticleShape = "crystal" | "dot";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  fadeSpeed: number;
  rotation: number;
  rotSpeed: number;
  shape: ParticleShape;
}

export const initHeroParticles = (): void => {
  const canvas = document.getElementById(
    "hero-particles-canvas",
  ) as HTMLCanvasElement | null;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const heroElement = document.getElementById("hero") as HTMLElement | null;

  // Lightweight perf guard: avoid running the canvas animation on small screens.
  if (window.innerWidth <= 480) {
    return;
  }

  if (!canvas || prefersReducedMotion || !heroElement) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  let particles: Particle[] = [];
  let resizeTimeout: number | undefined;
  let animationFrameId: number | undefined;
  let heroVisible = true;
  let pageVisible = document.visibilityState === "visible";

  const getParticleTargetCount = (): number => {
    if (window.innerWidth <= 640) return 24;
    if (window.innerWidth <= 768) return 28;
    if (window.innerWidth <= 1024) return 40;
    return 60;
  };

  const resizeCanvas = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  const resetParticle = (particle: Particle, fromBottom = false): void => {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    particle.x = Math.random() * width;
    particle.y = fromBottom
      ? height + Math.random() * 40
      : Math.random() * height;
    particle.size = Math.random() * 4 + 1.5;
    particle.speedX = (Math.random() - 0.5) * 0.28;
    particle.speedY = Math.random() * 0.38 + 0.16;
    particle.opacity = Math.random() * 0.32 + 0.12;
    particle.fadeSpeed = Math.random() * 0.0008 + 0.00035;
    particle.rotation = Math.random() * Math.PI * 2;
    particle.rotSpeed = (Math.random() - 0.5) * 0.008;
    particle.shape = Math.random() > 0.62 ? "crystal" : "dot";
  };

  const createParticle = (fromBottom = false): Particle => {
    const particle: Particle = {
      x: 0,
      y: 0,
      size: 0,
      speedX: 0,
      speedY: 0,
      opacity: 0,
      fadeSpeed: 0,
      rotation: 0,
      rotSpeed: 0,
      shape: "dot",
    };

    resetParticle(particle, fromBottom);
    return particle;
  };

  const syncParticleCount = (): void => {
    const targetCount = getParticleTargetCount();

    if (particles.length > targetCount) {
      particles = particles.slice(0, targetCount);
      return;
    }

    while (particles.length < targetCount) {
      particles.push(createParticle());
    }
  };

  const updateParticle = (particle: Particle): void => {
    particle.x += particle.speedX;
    particle.y += particle.speedY;
    particle.rotation += particle.rotSpeed;
    particle.opacity -= particle.fadeSpeed;

    if (
      particle.y > canvas.offsetHeight + 30 ||
      particle.x < -30 ||
      particle.x > canvas.offsetWidth + 30 ||
      particle.opacity <= 0
    ) {
      resetParticle(particle, false);
    }
  };

  const drawParticle = (particle: Particle): void => {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.globalAlpha = particle.opacity;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(157, 212, 242, 0.32)";

    if (particle.shape === "crystal") {
      ctx.strokeStyle = "rgba(210, 240, 255, 0.72)";
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(angle) * particle.size,
          Math.sin(angle) * particle.size,
        );
      }

      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(110, 210, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const animateParticles = (): void => {
    if (!pageVisible || !heroVisible) return;

    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    for (const particle of particles) {
      updateParticle(particle);
      drawParticle(particle);
    }

    animationFrameId = window.requestAnimationFrame(animateParticles);
  };

  const startParticles = (): void => {
    if (animationFrameId === undefined) {
      animationFrameId = window.requestAnimationFrame(animateParticles);
    }
  };

  const stopParticles = (): void => {
    if (animationFrameId !== undefined) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = undefined;
    }
  };

  resizeCanvas();
  syncParticleCount();

  for (let i = 0; i < particles.length; i++) {
    particles[i].y = Math.random() * canvas.offsetHeight;
  }

  const heroObserver = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]): void => {
      heroVisible = !!entries[0]?.isIntersecting;
      if (pageVisible && heroVisible) {
        startParticles();
      } else {
        stopParticles();
      }
    },
    { threshold: 0.05 },
  );

  heroObserver.observe(heroElement);

  document.addEventListener("visibilitychange", (): void => {
    pageVisible = document.visibilityState === "visible";
    if (pageVisible && heroVisible) {
      startParticles();
    } else {
      stopParticles();
    }
  });

  startParticles();

  window.addEventListener("resize", (): void => {
    if (resizeTimeout) window.clearTimeout(resizeTimeout);

    resizeTimeout = window.setTimeout((): void => {
      resizeCanvas();
      syncParticleCount();
    }, 120);
  });

  window.addEventListener("beforeunload", (): void => {
    stopParticles();
  });
};

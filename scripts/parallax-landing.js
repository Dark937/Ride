document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("js-reveal");

    const revealElements = document.querySelectorAll(".reveal");
    const motionElements = document.querySelectorAll(
      ".scroll-fade-up, .scroll-slide-left, .scroll-slide-right, .scroll-zoom"
    );

    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px"
    });

    revealElements.forEach((el) => revealObserver.observe(el));

    const motionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
        }
      });
    }, {
      threshold: 0.18,
      rootMargin: "0px 0px -60px 0px"
    });

    motionElements.forEach((el) => motionObserver.observe(el));

    const parallaxSection = document.querySelector(".section-parallax-features");
    const featurePanels   = [...document.querySelectorAll(".feature-panel")];
    const featureTitle    = document.getElementById("featureTitle");
    const featureText     = document.getElementById("featureText");
    const progressDots    = [...document.querySelectorAll(".progress-dot")];
    const orbs            = [...document.querySelectorAll(".parallax-orb")];
    const floatObjects    = [...document.querySelectorAll(".float-object")];
    const featuresImageFixed = document.getElementById("featuresImageFixed");
    const featuresImageCard  = document.getElementById("featuresImageCard");
    const featuresImageEl    = document.getElementById("featuresImageEl");

    let currentFeatureIndex = -1;
    let textSwapTimeout;
    let imgSwapTimeout;

    function setActiveFeature(index) {
      if (!featurePanels.length || !featureTitle || !featureText || !parallaxSection) return;
      if (index === currentFeatureIndex) return;
      currentFeatureIndex = index;

      featurePanels.forEach((panel, i) => {
        panel.classList.toggle("active", i === index);
        panel.classList.toggle("passed", i < index);
      });
      progressDots.forEach((dot, i) => {
        dot.classList.toggle("active", i === index);
      });

      const activePanel = featurePanels[index];
      if (!activePanel) return;

      const newTitle = activePanel.dataset.title || "";
      const newText  = activePanel.dataset.text  || "";
      const newImg   = activePanel.dataset.img   || "";
      const newAlt   = activePanel.dataset.alt   || "";
      const bg       = activePanel.dataset.bg    || "bg-1";

      featureTitle.classList.add("is-changing");
      featureText.classList.add("is-changing");
      clearTimeout(textSwapTimeout);
      textSwapTimeout = setTimeout(() => {
        featureTitle.textContent = newTitle;
        featureText.textContent  = newText;
        featureTitle.classList.remove("is-changing");
        featureText.classList.remove("is-changing");
      }, 260);

      if (featuresImageCard && featuresImageEl && newImg) {
        featuresImageCard.classList.add("is-entering");
        clearTimeout(imgSwapTimeout);
        imgSwapTimeout = setTimeout(() => {
          featuresImageEl.src = newImg;
          featuresImageEl.alt = newAlt;
          featuresImageCard.classList.remove("is-entering");
        }, 260);
      }

      parallaxSection.classList.remove("bg-1", "bg-2", "bg-3", "bg-4");
      parallaxSection.classList.add(bg);
    }

    const featuresLeftInner = document.querySelector(".features-left-inner");
    const featuresLeft      = document.querySelector(".features-left");
    let isFixed = false;

    const ENTRY_BIAS = 0.10;

    function setSectionHeight() {
      if (!parallaxSection || !featurePanels.length) return;
      if (window.innerWidth <= 1024) {
        parallaxSection.style.height = "";
        return;
      }
      const vh = window.innerHeight;
      parallaxSection.style.height =
        (featurePanels.length * vh + Math.round(vh * 0.4)) + "px";
    }
    setSectionHeight();
    window.addEventListener("resize", setSectionHeight);

    function positionFixed(el, refLeft, refWidth, topPx) {
      el.style.position = "fixed";
      el.style.left     = refLeft + "px";
      el.style.width    = refWidth + "px";
      el.style.top      = topPx + "px";
    }

    function releaseFixed() {
      featuresLeftInner.style.cssText = "";
      if (featuresImageFixed) featuresImageFixed.style.cssText = "";
      isFixed = false;
    }

    function updateParallaxFeatures() {
      if (!parallaxSection || !featurePanels.length) return;

      if (window.innerWidth <= 1024) {
        if (isFixed) releaseFixed();
        return;
      }

      const vpH     = window.innerHeight;
      const secRect = parallaxSection.getBoundingClientRect();

      const textH    = featuresLeftInner.offsetHeight;
      const leftRect = featuresLeft.getBoundingClientRect();
      const textTop  = (vpH - textH) / 2;

      const containerEl   = parallaxSection.querySelector(".container");
      const cRect         = containerEl
        ? containerEl.getBoundingClientRect()
        : { left: 0, right: window.innerWidth };
      const midX  = cRect.left + (cRect.right - cRect.left) / 2;
      const rightX = midX + 40;
      const rightW = cRect.right - rightX;
      const imgH   = featuresImageCard ? featuresImageCard.offsetHeight : vpH * 0.55;
      const imgTop = (vpH - imgH) / 2;

      const enterFixed    = secRect.top <= textTop;
      const exitThreshold = vpH * 0.65;
      const exitFixed     = secRect.bottom < exitThreshold;

      if (enterFixed && !exitFixed) {
        if (!isFixed) {
          const isInDocFlow = featuresLeftInner.style.position !== "fixed";
          const snapTop = isInDocFlow
            ? featuresLeftInner.getBoundingClientRect().top
            : textTop;
          const snapImgTop = isInDocFlow && featuresImageCard
            ? featuresImageCard.getBoundingClientRect().top
            : imgTop;

          positionFixed(featuresLeftInner, leftRect.left, leftRect.width, snapTop);
          featuresLeftInner.style.transform  = "none";
          featuresLeftInner.style.opacity    = "1";
          featuresLeftInner.style.zIndex     = "15";
          featuresLeftInner.style.transition = "none";

          if (featuresImageFixed) {
            featuresImageFixed.style.display    = "flex";
            positionFixed(featuresImageFixed, rightX, rightW, snapImgTop);
            featuresImageFixed.style.opacity    = "1";
            featuresImageFixed.style.zIndex     = "15";
            featuresImageFixed.style.transition = "none";
          }
          isFixed = true;

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              featuresLeftInner.style.transition =
                "top 0.45s cubic-bezier(.4,0,.2,1), opacity 0.3s ease";
              featuresLeftInner.style.top = textTop + "px";
              if (featuresImageFixed) {
                featuresImageFixed.style.transition =
                  "top 0.45s cubic-bezier(.4,0,.2,1), opacity 0.3s ease";
                featuresImageFixed.style.top = imgTop + "px";
              }
            });
          });

        } else {
          featuresLeftInner.style.left = leftRect.left + "px";
          if (featuresImageFixed) {
            featuresImageFixed.style.left  = rightX + "px";
            featuresImageFixed.style.width = rightW + "px";
          }
        }

        featuresLeftInner.style.opacity = "1";
        if (featuresImageFixed) featuresImageFixed.style.opacity = "1";

      } else if (exitFixed && isFixed) {
        const fadeProgress = Math.min(
          (exitThreshold - secRect.bottom) / (vpH * 0.3), 1
        );
        const alpha = Math.max(1 - fadeProgress, 0);
        featuresLeftInner.style.opacity = alpha;
        featuresLeftInner.style.zIndex  = "5";
        if (featuresImageFixed) {
          featuresImageFixed.style.opacity = alpha;
          featuresImageFixed.style.zIndex  = "5";
        }
        if (alpha <= 0) releaseFixed();

      } else if (!enterFixed) {
        if (isFixed) releaseFixed();
      }

      const scrolled   = -secRect.top - ENTRY_BIAS * vpH;
      const panelIndex = Math.max(0, Math.min(
        Math.floor(scrolled / vpH + 0.08),
        featurePanels.length - 1
      ));
      setActiveFeature(panelIndex);

      const totalScroll     = Math.max(parallaxSection.offsetHeight - vpH, 1);
      const sectionProgress = Math.min(Math.max(-secRect.top / totalScroll, 0), 1);
      orbs.forEach((orb, i) => {
        orb.style.transform =
          `translate3d(0, ${sectionProgress * (i + 1) * 18}px, 0)`;
      });
    }

    function updateFloatingObjects() {
      const viewportH = window.innerHeight;
      floatObjects.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const distance = (center - viewportH / 2) / viewportH;
        el.style.transform = `translate3d(0, ${distance * -40}px, 0) rotate(${distance * 8}deg)`;
        el.style.opacity   = `${1 - Math.min(Math.abs(distance) * 1.2, 0.55)}`;
      });
    }

    let ticking = false;
    function onScrollEffects() {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateParallaxFeatures();
          updateFloatingObjects();
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScrollEffects, { passive: true });
    window.addEventListener("resize", onScrollEffects);
    onScrollEffects();

    // ── MOBILE PARALLAX  (<=1024px) ─────────────────────────────────
    (function initMobileParallax() {
      if (!featurePanels.length || !parallaxSection) return;
      function isMob() { return window.innerWidth <= 1024; }

      function buildImages() {
        featurePanels.forEach(panel => {
          if (panel.querySelector('.feature-panel-img')) return;
          const img = panel.dataset.img || '';
          const alt = panel.dataset.alt || '';
          if (!img) return;
          const w = document.createElement('div');
          w.className = 'feature-panel-img is-inactive';
          w.innerHTML = `<img src="${img}" alt="${alt}" loading="lazy">`;
          panel.appendChild(w);
        });
      }

      function activatePanel(idx) {
        featurePanels.forEach((p, i) => {
          const el = p.querySelector('.feature-panel-img');
          if (el) el.classList.toggle('is-inactive', i !== idx);
        });
        setActiveFeature(idx);
      }

      let observer = null;

      function attach() {
        if (!isMob()) return;
        buildImages();
        if (observer) observer.disconnect();
        observer = new IntersectionObserver(entries => {
          entries.forEach(e => {
            if (!e.isIntersecting) return;
            const idx = featurePanels.indexOf(e.target);
            if (idx !== -1) activatePanel(idx);
          });
        }, { threshold: 0.45 });
        featurePanels.forEach(p => observer.observe(p));
      }

      function detach() {
        if (observer) { observer.disconnect(); observer = null; }
        featurePanels.forEach(p => {
          const img = p.querySelector('.feature-panel-img');
          if (img) img.remove();
        });
      }

      if (isMob()) attach();

      let wasMob = isMob();
      window.addEventListener('resize', () => {
        const now = isMob();
        if (now && !wasMob) attach();
        else if (!now && wasMob) detach();
        wasMob = now;
      });
    })();

    // Hero scroll
    const splineBg = document.querySelector(".spline-bg");
    const contentInner = document.querySelector(".content-inner");
    const heroEl = document.querySelector(".hero");

    function updateHeroScroll() {
      if (!heroEl) return;
      const heroH = heroEl.offsetHeight;
      const scrollY = window.scrollY;
      const progress = Math.min(scrollY / heroH, 1);

      if (splineBg) {
        splineBg.style.transform = "none";
      }

      if (contentInner) {
        const t = Math.min(Math.max((progress - 0.28) / 0.42, 0), 1);
        const scale = 1 - t * 0.08;
        const opacity = 1 - t;
        const translateY = t * -36;
        contentInner.style.transform = `scale(${scale}) translateY(${translateY}px)`;
        contentInner.style.opacity = opacity;
      }
    }

    window.addEventListener("scroll", updateHeroScroll, { passive: true });
    updateHeroScroll();

    // Topbar scroll state
    const topbar = document.querySelector(".topbar");
    function updateTopbar() {
      topbar.classList.toggle("is-scrolled", window.scrollY > 60);
    }
    window.addEventListener("scroll", updateTopbar, { passive: true });
    updateTopbar();

    // Cursor tilt
    function addTiltEffect(selector) {
      document.querySelectorAll(selector).forEach(card => {
        let animFrame;
        card.addEventListener("mousemove", (e) => {
          cancelAnimationFrame(animFrame);
          animFrame = requestAnimationFrame(() => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width)  - 0.5;
            const y = ((e.clientY - rect.top)  / rect.height) - 0.5;
            const tiltX = y * -9;
            const tiltY = x *  9;
            card.style.transition = "transform 0.12s ease, box-shadow 0.2s ease";
            card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.03,1.03,1.03)`;
          });
        });
        card.addEventListener("mouseleave", () => {
          cancelAnimationFrame(animFrame);
          card.style.transition = "transform 0.55s cubic-bezier(.22,1,.36,1), box-shadow 0.4s ease";
          card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
        });
      });
    }
    addTiltEffect(".vehicle-card");
    addTiltEffect(".features-image-card");

    // ── HAMBURGER MENU ──────────────────────────────────────────────────
    const menuBtn    = document.querySelector(".menu-btn");
    const navClose   = document.getElementById("navClose");
    const navOverlay = document.getElementById("navOverlay");
    const navLinks   = document.querySelectorAll(".nav-link");

    const HAMBURGER_SVG = `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 6H21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M3 12H21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M3 18H21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;
    const X_SVG = `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 5L19 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M19 5L5 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;

    let savedScrollY = 0;

    function openMenu() {
      savedScrollY = window.scrollY;
      document.documentElement.style.overflowY = 'hidden';

      navOverlay.classList.add("is-open");
      navOverlay.setAttribute("aria-hidden", "false");

      menuBtn.innerHTML = X_SVG;
      menuBtn.setAttribute("aria-label", "Close menu");
    }

    function closeMenu() {
      navOverlay.classList.remove("is-open");
      navOverlay.setAttribute("aria-hidden", "true");

      document.documentElement.style.overflowY = '';
      requestAnimationFrame(() => { onScrollEffects(); });

      menuBtn.innerHTML = HAMBURGER_SVG;
      menuBtn.setAttribute("aria-label", "Open menu");
    }

    if (menuBtn) {
      menuBtn.addEventListener("click", () => {
        if (navOverlay.classList.contains("is-open")) {
          closeMenu();
        } else {
          openMenu();
        }
      });
    }

    if (navClose) navClose.addEventListener("click", closeMenu);

    navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute('href');

        // HOME link — scroll to top
        if (link.classList.contains('nav-active') || href === '#' || href === 'index.html') {
          e.preventDefault();
          closeMenu();
          requestAnimationFrame(() => {
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }, 50);
          });
          return;
        }

        // Features link with scroll offset
        if (link.dataset.scrollOffset) {
          e.preventDefault();
          closeMenu();
          requestAnimationFrame(() => {
            setTimeout(() => {
              const target = document.getElementById("features-parallax");
              if (target) {
                const topbarH = 72;
                const offset = target.getBoundingClientRect().top + window.scrollY - topbarH;
                window.scrollTo({ top: offset, behavior: "smooth" });
              }
            }, 50);
          });
          return;
        }

        // In-page anchor links
        if (href && href.startsWith('#') && href.length > 1) {
          e.preventDefault();
          closeMenu();
          requestAnimationFrame(() => {
            setTimeout(() => {
              const target = document.querySelector(href);
              if (target) {
                const topbarH = 72;
                const offset = target.getBoundingClientRect().top + window.scrollY - topbarH;
                window.scrollTo({ top: offset, behavior: "smooth" });
              }
            }, 50);
          });
          return;
        }

        closeMenu();
      });
    });

    // Close on backdrop click
    if (navOverlay) {
      navOverlay.addEventListener("click", (e) => {
        if (e.target === navOverlay) closeMenu();
      });
    }

    // Keyboard escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navOverlay && navOverlay.classList.contains("is-open")) closeMenu();
    });
  });

  // ── iOS 26 Liquid Glass: canvas-based displacement maps ─────────────
  (function buildLiquidGlassMaps() {

    function roundedRectSDF(px, py, w, h, r) {
      const qx = Math.abs(px) - w * 0.5 + r;
      const qy = Math.abs(py) - h * 0.5 + r;
      return Math.sqrt(Math.max(qx,0)**2 + Math.max(qy,0)**2) +
             Math.min(Math.max(qx, qy), 0) - r;
    }

    function buildMap(canvasId, w, h, rx, ry, edgeBand, strength) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      const img = ctx.createImageData(w, h);
      const d   = img.data;
      const cx = w / 2, cy = h / 2;
      const r  = Math.min(rx, ry, Math.min(w, h) * 0.45);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i  = (y * w + x) * 4;
          const dist = roundedRectSDF(x - cx, y - cy, w, h, r);
          const t = Math.max(0, Math.min(1, (-dist) / edgeBand));
          const s = t * t * (3 - 2 * t);
          const nx = (x - cx) / (Math.abs(x - cx) + 0.001);
          const ny = (y - cy) / (Math.abs(y - cy) + 0.001);
          const rx_ = Math.round(128 + nx * s * strength);
          const ry_ = Math.round(128 + ny * s * strength);
          d[i    ] = Math.max(0, Math.min(255, rx_));
          d[i + 1] = Math.max(0, Math.min(255, ry_));
          d[i + 2] = 128;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return canvas.toDataURL("image/png");
    }

    function patchFilter(filterId, dataUrl) {
      const filter = document.getElementById(filterId);
      if (!filter) return;
      const feImg = filter.querySelector("feImage");
      if (feImg) feImg.setAttribute("href", dataUrl);
    }

    const cardCanvas = document.createElement("canvas");
    cardCanvas.id = "_lgCardCanvas";
    document.body.appendChild(cardCanvas);
    const cardUrl = buildMap("_lgCardCanvas", 400, 400, 28, 28, 52, 62);
    if (cardUrl) patchFilter("lg-card-filter", cardUrl);

    const btnCanvas = document.createElement("canvas");
    btnCanvas.id = "_lgBtnCanvas";
    document.body.appendChild(btnCanvas);
    const btnUrl = buildMap("_lgBtnCanvas", 300, 100, 50, 50, 28, 44);
    if (btnUrl) patchFilter("lg-btn-filter", btnUrl);

    const barCanvas = document.createElement("canvas");
    barCanvas.id = "_lgBarCanvas";
    document.body.appendChild(barCanvas);
    const barUrl = buildMap("_lgBarCanvas", 800, 60, 0, 0, 14, 22);
    if (barUrl) patchFilter("lg-bar-filter", barUrl);

    [cardCanvas, btnCanvas, barCanvas].forEach(c => {
      c.style.cssText = "position:absolute;width:0;height:0;pointer-events:none;opacity:0";
    });
  })();
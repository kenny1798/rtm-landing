/* =========================================================
   RTM SLIDER (Video + Quote)
   - 1 item per slide (ngam ikut bilangan card)
   - Auto loop (last -> first, first -> last)
   - Pause on hover
   - Pause when YouTube video is playing
   ========================================================= */
   (function () {
    // ============================
    // YouTube API Loader (once)
    // ============================
    let ytApiReadyPromise = null;
  
    function loadYouTubeApiOnce() {
      if (ytApiReadyPromise) return ytApiReadyPromise;
  
      ytApiReadyPromise = new Promise((resolve) => {
        // kalau dah ada YT
        if (window.YT && window.YT.Player) return resolve();
  
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
  
        // IMPORTANT: jangan overwrite kalau ada handler lain
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof prev === "function") {
            try { prev(); } catch {}
          }
          resolve();
        };
      });
  
      return ytApiReadyPromise;
    }
  
    // ============================
    // Setup Slider
    // ============================
    function setupSlider(root) {
      const track = root.querySelector("[data-track]");
      const btnPrev = root.querySelector("[data-prev]");
      const btnNext = root.querySelector("[data-next]");
      const viewport = root.querySelector(".rtm-slider__viewport");
  
      if (!track || !btnPrev || !btnNext || !viewport) return;
  
      const sliderType = root.getAttribute("data-slider"); // "video" | "quote"
      let index = 0;
  
      // auto-slide config
      const AUTO_MS = sliderType === "video" ? 5000 : 4200;
      const PAUSE_ON_HOVER = true;
  
      let timer = null;
      let pausedByHover = false;
      let pausedByUser = false;
      let resumeUserTimeout = null;
  
      // Video play state
      const playState = {
        isAnyPlaying: false,
        players: [],
      };
  
      // ----------------------------
      // helpers (1 item per slide)
      // ----------------------------
      const getItems = () => Array.from(track.children).filter(Boolean);
  
      const getGapPx = () => {
        const cs = window.getComputedStyle(track);
        const g = cs.gap || cs.columnGap || "0px";
        const gap = parseFloat(g) || 0;
        return gap;
      };
  
      const getStep = () => {
        const items = getItems();
        if (!items.length) return viewport.clientWidth;
        const rect = items[0].getBoundingClientRect();
        return rect.width + getGapPx();
      };
  
      const getMaxIndex = () => {
        const items = getItems();
        return Math.max(0, items.length - 1);
      };
  
      const clampIndex = () => {
        const max = getMaxIndex();
        if (index < 0) index = 0;
        if (index > max) index = max;
      };
  
      const update = () => {
        clampIndex();
        const step = getStep();
  
        track.style.transform = `translateX(${-index * step}px)`;
  
        // LOOP MODE: jangan disable button
        btnPrev.disabled = false;
        btnNext.disabled = false;
        btnPrev.style.opacity = 1;
        btnNext.style.opacity = 1;
      };
  
      const goNext = () => {
        const max = getMaxIndex();
        index = index >= max ? 0 : index + 1; // loop back
        update();
      };
  
      const goPrev = () => {
        const max = getMaxIndex();
        index = index <= 0 ? max : index - 1; // loop back
        update();
      };
  
      const shouldAutoSlide = () => {
        if (pausedByHover) return false;
        if (pausedByUser) return false;
  
        // kalau slider video & ada video tengah play -> stop auto slide
        if (sliderType === "video" && playState.isAnyPlaying) return false;
  
        return true;
      };
  
      const stopAuto = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };
  
      const startAuto = () => {
        stopAuto();
        timer = setInterval(() => {
          if (!shouldAutoSlide()) return;
          goNext();
        }, AUTO_MS);
      };
  
      const userPauseBriefly = () => {
        pausedByUser = true;
        clearTimeout(resumeUserTimeout);
        resumeUserTimeout = setTimeout(() => {
          pausedByUser = false;
        }, 2500);
      };
  
      // ----------------------------
      // buttons
      // ----------------------------
      btnPrev.addEventListener("click", () => {
        userPauseBriefly();
        goPrev();
      });
  
      btnNext.addEventListener("click", () => {
        userPauseBriefly();
        goNext();
      });
  
      // ----------------------------
      // drag / swipe
      // ----------------------------
      let startX = 0;
      let isDown = false;
  
      const onDown = (x) => {
        isDown = true;
        startX = x;
      };
  
      const onUp = (x) => {
        if (!isDown) return;
        isDown = false;
  
        const dx = x - startX;
        const threshold = 60;
  
        if (dx > threshold) goPrev();
        if (dx < -threshold) goNext();
  
        userPauseBriefly();
      };
  
      viewport.addEventListener("mousedown", (e) => onDown(e.clientX));
      window.addEventListener("mouseup", (e) => onUp(e.clientX));
  
      viewport.addEventListener(
        "touchstart",
        (e) => onDown(e.touches[0].clientX),
        { passive: true }
      );
      viewport.addEventListener(
        "touchend",
        (e) => onUp(e.changedTouches[0].clientX),
        { passive: true }
      );
  
      // ----------------------------
      // hover pause (optional)
      // ----------------------------
      if (PAUSE_ON_HOVER) {
        root.addEventListener("mouseenter", () => (pausedByHover = true));
        root.addEventListener("mouseleave", () => (pausedByHover = false));
      }
  
      // ----------------------------
      // resize / load
      // ----------------------------
      const onRecalc = () => update();
      window.addEventListener("resize", onRecalc);
      window.addEventListener("load", onRecalc);
  
      // ----------------------------
      // YouTube: detect PLAYING/PAUSE
      // ----------------------------
      async function initYouTubeStateIfNeeded() {
        if (sliderType !== "video") return;
  
        const iframes = Array.from(
          root.querySelectorAll("iframe[src*='youtube.com/embed']")
        );
        if (!iframes.length) return;
  
        await loadYouTubeApiOnce();
  
        playState.players = iframes.map((iframe) => {
          return new window.YT.Player(iframe, {
            events: {
              onStateChange: (e) => {
                const YTPS = window.YT.PlayerState;
  
                if (e.data === YTPS.PLAYING) {
                  playState.isAnyPlaying = true;
                  return;
                }
  
                if (e.data === YTPS.PAUSED || e.data === YTPS.ENDED) {
                  // check kalau ada player lain masih play
                  playState.isAnyPlaying = playState.players.some((p) => {
                    try {
                      return p.getPlayerState() === YTPS.PLAYING;
                    } catch {
                      return false;
                    }
                  });
                }
              },
            },
          });
        });
      }
  
      // init
      update();
      startAuto();
      initYouTubeStateIfNeeded();
    }
  
    document.querySelectorAll("[data-slider]").forEach(setupSlider);
  })();
  
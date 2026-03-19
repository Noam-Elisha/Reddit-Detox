// Reddit Detox - Content Script
// Runs on all reddit.com pages at document_start

(function () {
  "use strict";

  const DEFAULT_SETTINGS = {
    disableRecommendations: true,
    disablePromoted: true,
    slideToSee: true,
    disableRecentPosts: true,
    disableLeftPanel: true,
    frictionEnabled: true,
    frictionDuration: 5,
    frictionTrigger: "home", // "home" | "post" | "all"
    frictionCaptcha: true,
  };

  let settings = { ...DEFAULT_SETTINGS };
  let debounceTimer = null;
  let frictionShownForUrl = null;

  // --- Settings ---

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
        settings = result;
        resolve(settings);
      });
    });
  }

  function applyBodyClasses() {
    if (!document.body) return;
    document.body.classList.toggle(
      "rd-detox-recs-disabled",
      settings.disableRecommendations
    );
    document.body.classList.toggle(
      "rd-detox-promoted-disabled",
      settings.disablePromoted
    );
    document.body.classList.toggle(
      "rd-detox-recent-disabled",
      settings.disableRecentPosts
    );
    document.body.classList.toggle(
      "rd-detox-left-disabled",
      settings.disableLeftPanel
    );
  }

  // --- Helpers ---

  function isHomePage() {
    return (
      location.pathname === "/" ||
      location.pathname === "" ||
      location.pathname === "/home" ||
      location.pathname.startsWith("/best") ||
      location.pathname.startsWith("/hot") ||
      location.pathname.startsWith("/new") ||
      location.pathname.startsWith("/top") ||
      location.pathname.startsWith("/rising")
    );
  }

  function isPostPage() {
    return /^\/r\/[^/]+\/comments\//.test(location.pathname);
  }

  // --- Feature: Disable Promoted Posts ---

  function removePromotedPosts() {
    if (!settings.disablePromoted) return;

    // Target shreddit-ad-post elements (new Reddit ad components)
    document.querySelectorAll("shreddit-ad-post").forEach((ad) => {
      if (ad.dataset.rdDetoxHidden) return;
      ad.dataset.rdDetoxHidden = "promoted";
      ad.style.display = "none";
    });

    // Target promoted posts in various Reddit layouts
    document
      .querySelectorAll(
        '[data-testid="promoted-post"], .promotedlink, [data-promoted="true"]'
      )
      .forEach((el) => {
        if (el.dataset.rdDetoxHidden) return;
        el.dataset.rdDetoxHidden = "promoted";
        el.style.display = "none";
      });

    // Scan shreddit-post elements for promoted indicators
    document.querySelectorAll("shreddit-post").forEach((post) => {
      if (post.dataset.rdDetoxHidden) return;
      if (
        post.getAttribute("is-promoted") !== null ||
        post.getAttribute("promoted") !== null
      ) {
        post.dataset.rdDetoxHidden = "promoted";
        post.style.display = "none";
        return;
      }
    });

    // Scan for "Promoted" text labels within post containers
    document
      .querySelectorAll(
        'article, [data-testid="post-container"], .Post, .link'
      )
      .forEach((post) => {
        if (post.dataset.rdDetoxHidden) return;
        // Check first 500 chars for promoted/sponsored indicators
        const headerText = (post.textContent || "").substring(0, 500);
        if (/^\s*promoted\b/im.test(headerText)) {
          post.dataset.rdDetoxHidden = "promoted";
          post.style.display = "none";
        }
      });
  }

  // --- Feature: Disable Recommendations (non-subscribed) ---

  function removeRecommendedPosts() {
    if (!settings.disableRecommendations) return;
    if (!isHomePage()) return;

    // Look for recommendation context elements near posts
    // Reddit shows "Because you've shown interest in..." or "Recommended for you" etc.
    document.querySelectorAll("shreddit-post").forEach((post) => {
      if (post.dataset.rdDetoxHidden) return;
      if (post.dataset.rdDetoxCheckedRec) return;
      post.dataset.rdDetoxCheckedRec = "true";

      // Check for recommendation-source attribute
      if (post.getAttribute("recommendation-source")) {
        post.dataset.rdDetoxHidden = "recommended";
        post.style.display = "none";
        return;
      }

      // Check previous sibling for recommendation context labels
      let sibling = post.previousElementSibling;
      if (sibling) {
        const text = (sibling.textContent || "").toLowerCase();
        if (
          text.includes("recommended") ||
          text.includes("because you") ||
          text.includes("similar to") ||
          text.includes("popular in") ||
          text.includes("trending") ||
          text.includes("you might like")
        ) {
          post.dataset.rdDetoxHidden = "recommended";
          post.style.display = "none";
          sibling.style.display = "none";
          return;
        }
      }

      // Check for recommendation badges within post's immediate children
      // (that are in light DOM)
      const recIndicators = post.querySelectorAll(
        '[class*="recommend"], [class*="Recommend"], [slot="recommendation"]'
      );
      if (recIndicators.length > 0) {
        post.dataset.rdDetoxHidden = "recommended";
        post.style.display = "none";
        return;
      }
    });

    // Also handle older Reddit layouts
    document
      .querySelectorAll(
        '[data-testid="post-container"], .Post, .link, article'
      )
      .forEach((post) => {
        if (post.dataset.rdDetoxHidden) return;
        if (post.dataset.rdDetoxCheckedRec) return;
        post.dataset.rdDetoxCheckedRec = "true";

        // Check for "Recommended" or "Because you visited" labels
        const firstChild = post.firstElementChild;
        if (firstChild) {
          const text = (firstChild.textContent || "").toLowerCase();
          if (
            text.includes("recommended") ||
            text.includes("because you") ||
            text.includes("you might like")
          ) {
            post.dataset.rdDetoxHidden = "recommended";
            post.style.display = "none";
          }
        }
      });

    showDetoxHint();
  }

  function showDetoxHint() {
    if (!isHomePage()) return;
    if (!settings.disableRecommendations) return;
    if (document.querySelector("#rd-detox-hint")) return;

    // Find the main feed container
    const feed =
      document.querySelector("shreddit-feed") ||
      document.querySelector('[data-testid="posts-list"]') ||
      document.querySelector(".ListingLayout-outerContainer") ||
      document.querySelector("#siteTable");
    if (!feed) return;

    const hint = document.createElement("div");
    hint.id = "rd-detox-hint";
    hint.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: #818384;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.6;
    `;
    hint.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 12px;">&#x1f6e1;</div>
      <div style="font-size: 18px; font-weight: 500; color: #D7DADC; margin-bottom: 8px;">
        Reddit Detox is active
      </div>
      <div>Recommended posts are being filtered. You'll only see content from
        <span style="color: #FF4500; font-weight: 500;">subreddits you follow</span>.
      </div>
    `;
    feed.prepend(hint);
  }

  // --- Feature: Slide to See Post ---

  function addSlideOverlays() {
    if (!settings.slideToSee) return;

    // Find all posts in the feed
    const posts = document.querySelectorAll(
      'shreddit-post, article, [data-testid="post-container"]'
    );

    posts.forEach((post) => {
      if (post.dataset.rdDetoxSlide) return;
      if (post.dataset.rdDetoxHidden) return; // Don't overlay hidden posts

      // Skip if it's an ad element
      if (post.tagName.toLowerCase() === "shreddit-ad-post") return;

      post.dataset.rdDetoxSlide = "true";

      // Find or create a suitable container
      const container = post.closest("article") || post;

      // Don't double-overlay
      if (container.querySelector(".rd-detox-slide-overlay")) return;

      container.style.position = "relative";

      const overlay = document.createElement("div");
      overlay.className = "rd-detox-slide-overlay";
      overlay.innerHTML = `
        <div class="rd-detox-slide-content">
          <div class="rd-detox-slide-icon">&#x1f6e1;</div>
          <div class="rd-detox-slide-text">Slide to reveal</div>
        </div>
        <div class="rd-detox-slide-track">
          <div class="rd-detox-slide-thumb">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
          <div class="rd-detox-slide-label">Slide to reveal</div>
        </div>
      `;

      container.appendChild(overlay);
      setupSlideInteraction(overlay, container);
    });
  }

  function setupSlideInteraction(overlay, container) {
    const thumb = overlay.querySelector(".rd-detox-slide-thumb");
    const track = overlay.querySelector(".rd-detox-slide-track");
    const label = overlay.querySelector(".rd-detox-slide-label");
    if (!thumb || !track) return;

    let dragging = false;
    let startX = 0;
    let currentOffset = 0;
    const thumbWidth = 44;

    function getMaxOffset() {
      return track.offsetWidth - thumbWidth;
    }

    function onStart(e) {
      dragging = true;
      startX =
        (e.touches ? e.touches[0].clientX : e.clientX) - currentOffset;
      thumb.classList.add("rd-detox-slide-thumb-active");
      if (label) label.style.opacity = "0";
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const maxOffset = getMaxOffset();
      let offset = clientX - startX;
      offset = Math.max(0, Math.min(maxOffset, offset));
      currentOffset = offset;
      thumb.style.transform = `translateX(${offset}px)`;
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      thumb.classList.remove("rd-detox-slide-thumb-active");

      const maxOffset = getMaxOffset();
      if (currentOffset >= maxOffset - 5) {
        // Success — reveal post
        overlay.classList.add("rd-detox-slide-fade-out");
        setTimeout(() => overlay.remove(), 400);
      } else {
        // Reset
        currentOffset = 0;
        thumb.style.transform = "translateX(0)";
        if (label) label.style.opacity = "1";
      }
    }

    thumb.addEventListener("mousedown", onStart);
    thumb.addEventListener("touchstart", onStart, { passive: false });
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchend", onEnd);
  }

  // --- Feature: Friction overlay ---

  function shouldShowFriction() {
    if (!settings.frictionEnabled) return false;
    const trigger = settings.frictionTrigger;
    if (trigger === "home") return isHomePage();
    if (trigger === "post") return isPostPage();
    // "all"
    return true;
  }

  function dismissFrictionOverlay(overlay) {
    overlay.classList.add("rd-detox-friction-fade-out");
    setTimeout(() => overlay.remove(), 800);
  }

  // --- Slider puzzle CAPTCHA ---

  function drawPuzzlePiecePath(ctx, x, y, size) {
    const s = size;
    const tab = s * 0.25;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.35, y);
    ctx.bezierCurveTo(
      x + s * 0.35,
      y - tab,
      x + s * 0.65,
      y - tab,
      x + s * 0.65,
      y
    );
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s, y + s * 0.35);
    ctx.bezierCurveTo(
      x + s + tab,
      y + s * 0.35,
      x + s + tab,
      y + s * 0.65,
      x + s,
      y + s * 0.65
    );
    ctx.lineTo(x + s, y + s);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x, y);
    ctx.closePath();
  }

  function showCaptchaPhase(overlay) {
    const content = overlay.querySelector(".rd-detox-friction-content");
    if (!content) return;

    const W = 320;
    const H = 180;
    const pieceSize = 50;
    const targetX =
      Math.floor(Math.random() * (W - pieceSize * 2 - 40)) + pieceSize + 20;
    const targetY = Math.floor((H - pieceSize) / 2);
    const tolerance = 5;

    content.innerHTML = `
      <div class="rd-detox-friction-title" style="margin-bottom:16px">Verify you're human</div>
      <div class="rd-detox-friction-subtitle" style="margin-bottom:20px">Drag the slider to complete the puzzle</div>
      <div class="rd-detox-captcha-canvas-wrap" id="rd-detox-captcha-wrap">
        <canvas id="rd-detox-captcha-bg" width="${W}" height="${H}"></canvas>
        <canvas id="rd-detox-captcha-piece" width="${pieceSize + 10}" height="${H}"
                style="position:absolute;top:0;left:0;"></canvas>
      </div>
      <div class="rd-detox-captcha-slider-track" id="rd-detox-captcha-track">
        <div class="rd-detox-captcha-slider-thumb" id="rd-detox-captcha-thumb">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
        <div class="rd-detox-captcha-slider-label" id="rd-detox-captcha-label">Slide to complete</div>
      </div>
      <div class="rd-detox-captcha-status" id="rd-detox-captcha-status"></div>
    `;

    requestAnimationFrame(() => {
      const bgCanvas = document.getElementById("rd-detox-captcha-bg");
      const pieceCanvas = document.getElementById("rd-detox-captcha-piece");
      if (!bgCanvas || !pieceCanvas) return;

      const bgCtx = bgCanvas.getContext("2d");
      const pcCtx = pieceCanvas.getContext("2d");

      // Draw a colorful background with Reddit-themed colors
      const grad = bgCtx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#FF4500");
      grad.addColorStop(0.3, "#CC3700");
      grad.addColorStop(0.6, "#1A1A1B");
      grad.addColorStop(1, "#0079D3");
      bgCtx.fillStyle = grad;
      bgCtx.fillRect(0, 0, W, H);

      // Random geometric shapes
      for (let i = 0; i < 20; i++) {
        bgCtx.fillStyle = `hsla(${Math.random() * 360}, 70%, 60%, 0.15)`;
        bgCtx.beginPath();
        const cx = Math.random() * W;
        const cy = Math.random() * H;
        const r = Math.random() * 40 + 10;
        bgCtx.arc(cx, cy, r, 0, Math.PI * 2);
        bgCtx.fill();
      }
      for (let i = 0; i < 12; i++) {
        bgCtx.strokeStyle = `hsla(${Math.random() * 360}, 60%, 70%, 0.2)`;
        bgCtx.lineWidth = Math.random() * 3 + 1;
        bgCtx.beginPath();
        bgCtx.moveTo(Math.random() * W, Math.random() * H);
        bgCtx.lineTo(Math.random() * W, Math.random() * H);
        bgCtx.stroke();
      }

      // Dots grid
      bgCtx.fillStyle = "rgba(255,255,255,0.08)";
      for (let gx = 0; gx < W; gx += 16) {
        for (let gy = 0; gy < H; gy += 16) {
          bgCtx.fillRect(gx, gy, 1, 1);
        }
      }

      // Extract puzzle piece
      pcCtx.save();
      drawPuzzlePiecePath(pcCtx, 5, targetY, pieceSize);
      pcCtx.clip();
      pcCtx.drawImage(
        bgCanvas,
        targetX - 5,
        0,
        pieceSize + 10,
        H,
        0,
        0,
        pieceSize + 10,
        H
      );
      pcCtx.restore();

      // Piece outline
      pcCtx.save();
      drawPuzzlePiecePath(pcCtx, 5, targetY, pieceSize);
      pcCtx.strokeStyle = "rgba(255,255,255,0.8)";
      pcCtx.lineWidth = 2;
      pcCtx.stroke();
      pcCtx.restore();

      // Draw hole on background
      bgCtx.save();
      drawPuzzlePiecePath(bgCtx, targetX, targetY, pieceSize);
      bgCtx.fillStyle = "rgba(0,0,0,0.5)";
      bgCtx.fill();
      bgCtx.strokeStyle = "rgba(255,255,255,0.3)";
      bgCtx.lineWidth = 2;
      bgCtx.stroke();
      bgCtx.restore();

      // Slider interaction
      const thumb = document.getElementById("rd-detox-captcha-thumb");
      const track = document.getElementById("rd-detox-captcha-track");
      const label = document.getElementById("rd-detox-captcha-label");
      const status = document.getElementById("rd-detox-captcha-status");
      if (!thumb || !track) return;

      let dragging = false;
      let startX = 0;
      let currentOffset = 0;
      const trackWidth = W;
      const thumbWidth = 44;
      const maxOffset = trackWidth - thumbWidth;

      function updatePiecePosition(offset) {
        const piecePx = (offset / maxOffset) * (W - pieceSize - 10);
        pieceCanvas.style.left = piecePx + "px";
      }

      function onStart(e) {
        dragging = true;
        startX =
          (e.touches ? e.touches[0].clientX : e.clientX) - currentOffset;
        thumb.classList.add("rd-detox-captcha-thumb-active");
        if (label) label.style.opacity = "0";
      }

      function onMove(e) {
        if (!dragging) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let offset = clientX - startX;
        offset = Math.max(0, Math.min(maxOffset, offset));
        currentOffset = offset;
        thumb.style.transform = `translateX(${offset}px)`;
        updatePiecePosition(offset);
      }

      function onEnd() {
        if (!dragging) return;
        dragging = false;
        thumb.classList.remove("rd-detox-captcha-thumb-active");

        const piecePx = (currentOffset / maxOffset) * (W - pieceSize - 10);
        const targetPx = targetX - 5;

        if (Math.abs(piecePx - targetPx) <= tolerance) {
          // Success
          thumb.style.background = "#46D160";
          if (status) {
            status.textContent = "\u2713 Verified";
            status.style.color = "#46D160";
          }
          pieceCanvas.style.left = targetPx + "px";
          setTimeout(() => dismissFrictionOverlay(overlay), 600);
        } else {
          // Fail — reset
          if (status) {
            status.textContent = "Try again";
            status.style.color = "#FF4500";
          }
          thumb.classList.add("rd-detox-captcha-shake");
          setTimeout(() => {
            thumb.classList.remove("rd-detox-captcha-shake");
            currentOffset = 0;
            thumb.style.transform = "translateX(0)";
            pieceCanvas.style.left = "0px";
            if (label) label.style.opacity = "1";
            if (status) status.textContent = "";
          }, 500);
        }
      }

      thumb.addEventListener("mousedown", onStart);
      thumb.addEventListener("touchstart", onStart, { passive: true });
      document.addEventListener("mousemove", onMove);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchend", onEnd);
    });
  }

  function showFrictionOverlay() {
    if (!shouldShowFriction()) return;

    const currentUrl = location.href;
    if (frictionShownForUrl === currentUrl) return;
    frictionShownForUrl = currentUrl;

    if (document.querySelector("#rd-detox-friction-overlay")) return;

    const duration = Math.max(1, settings.frictionDuration || 5);

    const overlay = document.createElement("div");
    overlay.id = "rd-detox-friction-overlay";
    overlay.innerHTML = `
      <div class="rd-detox-friction-content">
        <div class="rd-detox-friction-icon">&#x1f6e1;</div>
        <div class="rd-detox-friction-title">Take a moment...</div>
        <div class="rd-detox-friction-subtitle">Do you really need to be scrolling right now?</div>
        <div class="rd-detox-friction-bar-track">
          <div class="rd-detox-friction-bar-fill" id="rd-detox-friction-bar-fill"></div>
        </div>
        <div class="rd-detox-friction-time" id="rd-detox-friction-time">${duration}s</div>
      </div>
    `;
    document.documentElement.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fill = document.getElementById("rd-detox-friction-bar-fill");
        if (fill) {
          fill.style.transition = `width ${duration}s linear`;
          fill.style.width = "100%";
        }
      });
    });

    let remaining = duration;
    const timeEl = document.getElementById("rd-detox-friction-time");
    const countdownInterval = setInterval(() => {
      remaining--;
      if (timeEl) timeEl.textContent = `${Math.max(0, remaining)}s`;
      if (remaining <= 0) clearInterval(countdownInterval);
    }, 1000);

    setTimeout(() => {
      clearInterval(countdownInterval);
      if (settings.frictionCaptcha) {
        showCaptchaPhase(overlay);
      } else {
        dismissFrictionOverlay(overlay);
      }
    }, duration * 1000);
  }

  // --- Main loop ---

  function runAllFeatures() {
    applyBodyClasses();
    removePromotedPosts();
    removeRecommendedPosts();
    addSlideOverlays();
  }

  function scheduleRun() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runAllFeatures();
    }, 150);
  }

  function resetHint() {
    const oldHint = document.querySelector("#rd-detox-hint");
    if (oldHint) oldHint.remove();
  }

  // Reset processed flags so features re-evaluate after settings change
  function resetProcessedFlags() {
    document
      .querySelectorAll("[data-rd-detox-hidden]")
      .forEach((el) => {
        delete el.dataset.rdDetoxHidden;
        delete el.dataset.rdDetoxCheckedRec;
        el.style.display = "";
      });
    document
      .querySelectorAll("[data-rd-detox-checked-rec]")
      .forEach((el) => {
        delete el.dataset.rdDetoxCheckedRec;
      });
    // Remove slide overlays if feature was toggled off
    if (!settings.slideToSee) {
      document.querySelectorAll(".rd-detox-slide-overlay").forEach((el) => el.remove());
      document.querySelectorAll("[data-rd-detox-slide]").forEach((el) => {
        delete el.dataset.rdDetoxSlide;
      });
    }
  }

  // --- Init ---

  async function init() {
    await loadSettings();

    // Wait for body
    if (!document.body) {
      await new Promise((resolve) => {
        const obs = new MutationObserver(() => {
          if (document.body) {
            obs.disconnect();
            resolve();
          }
        });
        obs.observe(document.documentElement, { childList: true });
      });
    }

    // Immediately apply default body classes to prevent flash
    document.body.classList.add(
      "rd-detox-promoted-disabled",
      "rd-detox-recent-disabled",
      "rd-detox-left-disabled"
    );

    runAllFeatures();

    // Watch for DOM changes (Reddit is a SPA)
    new MutationObserver(scheduleRun).observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Show friction overlay on initial load
    showFrictionOverlay();

    // Reddit SPA navigation — listen for URL changes via popstate and clicks
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        resetHint();
        showFrictionOverlay();
        runAllFeatures();
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    window.addEventListener("popstate", () => {
      resetHint();
      showFrictionOverlay();
      runAllFeatures();
    });

    // Settings changed from popup
    chrome.storage.onChanged.addListener((changes) => {
      for (const key of Object.keys(changes)) {
        settings[key] = changes[key].newValue;
      }
      resetHint();
      resetProcessedFlags();
      runAllFeatures();
    });

    // Safety net: periodic check
    setInterval(runAllFeatures, 2000);
  }

  init();
})();

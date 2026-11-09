(() => {
  const tour = document.querySelector(".product-tour");
  const slides = [...tour.querySelectorAll(".tour-slide")];
  const caption = document.getElementById("tour-caption");
  const viewport = tour.querySelector(".tour-viewport");
  const playButton = tour.querySelector(".tour-play");
  const chapters = tour.querySelector(".tour-chapters");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const number = (index) => String(index + 1).padStart(2, "0");
  let active = 0;
  let timer;
  let playing = false;
  let visible = false;
  let hovered = tour.matches(":hover");
  let focused = tour.contains(document.activeElement);
  let touchStart;
  let suppressClickUntil = 0;

  const chapterButtons = slides.map((slide, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tour-chapter";
    button.setAttribute("aria-label", `Show slide ${index + 1}: ${slide.dataset.name}`);
    button.setAttribute("aria-controls", slide.id);
    const picture = document.createElement("picture");
    const source = document.createElement("source");
    source.type = "image/webp";
    const image = slide.querySelector("img").cloneNode();
    const thumbnail = new URL(image.getAttribute("src"), document.baseURI);
    thumbnail.pathname = thumbnail.pathname.replace(/\/([^/]+)\.png$/, "/optimized/$1");
    source.srcset = `${thumbnail.href}-160.webp 160w, ${thumbnail.href}-320.webp 320w`;
    source.sizes = "(max-width: 700px) 18vw, 110px";
    image.className = "tour-thumbnail";
    image.alt = "";
    picture.append(source, image);
    const chapterNumber = document.createElement("span");
    chapterNumber.className = "tour-chapter-index";
    chapterNumber.textContent = number(index);
    const name = document.createElement("span");
    name.className = "tour-chapter-name";
    name.textContent = slide.dataset.name;
    button.append(picture, chapterNumber, name);
    button.addEventListener("click", () => show(index, true));
    chapters.append(button);
    return button;
  });

  function schedule() {
    clearTimeout(timer);
    const running = playing && visible && !hovered && !focused &&
      !document.hidden && !reducedMotion.matches;
    caption.setAttribute("aria-live", running ? "off" : "polite");
    if (running) timer = setTimeout(() => show(active + 1, false), 6000);
  }

  function setPlaying(value) {
    playing = value && !reducedMotion.matches;
    playButton.setAttribute("aria-pressed", String(playing));
    playButton.setAttribute("aria-label", playing ? "Pause autoplay" : "Start autoplay");
    playButton.textContent = playing ? "Pause tour" : "Play tour";
    schedule();
  }

  function loadVisibleSlides() {
    if (!visible) return;
    slides[active].querySelector("img").loading = "eager";
    slides[(active + 1) % slides.length].querySelector("img").loading = "eager";
  }

  function show(index, manual) {
    if (manual) setPlaying(false);
    const next = (index + slides.length) % slides.length;
    const changed = next !== active;
    tour.style.setProperty("--tour-slide-offset", index < active ? "-12px" : "12px");
    active = next;
    slides.forEach((slide, i) => { slide.hidden = i !== active; });
    chapterButtons.forEach((button, i) => button.setAttribute("aria-current", String(i === active)));
    const slide = slides[active];
    document.getElementById("tour-caption-label").textContent = slide.dataset.label;
    document.getElementById("tour-caption-title").textContent = slide.dataset.title;
    document.getElementById("tour-caption-copy").textContent = slide.dataset.caption;
    document.getElementById("tour-location").textContent = slide.dataset.location;
    document.getElementById("tour-number").textContent = number(active);
    document.getElementById("tour-chapter-number").textContent = number(active);
    loadVisibleSlides();
    if (changed && !reducedMotion.matches) {
      caption.getAnimations().forEach((animation) => animation.cancel());
      caption.animate(
        [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 220, delay: 25, fill: "backwards", easing: "cubic-bezier(.22,1,.36,1)" },
      );
    }
    schedule();
  }

  tour.querySelectorAll(".tour-previous").forEach((button) => {
    button.addEventListener("click", () => show(active - 1, true));
  });
  tour.querySelectorAll(".tour-next").forEach((button) => {
    button.addEventListener("click", () => show(active + 1, true));
  });
  playButton.addEventListener("click", () => setPlaying(!playing));
  tour.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const destination = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: slides.length - 1 };
    if (!Object.hasOwn(destination, event.key)) return;
    event.preventDefault();
    show(destination[event.key], true);
  });
  viewport.addEventListener("touchstart", (event) => {
    touchStart = event.touches.length === 1 ?
      { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  viewport.addEventListener("touchcancel", () => { touchStart = null; });
  viewport.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      suppressClickUntil = performance.now() + 500;
      show(active + (dx < 0 ? 1 : -1), true);
    }
  }, { passive: true });
  viewport.addEventListener("click", (event) => {
    if (event.detail > 0 && performance.now() < suppressClickUntil) event.preventDefault();
  });
  tour.addEventListener("mouseenter", () => { hovered = true; schedule(); });
  tour.addEventListener("mouseleave", () => { hovered = false; schedule(); });
  tour.addEventListener("focusin", () => { focused = true; schedule(); });
  tour.addEventListener("focusout", (event) => {
    if (event.relatedTarget && tour.contains(event.relatedTarget)) return;
    focused = false;
    schedule();
  });
  document.addEventListener("visibilitychange", schedule);
  function updateMotionPreference() {
    if (reducedMotion.matches) {
      setPlaying(false);
      caption.getAnimations().forEach((animation) => animation.cancel());
    }
    playButton.disabled = reducedMotion.matches;
    playButton.title = reducedMotion.matches ? "Autoplay is disabled by your reduced motion preference" : "";
  }
  reducedMotion.addEventListener("change", updateMotionPreference);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    loadVisibleSlides();
    schedule();
  }, { threshold: .35 }).observe(tour);
  document.getElementById("tour-total").textContent = number(slides.length - 1);
  tour.classList.add("enhanced");
  tour.querySelectorAll(".tour-arrow, .tour-bottom").forEach((control) => {
    control.hidden = false;
  });
  updateMotionPreference();
  show(0, false);
})();

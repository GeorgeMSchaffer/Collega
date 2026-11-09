(() => {
  const tour = document.querySelector(".product-tour");
  const slides = [...tour.querySelectorAll(".tour-slide")];
  const chapters = [...tour.querySelectorAll(".tour-chapters button")];
  const caption = document.getElementById("tour-caption");
  const pause = tour.querySelector(".tour-pause");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let active = 0;
  let timer;
  let manuallyNavigated = false;
  let paused = false;
  let hovered = tour.matches(":hover");
  let focused = tour.contains(document.activeElement);

  function schedule() {
    clearTimeout(timer);
    const playing = !manuallyNavigated && !paused && !hovered && !focused &&
      !document.hidden && !reducedMotion.matches;
    caption.setAttribute("aria-live", playing ? "off" : "polite");
    pause.disabled = manuallyNavigated || reducedMotion.matches;
    pause.setAttribute("aria-label", paused ? "Resume autoplay" : "Pause autoplay");
    tour.querySelector(".tour-pause-icon").setAttribute("d",
      paused ? "m9 5 10 7-10 7Z" : "M9 5v14M15 5v14");
    if (playing) timer = setTimeout(() => show(active + 1, false), 30000);
  }

  function show(index, manual) {
    if (manual) manuallyNavigated = true;
    active = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => { slide.hidden = i !== active; });
    chapters.forEach((chapter, i) => {
      if (i === active) chapter.setAttribute("aria-current", "true");
      else chapter.removeAttribute("aria-current");
    });
    schedule();
    const slide = slides[active];
    document.getElementById("tour-caption-label").textContent = slide.dataset.label;
    document.getElementById("tour-caption-title").textContent = slide.dataset.title;
    document.getElementById("tour-caption-copy").textContent = slide.dataset.caption;
    document.getElementById("tour-location").textContent = slide.dataset.location;
    document.getElementById("tour-number").textContent = String(active + 1).padStart(2, "0");
    slide.querySelector("img").loading = "eager";
    slides[(active + 1) % slides.length].querySelector("img").loading = "eager";
  }

  chapters.forEach((chapter, index) => {
    chapter.addEventListener("click", () => show(index, true));
  });
  tour.querySelector(".tour-previous").addEventListener("click", () => show(active - 1, true));
  tour.querySelector(".tour-next").addEventListener("click", () => show(active + 1, true));
  pause.addEventListener("click", () => { paused = !paused; schedule(); });
  tour.addEventListener("keydown", (event) => {
    const destination = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: slides.length - 1 };
    if (!Object.hasOwn(destination, event.key)) return;
    event.preventDefault();
    show(destination[event.key], true);
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
  reducedMotion.addEventListener("change", schedule);
  document.getElementById("tour-total").textContent = String(slides.length).padStart(2, "0");
  tour.classList.add("enhanced");
  tour.querySelectorAll(".tour-chapters, .tour-arrow, .tour-meta").forEach((control) => {
    control.hidden = false;
  });
  show(0, false);
})();

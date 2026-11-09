(() => {
  const tour = document.querySelector("[data-guided-tour]");
  if (!tour) return;

  const stops = [...tour.querySelectorAll("[data-tour-stop]")];
  const navigation = tour.querySelector("[data-tour-nav]");
  const stepButtons = [...tour.querySelectorAll("[data-tour-index]")];
  const previous = tour.querySelector("[data-tour-previous]");
  const next = tour.querySelector("[data-tour-next]");
  const progress = tour.querySelector("[data-tour-progress]");
  const count = tour.querySelector("[data-tour-count]");
  let active = 0;

  function show(index) {
    active = Math.max(0, Math.min(stops.length - 1, index));
    stops.forEach((stop, stopIndex) => {
      stop.hidden = stopIndex !== active;
    });
    stepButtons.forEach((button, buttonIndex) => {
      if (buttonIndex === active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });

    const current = String(active + 1).padStart(2, "0");
    const total = String(stops.length).padStart(2, "0");
    progress.textContent = `Stop ${active + 1} of ${stops.length}`;
    count.textContent = `Stop ${active + 1} of ${stops.length}`;
    previous.disabled = active === 0;
    next.disabled = active === stops.length - 1;
    next.textContent = active === stops.length - 1 ? "Last stop" : "Next stop";
    stops[active].querySelector("img").loading = "eager";

    stepButtons.forEach((button, buttonIndex) => {
      const label = button.textContent.trim().replace(/^\d+\s*/, "");
      button.setAttribute("aria-label", `Stop ${String(buttonIndex + 1).padStart(2, "0")} of ${total}: ${label}`);
    });
    tour.dataset.activeStop = current;
  }

  stepButtons.forEach((button, index) => {
    button.addEventListener("click", () => show(index));
  });
  previous.addEventListener("click", () => show(active - 1));
  next.addEventListener("click", () => show(active + 1));
  tour.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const destinations = {
      ArrowLeft: active - 1,
      ArrowRight: active + 1,
      Home: 0,
      End: stops.length - 1,
    };
    if (!Object.hasOwn(destinations, event.key)) return;
    event.preventDefault();
    show(destinations[event.key]);
  });

  tour.classList.add("is-enhanced");
  stops.forEach((stop, index) => {
    stop.hidden = index !== active;
  });
  navigation.hidden = false;
  tour.querySelector("[data-tour-controls]").hidden = false;
  show(active);
})();

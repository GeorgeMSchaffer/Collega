(() => {
  const disclosures = [...document.querySelectorAll(".public-nav .nav-product")];

  disclosures.forEach((disclosure) => {
    disclosure.addEventListener("toggle", () => {
      if (!disclosure.open) return;
      disclosures.forEach((other) => {
        if (other !== disclosure) other.open = false;
      });
    });
    disclosure.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !disclosure.open) return;
      event.preventDefault();
      disclosure.open = false;
      disclosure.querySelector("summary").focus();
    });
    disclosure.addEventListener("focusout", (event) => {
      if (!disclosure.contains(event.relatedTarget)) disclosure.open = false;
    });
    disclosure.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        disclosure.open = false;
      });
    });
  });

  document.addEventListener("click", (event) => {
    disclosures.forEach((disclosure) => {
      if (!disclosure.contains(event.target)) disclosure.open = false;
    });
  });

  function revealPrivacy() {
    const note = document.getElementById("privacy");
    if (location.hash !== "#privacy" || !note) return;
    note.open = true;
    note.scrollIntoView({ block: "center" });
    note.querySelector("summary").focus();
  }
  window.addEventListener("hashchange", revealPrivacy);
  revealPrivacy();
})();

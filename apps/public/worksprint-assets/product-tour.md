# Field Notes product tour

Read this when changing the home page tour. `index.html` supplies the slides and fallback;
`product-tour.js` owns interaction and `product-tour.css` owns layout and motion.

- The five screenshots are approved, unaltered captures of the existing app; each links to its
  full-size image.
- Five slides are presented with captions beside screenshots on desktop and above them on mobile.
  The thumbnail chapter strip and overlay arrows navigate between slides.
- Keyboard arrows, Home and End navigate while focus is in the tour; touch swipes navigate
  horizontally. The controls are hidden until JavaScript enhances the tour.
- Autoplay starts only when the visitor chooses **Play tour**. It advances every six seconds and
  pauses while the tour is hovered, focused, off-screen or the page is hidden. Manual navigation
  stops autoplay.
- Reduced-motion preference disables autoplay and slide/caption animation. The transitions use a
  directional 240ms slide-and-fade with a subtle amber screen edge.
- Without JavaScript, the first screenshot and caption remain visible.

/**
 * The View As mark, taken from the signed-off comp
 * (`SPEC/mockups/comp-c-review-10-view-as.html`). It appears on the entry control, on the
 * banner and on the rail item, which is most of what ties the three together as one feature.
 *
 * Decorative everywhere it is used — the word *View as* is always beside it — so it is
 * hidden from assistive technology rather than labelled twice.
 */
export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className ?? "size-4 shrink-0"}
    >
      <path d="M10 4c3.3 0 6.4 1.9 8.4 5.1a.9.9 0 0 1 0 .9C16.4 13.1 13.3 15 10 15S3.6 13.1 1.6 9.9a.9.9 0 0 1 0-.9C3.6 5.9 6.7 4 10 4Zm0 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 1.8a1.8 1.8 0 1 1 0 3.5 1.8 1.8 0 0 1 0-3.5Z" />
    </svg>
  );
}

/** The same path, as data, for the sidebar's `NavIcon`. */
export const EYE_PATH =
  "M10 4c3.3 0 6.4 1.9 8.4 5.1a.9.9 0 0 1 0 .9C16.4 13.1 13.3 15 10 15S3.6 13.1 1.6 9.9a.9.9 0 0 1 0-.9C3.6 5.9 6.7 4 10 4Zm0 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 1.8a1.8 1.8 0 1 1 0 3.5 1.8 1.8 0 0 1 0-3.5Z";

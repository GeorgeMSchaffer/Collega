import type { NavItem } from './nav-items'

// Carried verbatim from comp Q so the rendered sidebar matches the reference pixel for pixel.
const PATHS: Record<NavItem['icon'], string> = {
  home: 'M10 2.6 2.8 8.3a1 1 0 0 0-.4.8V16a1.4 1.4 0 0 0 1.4 1.4h3.4v-4.6h5.6v4.6h3.4A1.4 1.4 0 0 0 17.6 16V9.1a1 1 0 0 0-.4-.8Z',
  boards:
    'M3 4.4A1.4 1.4 0 0 1 4.4 3h11.2A1.4 1.4 0 0 1 17 4.4v11.2a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 15.6Zm2 .6v10h3.2V5Zm5.2 0v6.4H15V5Z',
  ideas:
    'M10 2a5 5 0 0 0-3 9v1.6a1.4 1.4 0 0 0 1.4 1.4h3.2a1.4 1.4 0 0 0 1.4-1.4V11A5 5 0 0 0 10 2ZM8.2 15.6h3.6v.8a1.4 1.4 0 0 1-1.4 1.4h-.8a1.4 1.4 0 0 1-1.4-1.4Z',
  sprint: 'M4 3h12v2H4Zm0 4h8v2H4Zm0 4h12v2H4Zm0 4h6v2H4Z',
  backlog: 'M4 5h12v2H4Zm0 4h12v2H4Zm0 4h8v2H4Z',
  roadmap: 'M3 5.5 7.5 4l5 1.5L17 4v10.5L12.5 16l-5-1.5L3 16Zm5 1.1v7.2l4 1.2V7.8Z',
  settings:
    'M10 7.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm-1.4-5.4a1 1 0 0 1 1-.8h.8a1 1 0 0 1 1 .8l.2 1.3 1.2.7 1.2-.5a1 1 0 0 1 1.2.4l.4.7a1 1 0 0 1-.2 1.3l-1 .8v1.4l1 .8a1 1 0 0 1 .2 1.3l-.4.7a1 1 0 0 1-1.2.4l-1.2-.5-1.2.7-.2 1.3a1 1 0 0 1-1 .8h-.8a1 1 0 0 1-1-.8l-.2-1.3-1.2-.7-1.2.5a1 1 0 0 1-1.2-.4l-.4-.7a1 1 0 0 1 .2-1.3l1-.8V8.1l-1-.8a1 1 0 0 1-.2-1.3l.4-.7a1 1 0 0 1 1.2-.4l1.2.5 1.2-.7Z',
}

export function NavIcon({ icon }: { icon: NavItem['icon'] }) {
  return (
    <svg
      className="size-[15px] shrink-0"
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={PATHS[icon]} />
    </svg>
  )
}

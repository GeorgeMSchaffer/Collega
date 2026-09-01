"""Build the comp P set.

Four output files, one per product area, all sharing tokens.css and extra.css.
The comp chrome — screen tabs, the role switcher, the state toggle, the
cross-file links — is generated here rather than written into the fragments,
so all four files behave identically and a chrome change lands in one place.

    python3 SPEC/mockups/_build/build_p.py
"""

import pathlib, re

D = pathlib.Path(__file__).resolve().parent
OUT = D.parent

CSS = (D / "tokens.css").read_text() + (D / "extra.css").read_text()
assert "</style>" not in CSS, "a stylesheet must not close the style element"

# A stray comment marker is silent and expensive: the parser discards from the
# error to the next closing brace, so a whole rule vanishes while the file still
# reads correctly and the page still renders. That cost a browser session to
# find once. Stripping balanced comments must leave no marker behind.
_bare = re.sub(r"/\*.*?\*/", "", CSS, flags=re.S)
assert "*/" not in _bare and "/*" not in _bare, "unbalanced CSS comment marker"
assert _bare.count("{") == _bare.count("}"), "unbalanced CSS braces"

ROLES = ["SiteAdmin", "OrgAdmin", "User", "ReadOnly"]
STATES = ["normal", "empty", "loading", "error"]

IC = {
 "home": '<path d="M10 2.6 2.8 8.3a1 1 0 0 0-.4.8V16a1.4 1.4 0 0 0 1.4 1.4h3.4v-4.6h5.6v4.6h3.4A1.4 1.4 0 0 0 17.6 16V9.1a1 1 0 0 0-.4-.8Z"/>',
 "boards": '<path d="M3 4.4A1.4 1.4 0 0 1 4.4 3h11.2A1.4 1.4 0 0 1 17 4.4v11.2a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 15.6Zm2 .6v10h3.2V5Zm5.2 0v6.4H15V5Z"/>',
 "ideas": '<path d="M10 2a5 5 0 0 0-3 9v1.6a1.4 1.4 0 0 0 1.4 1.4h3.2a1.4 1.4 0 0 0 1.4-1.4V11A5 5 0 0 0 10 2ZM8.2 15.6h3.6v.8a1.4 1.4 0 0 1-1.4 1.4h-.8a1.4 1.4 0 0 1-1.4-1.4Z"/>',
 "sprint": '<path d="M4 3h12v2H4Zm0 4h8v2H4Zm0 4h12v2H4Zm0 4h6v2H4Z"/>',
 "backlog": '<path d="M4 5h12v2H4Zm0 4h12v2H4Zm0 4h8v2H4Z"/>',
 "roadmap": '<path d="M3 5.5 7.5 4l5 1.5L17 4v10.5L12.5 16l-5-1.5L3 16Zm5 1.1v7.2l4 1.2V7.8Z"/>',
 "settings": '<path d="M10 7.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm-1.4-5.4a1 1 0 0 1 1-.8h.8a1 1 0 0 1 1 .8l.2 1.3 1.2.7 1.2-.5a1 1 0 0 1 1.2.4l.4.7a1 1 0 0 1-.2 1.3l-1 .8v1.4l1 .8a1 1 0 0 1 .2 1.3l-.4.7a1 1 0 0 1-1.2.4l-1.2-.5-1.2.7-.2 1.3a1 1 0 0 1-1 .8h-.8a1 1 0 0 1-1-.8l-.2-1.3-1.2-.7-1.2.5a1 1 0 0 1-1.2-.4l-.4-.7a1 1 0 0 1 .2-1.3l1-.8V8.1l-1-.8a1 1 0 0 1-.2-1.3l.4-.7a1 1 0 0 1 1.2-.4l1.2.5 1.2-.7Z"/>',
}

# Sidebar destinations. A value may be a screen id in this file, or
# "file.html#s-id" to cross into another comp file.
GO = {
    "home": "s-home",
    "boards": "s-board",
    "ideas": "s-ideas",
    "roadmap": "comp-p-delivery.html#s-roadmap",
    "sprint": "comp-p-delivery.html#s-issue",
    "settings": "comp-p-admin.html#s-settings",
}
NAV = [
    ("Workspace", [("home", "Home", ""), ("boards", "Boards", "2"), ("ideas", "Ideas", "22")]),
    ("Delivery",  [("sprint", "Sprint board", ""), ("backlog", "Backlog", "16"), ("roadmap", "Roadmap", "")]),
    ("Configure", [("settings", "Settings", "")]),
]


def desk(active):
    """The product sidebar, with `active` marked as the current page."""
    r = ['    <aside class="side">',
         '      <div class="brand"><span class="mark">CG</span><b>Collega</b></div>',
         '      <div class="org">Acme Robotics</div>',
         '      <button class="palette" type="button" data-go="s-palette">'
         '<span>⌕</span><span>Search or jump…</span><span class="kbd" style="margin-left:auto">Ctrl K</span></button>']
    for label, items in NAV:
        r.append(f'      <div class="navlbl">{label}</div>')
        for key, text, ct in items:
            cur = ' aria-current="page"' if key == active else ''
            ct_html = f'<span class="ct num">{ct}</span>' if ct else ''
            ico = (f'<svg class="ic" width="15" height="15" viewBox="0 0 20 20" '
                   f'fill="currentColor" aria-hidden="true">{IC[key]}</svg>')
            go = f' data-go="{GO[key]}"' if key in GO else ''
            r.append(f'      <button class="nav"{cur}{go}>{ico}{text}{ct_html}</button>')
    r += ['      <div class="push"></div>',
          '      <div class="me"><span class="av">OA</span><div>'
          '<div style="font-size:14px;font-weight:600;line-height:1.43">Olivia Administer</div>'
          '<div class="cap faint">Org Admin</div></div></div>',
          '    </aside>']
    return "\n".join(r)


# ---------------------------------------------------------------- comp chrome

def chrome(comp, comps):
    """Screen tabs, cross-file links, and the role and state controls.

    All reviewer-facing, so it renders above the app frame — product copy and
    reviewer copy stay in separate voices, per the settled decision.
    """
    r = ['<nav class="switch" aria-label="Comp screens">',
         f'  <b>Comp P</b><span class="lbl">{comp["label"]}</span>']
    for sid, text in comp["screens"]:
        cur = ' aria-current="true"' if sid == comp["screens"][0][0] else ''
        r.append(f'  <button data-go="{sid}"{cur}>{text}</button>')
    r.append('  <span class="lbl" style="margin-left:auto">Other areas</span>')
    for other in comps:
        if other["file"] == comp["file"]:
            continue
        r.append(f'  <a class="xfile" href="{other["file"]}">{other["area"]}</a>')
    r.append('</nav>')

    r.append('<div class="ctl">')
    r.append('  <span class="grp"><span class="cap2">View as role</span>')
    for role in ROLES:
        pressed = "true" if role == "OrgAdmin" else "false"
        r.append(f'    <button type="button" data-role-set="{role}" aria-pressed="{pressed}">{role}</button>')
    r.append('  </span>')
    r.append('  <span class="grp"><span class="cap2">State</span>')
    for st in STATES:
        pressed = "true" if st == "normal" else "false"
        r.append(f'    <button type="button" data-state-set="{st}" aria-pressed="{pressed}">{st}</button>')
    r.append('  </span>')
    r.append('</div>')

    how = "\n".join(f'    <span>&bull; {h}</span>' for h in COMMON_HOW + comp.get("how", []))
    r.append(f'<div class="explore"><b>How to read this</b><span>{comp["explore"]}\n'
             f'  <span class="how">\n{how}\n  </span></span></div>')
    return "\n".join(r)


# Every file carries these; a comp adds its own with a "how" key.
COMMON_HOW = [
    "The tab bar above switches screens; <b>Other areas</b> jumps to another file.",
    "<b>View as role</b> and <b>State</b> re-render the current screen &mdash; they are live, not labels.",
    "Role and state carry across files, so a link keeps you where you were.",
]


PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body data-role="OrgAdmin">
{body}
<script>
  const screens = [...document.querySelectorAll('.screen')];
  const tabs = [...document.querySelectorAll('.switch button[data-go]')];

  function go(id) {{
    // A cross-file destination is "file.html#s-id" — follow it, carrying the
    // current role and state so the switcher survives the navigation.
    if (id.includes('.html')) {{
      const [file, frag] = id.split('#');
      const p = new URLSearchParams({{role: document.body.dataset.role}});
      if (frag) p.set('screen', frag);
      const st = document.querySelector('.screen[data-on="1"]');
      if (st && st.dataset.state && st.dataset.state !== 'normal') p.set('state', st.dataset.state);
      window.location.href = file + '?' + p.toString();
      return;
    }}
    if (!document.getElementById(id)) return;
    screens.forEach(s => s.dataset.on = (s.id === id) ? '1' : '0');
    tabs.forEach(t => t.setAttribute('aria-current', String(t.dataset.go === id)));
    window.scrollTo(0, 0);
  }}

  function setRole(role) {{
    document.body.dataset.role = role;
    document.querySelectorAll('[data-role-set]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.roleSet === role)));
  }}

  function setState(state) {{
    screens.forEach(s => s.dataset.state = state);
    document.querySelectorAll('[data-state-set]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.stateSet === state)));
  }}

  document.addEventListener('click', e => {{
    const r = e.target.closest('[data-role-set]');
    if (r) {{ setRole(r.dataset.roleSet); return; }}
    const s = e.target.closest('[data-state-set]');
    if (s) {{ setState(s.dataset.stateSet); return; }}
    const t = e.target.closest('[data-go]');
    if (t) {{ e.preventDefault(); go(t.dataset.go); }}
  }});

  document.addEventListener('keydown', e => {{
    // Guarded: not every file in the set carries a command palette.
    const pal = document.getElementById('s-palette');
    if (e.key === 'Escape' && pal && pal.dataset.on === '1') go(screens[0].id);
    if (e.key === 'k' && (e.metaKey || e.ctrlKey) && pal) {{ e.preventDefault(); go('s-palette'); }}
  }});

  // Honour ?role= / ?state= / ?screen= so a cross-file link lands in context.
  const q = new URLSearchParams(location.search);
  setState(q.get('state') || 'normal');
  setRole(q.get('role') || 'OrgAdmin');
  if (q.get('screen')) go(q.get('screen'));
</script>
</body>
</html>
"""

# ------------------------------------------------------------------ manifest

COMPS = [
    {"file": "comp-p-focus-roadmap.html", "area": "Core", "frag": "p_core.frag",
     "title": "Collega — Comp P: core workspace",
     "label": "Focus Desk · core workspace",
     "explore": "The surfaces every user touches, styled per <b>DESIGN.md</b>. "
                "This file is the locked direction; the other three extend it to the "
                "rest of the shipped product.",
     "how": ["<span class=\"k\">Ctrl K</span> opens the palette from any screen, "
             "<span class=\"k\">Esc</span> closes it.",
             "<b>Ideas list</b> carries the measured density cost of the 15px body."],
     "screens": [("s-home", "Home"), ("s-ideas", "Ideas list"), ("s-board", "Board"),
                 ("s-inspect", "Inspector"), ("s-palette", "Command palette")]},
    {"file": "comp-p-auth.html", "area": "Auth", "frag": "p_auth.frag",
     "title": "Collega — Comp P: auth and identity",
     "label": "Auth, account, and View As",
     "explore": "Everything that establishes who you are: signing in, joining an "
                "organization, changing a password, and acting as someone else.",
     "how": ["View As is the <b>only</b> way a Site Admin edits organization content, "
             "so it is an identity surface, not a convenience."],
     "screens": [("s-login", "Login")]},
    {"file": "comp-p-admin.html", "area": "Admin", "frag": "p_admin.frag",
     "title": "Collega — Comp P: settings and administration",
     "label": "Settings and administration",
     "explore": "The <code>/settings/*</code> area. Most of these screens are visible "
                "to admins only &mdash; switch the role control to see what each one shows.",
     "how": ["Actions a role cannot take render <b>disabled with a reason</b>, "
             "not hidden."],
     "screens": [("s-settings", "Statuses")]},
    {"file": "comp-p-delivery.html", "area": "Delivery", "frag": "p_delivery.frag",
     "title": "Collega — Comp P: delivery and roadmap",
     "label": "Delivery and roadmap · not yet built",
     "wip": "Not yet built. Issues &amp; Delivery is specified in "
            "<code>SPEC/20-feature-issues-and-delivery.md</code> but not implemented. "
            "These screens are a design target, not a record of what the product does.",
     "explore": "Delivery is the one area with no shipped implementation behind it. "
                "Every screen here carries the strip above.",
     "how": ["<b>Roadmap</b> carries the open cardinality question &mdash; a layout "
             "choice, not a decision.",
             "The Sprint board and the Promote-to-Issue gate are deliberately absent."],
     "screens": [("s-roadmap", "Roadmap"), ("s-issue", "Issue"), ("s-group", "Grouping")]},
]


def build(comp):
    body = (D / comp["frag"]).read_text()
    body = re.sub(r"@@DESK:(\w+)@@", lambda m: desk(m.group(1)), body)
    assert "@@" not in body, f'unsubstituted token in {comp["frag"]}'

    # The first screen in a file is the one that opens; the rest start hidden.
    # Owning this here means a fragment never has to keep it in sync.
    first = comp["screens"][0][0]
    wip = comp.get("wip")

    def open_tag(m):
        sid = m.group(2)
        tag = f'{m.group(1)} data-on="{"1" if sid == first else "0"}"'
        if not wip:
            return tag
        # data-wip on the section, and the strip as the section's first child —
        # inside the screen, outside the app frame, so no product surface ever
        # claims to be shippable when it is not.
        return f'{tag} data-wip><div class="wip"><b>Not built</b>{wip}</div'

    body = re.sub(r'(<section class="screen" id="(s-[a-z]+)")(?: data-on="[01]")?',
                  open_tag, body)

    html = PAGE.format(title=comp["title"], css=CSS,
                       body=chrome(comp, COMPS) + "\n" + body)
    (OUT / comp["file"]).write_text(html)
    print(f'{comp["file"]:28} {len(comp["screens"])} screens  '
          f'{len(html.splitlines()):5} lines  {len(html):7} bytes')


for c in COMPS:
    build(c)

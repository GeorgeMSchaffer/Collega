import pathlib, re

D = pathlib.Path(__file__).resolve().parent
OUT = D.parent

CSS = (D / "tokens.css").read_text() + (D / "extra.css").read_text()
assert "</style>" not in CSS

IC = {
 "home": '<path d="M10 2.6 2.8 8.3a1 1 0 0 0-.4.8V16a1.4 1.4 0 0 0 1.4 1.4h3.4v-4.6h5.6v4.6h3.4A1.4 1.4 0 0 0 17.6 16V9.1a1 1 0 0 0-.4-.8Z"/>',
 "boards": '<path d="M3 4.4A1.4 1.4 0 0 1 4.4 3h11.2A1.4 1.4 0 0 1 17 4.4v11.2a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 15.6Zm2 .6v10h3.2V5Zm5.2 0v6.4H15V5Z"/>',
 "ideas": '<path d="M10 2a5 5 0 0 0-3 9v1.6a1.4 1.4 0 0 0 1.4 1.4h3.2a1.4 1.4 0 0 0 1.4-1.4V11A5 5 0 0 0 10 2ZM8.2 15.6h3.6v.8a1.4 1.4 0 0 1-1.4 1.4h-.8a1.4 1.4 0 0 1-1.4-1.4Z"/>',
 "sprint": '<path d="M4 3h12v2H4Zm0 4h8v2H4Zm0 4h12v2H4Zm0 4h6v2H4Z"/>',
 "backlog": '<path d="M4 5h12v2H4Zm0 4h12v2H4Zm0 4h8v2H4Z"/>',
 "roadmap": '<path d="M3 5.5 7.5 4l5 1.5L17 4v10.5L12.5 16l-5-1.5L3 16Zm5 1.1v7.2l4 1.2V7.8Z"/>',
 "settings": '<path d="M10 7.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm-1.4-5.4a1 1 0 0 1 1-.8h.8a1 1 0 0 1 1 .8l.2 1.3 1.2.7 1.2-.5a1 1 0 0 1 1.2.4l.4.7a1 1 0 0 1-.2 1.3l-1 .8v1.4l1 .8a1 1 0 0 1 .2 1.3l-.4.7a1 1 0 0 1-1.2.4l-1.2-.5-1.2.7-.2 1.3a1 1 0 0 1-1 .8h-.8a1 1 0 0 1-1-.8l-.2-1.3-1.2-.7-1.2.5a1 1 0 0 1-1.2-.4l-.4-.7a1 1 0 0 1 .2-1.3l1-.8V8.1l-1-.8a1 1 0 0 1-.2-1.3l.4-.7a1 1 0 0 1 1.2-.4l1.2.5 1.2-.7Z"/>',
}
GO = {"home":"s-home","boards":"s-board","ideas":"s-ideas",
      "roadmap":"s-roadmap","settings":"s-settings"}
NAV = [
    ("Workspace", [("home","Home",""),("boards","Boards","2"),("ideas","Ideas","22")]),
    ("Delivery",  [("sprint","Sprint board",""),("backlog","Backlog","16"),("roadmap","Roadmap","")]),
    ("Configure", [("settings","Settings","")]),
]

def desk(active):
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
<body>
{body}
<script>
  const screens = [...document.querySelectorAll('.screen')];
  const tabs = [...document.querySelectorAll('.switch button[data-go]')];
  function go(id){{
    if (!document.getElementById(id)) return;
    screens.forEach(s => s.dataset.on = (s.id === id) ? '1' : '0');
    tabs.forEach(t => t.setAttribute('aria-current', String(t.dataset.go === id)));
    window.scrollTo(0,0);
  }}
  document.addEventListener('click', e => {{
    const t = e.target.closest('[data-go]');
    if (t) {{ e.preventDefault(); go(t.dataset.go); }}
  }});
  document.addEventListener('keydown', e => {{
    if (e.key === 'Escape' && document.getElementById('s-palette').dataset.on === '1') go('s-home');
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {{ e.preventDefault(); go('s-palette'); }}
  }});
</script>
</body>
</html>
"""

body = (D / "p_focus.frag").read_text()
body = re.sub(r"@@DESK:(\w+)@@", lambda m: desk(m.group(1)), body)
assert "@@" not in body, "unsubstituted token"
name = "comp-p-focus-roadmap.html"
html = PAGE.format(
    title="Collega — Comp P: Focus Desk + multi-parent roadmap (DESIGN.md)",
    css=CSS, body=body)
(OUT / name).write_text(html)
print(f"{name}: {len(html.splitlines())} lines, {len(html)} bytes")

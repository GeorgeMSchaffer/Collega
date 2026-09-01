import pathlib, re, sys

D = pathlib.Path(__file__).resolve().parent
OUT = D.parent

CSS = (D / "tokens.css").read_text()
assert "</style>" not in CSS, "CSS fragment must not close the style element"

NAV = [
    ("Discovery", [("boards", "Boards", ""), ("ideas", "Ideas", "42")]),
    ("Delivery",  [("sprint", "Sprint board", ""), ("backlog", "Backlog", "16"),
                   ("roadmap", "Roadmap", "")]),
]

def side(active):
    rows = ['    <aside class="side">',
            '      <div class="brand"><span class="mark">CG</span><b>Collega</b></div>',
            '      <div class="org">Acme Robotics</div>']
    for label, items in NAV:
        rows.append(f'      <div class="navlbl">{label}</div>')
        for key, text, ct in items:
            cur = ' aria-current="page"' if key == active else ''
            badge = f'<span class="ct">{ct}</span>' if ct else ''
            rows.append(f'      <button class="nav"{cur}>{text}{badge}</button>')
    rows += ['      <div class="push"></div>',
             '      <div class="me"><span class="av">OA</span><div>'
             '<div style="font-size:14px;font-weight:600;line-height:1.43">Olivia Administer</div>'
             '<div class="cap faint">Org Admin</div></div></div>',
             '    </aside>']
    return "\n".join(rows)

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
    if (e.key === 'Escape' && document.querySelector('.screen[data-on="1"] .drawer')) go('s-idea');
  }});
</script>
</body>
</html>
"""

COMPS = [
    ("o1_board.frag",    "comp-o-notion-01-board.html",
     "Collega — Comp O-1: Board (DESIGN.md / Notion direction probe)"),
    ("o2_idea.frag",     "comp-o-notion-02-idea-detail.html",
     "Collega — Comp O-2: Idea detail (DESIGN.md / Notion direction probe)"),
    ("o3_delivery.frag", "comp-o-notion-03-delivery.html",
     "Collega — Comp O-3: Delivery (DESIGN.md / Notion direction probe)"),
]

for frag, name, title in COMPS:
    body = (D / frag).read_text()
    body = re.sub(r"@@SIDE:(\w+)@@", lambda m: side(m.group(1)), body)
    assert "@@SIDE" not in body, f"unsubstituted sidebar token in {frag}"
    html = PAGE.format(title=title, css=CSS, body=body)
    (OUT / name).write_text(html)
    print(f"{name}: {len(html.splitlines())} lines, {len(html)} bytes")

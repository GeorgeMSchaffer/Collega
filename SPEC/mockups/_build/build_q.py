"""Build the comp Q set: comp P's screens on Tailwind CSS v4 + shadcn/ui.

Same fragments, same generators, same chrome as comp P — build_p.py does
all of that. What differs is the skin: every semantic class a fragment
uses is expanded into the utility string the matching shadcn/ui component
renders, so the output is what a shadcn project would put in the DOM, and
Tailwind is compiled over the generated files so the stylesheet contains
exactly the utilities they use.

    cd SPEC/mockups/_build/tw && npm ci      # once; pins tailwindcss
    python3 SPEC/mockups/_build/build_q.py   # -> comp-q-{focus-roadmap,auth,admin,delivery}.html

The registry below is the component map. Each entry names the shadcn
component it stands in for; the E0 slice of the conversion installs those.
"""

import copy, pathlib, re, subprocess, sys

D = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(D))
import build_p as P  # noqa: E402  (importable since its run is guarded)

TW = D / "tw"
OUT = D.parent

# ------------------------------------------------------------ the registry
# semantic class -> (shadcn component, utility classes it renders)

BTN_BASE = ("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md "
            "text-sm font-medium transition-colors focus-visible:outline-none "
            "focus-visible:ring-1 focus-visible:ring-ring")
BTN_VARIANT = {
    # Button variant="outline" is the plain .btn
    None:    "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
    "pri":   "border border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
    "sec2":  "border border-transparent bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
    "ghost": "border border-transparent hover:bg-accent hover:text-accent-foreground",
    "warn":  "border border-destructive/40 bg-background text-destructive hover:bg-destructive/10",
}
BTN_SIZE = {None: "h-9 px-4 py-2", "sm2": "h-8 px-3 text-xs"}

REG = {
    # -- sidebar (shadcn Sidebar) ------------------------------------------
    "side":    ("Sidebar", "flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground"),
    "brand":   ("SidebarHeader", "flex items-center gap-2 px-2 py-3 text-base font-semibold text-foreground"),
    "org":     ("SidebarHeader", "px-2 pb-3 text-xs font-medium text-muted-foreground"),
    "palette": ("SidebarInput", "mb-1 flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm text-muted-foreground shadow-xs hover:bg-accent"),
    "navlbl":  ("SidebarGroupLabel", "flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70"),
    "nav":     ("SidebarMenuButton", "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground"),
    "push":    ("—", "flex-1"),
    "me":      ("SidebarFooter", "flex items-center gap-2 border-t px-2 py-2.5 text-sm"),
    # -- page frame ---------------------------------------------------------
    "topbar":  ("SidebarInset header + Breadcrumb", "flex min-h-14 flex-wrap items-center gap-2 border-b bg-background px-6 py-2"),
    "crumb":   ("Breadcrumb", "text-sm text-muted-foreground [&_a]:text-muted-foreground [&_a:hover]:text-foreground [&_b]:font-medium [&_b]:text-foreground"),
    "spacer":  ("—", "flex-1"),
    "grow":    ("—", "min-w-0 flex-1"),
    "work":    ("SidebarInset main", "max-w-[1320px] min-w-0 flex-1 p-6"),
    "pgh":     ("page header", "mb-6 flex flex-wrap items-end gap-4"),
    "filters": ("toolbar", "mb-4 flex flex-wrap items-end gap-3"),
    "fw":      ("—", "min-w-40"),
    "wide":    ("—", "min-w-60 flex-1"),
    "kpis":    ("Card grid", "mb-6 grid grid-cols-4 gap-3"),
    "kpi":     ("Card", "rounded-lg border bg-card p-4 text-card-foreground shadow-xs"),
    "cols":    ("—", "grid grid-cols-[1.35fr_1fr] items-start gap-4"),
    "tip":     ("Alert", "mb-6 flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm"),
    "note":    ("Alert (reviewer note)", "mt-4 rounded-lg border border-l-4 border-l-primary bg-card px-4 py-3 text-sm text-muted-foreground"),
    # -- surfaces -----------------------------------------------------------
    "panel":   ("Card", "overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs"),
    "card":    ("Card", "rounded-lg border bg-card p-6 text-card-foreground shadow-xs"),
    "empty":   ("Empty state", "rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center"),
    "inspector": ("Docked panel (ResizablePanel)", "flex w-[400px] shrink-0 flex-col border-l bg-background"),
    "insp-head": ("SheetHeader", "space-y-1 border-b px-6 py-4"),
    "insp-body": ("—", "flex flex-1 flex-col gap-6 overflow-auto px-6 py-4"),
    "insp-foot": ("SheetFooter", "mt-auto flex gap-2 border-t px-6 py-3"),
    "cp-back":   ("DialogOverlay", "fixed inset-0 z-50 grid items-start justify-center bg-black/60 pt-[12vh]"),
    "cp":        ("CommandDialog", "h-fit w-[min(620px,92vw)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"),
    "q":         ("CommandInput wrapper", "flex items-center gap-2 border-b px-3"),
    "grp":       ("CommandGroup heading", "px-3 py-1.5 text-xs font-medium text-muted-foreground"),
    "it":        ("CommandItem", "relative mx-1 flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"),
    "cpfoot":    ("Command footer", "flex gap-4 border-t bg-muted/50 px-3 py-2 text-xs text-muted-foreground"),
    "gate":      ("DialogContent", "h-fit w-[min(560px,92vw)] rounded-lg border bg-background p-6 shadow-lg"),
    "chatm":     ("DialogContent (720px)", "flex max-h-[86vh] w-[min(720px,92vw)] flex-col overflow-hidden rounded-lg border bg-background shadow-lg"),
    "banner":    ("Alert (persistent)", "flex items-center gap-4 border-b border-warning/60 bg-warning/15 px-6 py-2.5 text-sm"),
    # -- controls -----------------------------------------------------------
    "iconbtn":   ("Button size=icon variant=outline", "inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-sm shadow-xs hover:bg-accent"),
    "seg":       ("Tabs / ToggleGroup", "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground"),
    "up":        ("Toggle size=sm", "inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent"),
    "mine":      ("Toggle pressed", "border-primary text-primary"),
    "addtask":   ("Button variant=ghost (dashed)", "mt-3 w-full rounded-md border border-dashed bg-transparent px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"),
    "tstate":    ("Select size=sm", "h-8 w-[118px] shrink-0 text-xs"),
    "sug-clear": ("Button variant=link", "ml-2 text-xs text-teal underline"),
    "cand":      ("CommandItem (row button)", "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"),
    # -- badges and marks ---------------------------------------------------
    "marker":  ("Badge variant=secondary", "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground"),
    "rmtag":   ("Badge variant=secondary", "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground"),
    "tag":     ("Badge variant=outline", "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground"),
    "badge":   ("Badge variant=outline", "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold text-primary"),
    "chip":    ("Badge variant=secondary (removable)", "inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs"),
    "key":     ("Badge (mono)", "inline-block rounded-sm border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums"),
    "kbd":     ("Kbd", "rounded-sm border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"),
    "dot":     ("—", "inline-block size-2 shrink-0 rounded-full bg-muted-foreground"),
    "av":      ("Avatar", "flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground"),
    "avstack": ("Avatar group", "flex [&>.av]:ring-2 [&>.av]:ring-background [&>.av+.av]:-ml-1"),
    "sugchip": ("Badge (suggested)", "ml-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-teal before:size-1.5 before:rounded-full before:bg-teal before:content-['']"),
    "sug-input": ("Input (suggested)", "border-l-[3px] border-l-teal bg-teal/10"),
    "archtag": ("Badge variant=outline", "ml-1.5 inline-block rounded-sm border px-1 align-middle text-[10px] uppercase text-muted-foreground"),
    "tbadge":  ("Badge variant=secondary", "inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"),
    "invite":  ("Badge (mono)", "inline-block whitespace-nowrap rounded-sm border bg-muted px-2 py-0.5 font-mono text-xs tracking-wider"),
    # -- feedback -----------------------------------------------------------
    "alert":    ("Alert variant=destructive", "relative grid w-full gap-1 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive [&>span]:block"),
    "warn":     ("Alert (default)", ""),  # resolved in expand(): .alert.warn / .btn.warn differ
    "authnote": ("Alert", "relative w-full rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground"),
    "skel":     ("Skeleton", "mt-2 block h-3 animate-pulse rounded-md bg-primary/10"),
    "denied":   ("FormDescription (reason)", "text-xs italic text-muted-foreground"),
    "deniedwrap": ("—", "inline-flex items-center gap-2"),
    "sysnote":  ("Alert (system note)", "rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"),
    # -- forms --------------------------------------------------------------
    "field":    ("FormItem", "mb-4"),
    "hint":     ("FormDescription", "text-[0.8rem] text-muted-foreground"),
    "msg":      ("FormMessage", "text-[0.8rem] font-medium text-destructive"),
    "req":      ("—", "text-destructive"),
    "charcount": ("FormDescription", "mt-1 text-right text-xs text-muted-foreground"),
    "radioset": ("RadioGroup", "flex gap-2"),
    "pick":     ("Command list / checkbox list", "rounded-md border"),
    "pickrow":  ("CommandItem", "flex items-center gap-2 border-t px-3 py-2 text-sm first:border-t-0 hover:bg-accent/50"),
    "chips":    ("—", "mb-1.5 flex flex-wrap gap-1.5"),
    "ff":       ("—", "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4"),
    "range":    ("—", "flex items-center gap-1.5 [&>input]:min-w-0 [&>input]:flex-1"),
    "vh":       ("sr-only", "sr-only"),
    "mono":     ("—", "font-mono tracking-wider"),
    # -- lists and tables ---------------------------------------------------
    "pgfoot":  ("Pagination", "flex flex-wrap items-center gap-3 border-t bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground"),
    "bd":      ("—", "mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"),
    "t":       ("—", "font-medium"),
    "feed":    ("—", "m-0 list-none divide-y p-0"),
    "kv":      ("DescriptionList", "grid grid-cols-[104px_1fr] gap-x-4 gap-y-2 text-sm"),
    "sec-t":   ("—", "mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"),
    "tagrow":  ("—", "flex flex-wrap gap-1.5"),
    "chipbar": ("—", "flex flex-wrap items-center gap-2"),
    "vaorg":   ("CommandGroup heading", "mt-4 mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"),
    "dz":      ("—", "mt-6 border-t pt-4"),
    "acts":    ("—", "flex flex-wrap items-center gap-0.5"),
    # -- board and delivery ------------------------------------------------
    "lanes":    ("ScrollArea (horizontal)", "flex items-start gap-3 overflow-x-auto pb-3"),
    "lane":     ("—", "w-72 shrink-0 rounded-lg border bg-muted/50 p-2"),
    "lanehd":   ("—", "flex items-center gap-2 px-2 pt-1 pb-2"),
    "kcard":    ("Card (compact)", "mb-1.5 cursor-grab rounded-lg border bg-card p-3 shadow-xs hover:shadow-sm"),
    "emptylane": ("—", "mb-1.5 rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground"),
    "sprintbar": ("Card", "mb-4 flex items-center gap-4 rounded-lg border bg-card px-4 py-3 shadow-xs"),
    "task":     ("Checkbox row", "flex items-start gap-2.5 border-b py-3 text-sm last:border-0"),
    "roadwrap": ("Card", "overflow-hidden rounded-lg border"),
    "barx":     ("Badge variant=outline", "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-muted px-2 py-0.5 text-xs font-medium"),
    "sum":      ("Card footer", "flex flex-wrap gap-6 border-t bg-muted/50 px-4 py-2 text-sm text-muted-foreground"),
    # -- chat ---------------------------------------------------------------
    "chat":     ("ScrollArea", "flex flex-col gap-3 overflow-auto px-6 py-4"),
    "bub":      ("—", "max-w-[78%] rounded-lg px-3 py-2 text-sm"),
    "strip":    ("—", "flex flex-wrap items-center gap-4 border-y bg-muted/50 px-6 py-2 text-sm text-muted-foreground"),
    "composer": ("—", "flex items-start gap-2 px-6 py-3"),
    "chatfoot": ("DialogFooter", "flex items-center gap-2 border-t px-6 py-3"),
    # -- auth ---------------------------------------------------------------
    "authwrap":  ("—", "grid min-h-[calc(100vh-70px)] grid-cols-[1.05fr_.95fr]"),
    "authpitch": ("—", "flex flex-col justify-center bg-primary px-14 py-16 text-primary-foreground"),
    "authform":  ("—", "flex flex-col justify-center bg-background px-14 py-16"),
    "foot2":     ("—", "mt-4 text-sm text-muted-foreground"),
    # -- text utilities the fragments use ------------------------------------
    "num":   ("—", "tabular-nums"),
    "faint": ("—", "text-muted-foreground/70"),
    "muted": ("—", "text-muted-foreground"),
    "sec":   ("—", "text-foreground/80"),
    "sm":    ("—", "text-sm"),
    "cap":   ("—", "text-xs"),
    "prose": ("—", "text-sm leading-relaxed text-foreground/90"),
    "eyebrow": ("—", "text-xs font-medium uppercase tracking-wide text-muted-foreground"),
    "title": ("CardTitle", "text-base font-semibold leading-none tracking-tight"),
    "meta":  ("SheetDescription", "text-xs text-muted-foreground"),
    "lede":  ("CardDescription", ""),  # styled in q.css (needs the panel context)
    "in":    ("CardContent", ""),      # styled in q.css (panel vs authform)
}

# Tokens whose utilities depend on a sibling token.
def expand(classlist):
    toks = classlist.split()
    s = set(toks)
    out = list(toks)
    if "btn" in s:
        variant = next((v for v in ("pri", "sec2", "ghost", "warn") if v in s), None)
        size = "sm2" if "sm2" in s else None
        out += [BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size]]
    if "alert" in s and "warn" in s:
        out.append("relative w-full rounded-lg border border-warning/60 bg-warning/10 px-4 py-3 "
                   "text-sm text-foreground [&>span]:block")
    elif "alert" in s:
        out.append(REG["alert"][1])
    if "av" in s and "s" in s:
        out.append("size-5 text-[9px]")
    if "bub" in s:
        out.append(REG["bub"][1])
        if "me" in s:
            out.append("self-end bg-primary/10")
        if "ai" in s:
            out.append("self-start bg-muted")
        if "ghost" in s:
            out.append("opacity-50 line-through")
    # tokens whose meaning depends on a sibling are handled above, never here
    skip = {"btn", "alert", "bub", "warn", "s", "on", "sel", "done", "ro", "bad"}
    if "bub" in s:
        skip |= {"me", "ai", "ghost"}
    for t in toks:
        if t in skip:
            continue
        if t in REG and REG[t][1]:
            out.append(REG[t][1])
    # dedupe, keep order
    return " ".join(dict.fromkeys(" ".join(out).split()))


def post(body):
    body = re.sub(r'class="([^"]*)"', lambda m: f'class="{expand(m.group(1))}"', body)
    # comp P's --secondary is its dark pitch band; shadcn's --secondary is a
    # soft grey. The one inline use of it as a brand colour maps to primary.
    body = body.replace("var(--secondary)", "var(--primary)")
    return body


# --------------------------------------------------------------- manifest
COMPS = copy.deepcopy(P.COMPS)
for c in COMPS:
    c["file"] = c["file"].replace("comp-p-", "comp-q-")
    c["title"] = c["title"].replace("Comp P", "Comp Q")
    c["how"] = c.get("how", []) + [
        "Same fragments as comp P; every class is expanded to what the matching "
        "<b>shadcn/ui</b> component renders, and Tailwind is compiled over the result."]
COMPS[0]["explore"] = (
    "Comp P&rsquo;s locked structure, IA and copy on <b>Tailwind CSS v4 + shadcn/ui</b>, the "
    "framework the conversion will use. Radius, type scale, control heights and colour "
    "roles are the framework&rsquo;s defaults on a theme carrying the 2026-08-31 palette "
    "and Geist. Compare any screen against its comp P twin.")

P.BRAND = "Comp Q"
P.FONT_LINK = ('<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700'
               '&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">')
P.POST = post
P.CSS = "/*@@QCSS@@*/"
P.COMPS = COMPS

if __name__ == "__main__":
    for c in COMPS:
        P.build(c)

    # Compile Tailwind over the four generated files, then inline the result.
    # The stylesheet is shared, so it is compiled once.
    cli = TW / "node_modules" / ".bin" / "tailwindcss"
    assert cli.exists(), f"run `npm ci` in {TW} first"
    (TW / "input.css").write_text((D / "q.css").read_text())
    out_css = TW / "out.css"
    subprocess.run([str(cli), "-i", str(TW / "input.css"), "-o", str(out_css)],
                   check=True, capture_output=True, text=True)
    css = out_css.read_text()
    assert "</style>" not in css
    for c in COMPS:
        f = OUT / c["file"]
        html = f.read_text()
        assert "/*@@QCSS@@*/" in html
        f.write_text(html.replace("/*@@QCSS@@*/", css, 1))
    print(f"tailwind: {len(css.splitlines())} lines inlined into {len(COMPS)} files")

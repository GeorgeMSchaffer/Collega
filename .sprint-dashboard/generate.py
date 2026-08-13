#!/usr/bin/env python3
"""Generate a Jira-style sprint dashboard for Collega.

Everything on the board is read live at generation time from SPEC/, git, and the
local Claude Code session transcripts — no state is hardcoded here. Run it on a
loop (see run.sh); it rewrites dashboard.html in place.
"""

import html
import json
import os
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SPEC = REPO / "SPEC"
OUT = HERE / "dashboard.html"
STATE = HERE / "state.json"
EVENTS = HERE / "events.jsonl"
SESSIONS = Path.home() / ".claude" / "projects" / str(REPO).replace("/", "-")

TAIL_BYTES = 512 * 1024
HEAD_BYTES = 256 * 1024
MAX_SESSIONS = 12
SESSION_WINDOW_H = 24


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def git(*args, cwd=None, default=""):
    try:
        return subprocess.run(
            ["git", "-C", str(cwd or REPO), *args],
            capture_output=True, text=True, timeout=20, check=True,
        ).stdout.strip()
    except Exception:
        return default


def read(path):
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def md_inline(text):
    text = html.escape(str(text).strip())
    text = re.sub(r"~~(.+?)~~", r'<span class="strike">\1</span>', text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<span class="ref">\1</span>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return text


def strip_md(text):
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", str(text))
    text = re.sub(r"[*`_~]", "", text)
    return text.strip()


def clip(text, n):
    text = " ".join(str(text).split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def ago(seconds):
    s = int(max(0, seconds))
    if s < 45:
        return "just now"
    if s < 3600:
        return "%dm ago" % (s // 60)
    if s < 86400:
        h, m = divmod(s // 60, 60)
        return "%dh %dm ago" % (h, m) if m else "%dh ago" % h
    return "%dd ago" % (s // 86400)


def section(body, heading_re, level=2):
    lines = body.splitlines()
    hashes = "#" * level
    start = None
    for i, line in enumerate(lines):
        if line.startswith(hashes + " ") and re.search(heading_re, line, re.I):
            start = i + 1
            break
    if start is None:
        return []
    out = []
    for line in lines[start:]:
        if re.match(r"^#{1,%d} " % level, line):
            break
        out.append(line)
    return out


def table_rows(lines):
    rows = []
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if not cells or all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
            continue
        rows.append(cells)
    return rows[1:] if rows else []


# --------------------------------------------------------------------------
# SPEC parsers
# --------------------------------------------------------------------------

def parse_sprint_index():
    body = read(SPEC / "95-next-sprints.md")
    sprints = []
    for cells in table_rows(body.splitlines()):
        if len(cells) < 5 or not re.fullmatch(r"\d+", cells[0]):
            continue
        m = re.search(r"`([^`]*sprints/[^`]+\.md)`", cells[2])
        sprints.append({
            "num": int(cells[0]),
            "name": strip_md(cells[1]),
            "path": (REPO / m.group(1)) if m else None,
            "index_status": strip_md(cells[3]),
            "size": strip_md(cells[4]),
        })
    return sorted(sprints, key=lambda s: s["num"])


def parse_sprint_file(sprint):
    body = read(sprint["path"]) if sprint["path"] else ""
    sprint.update({"found": bool(body), "status": sprint["index_status"],
                   "dod": [], "backlog": [], "goal": "", "roles": [],
                   "hard_blocked": False, "gates": []})
    if not body:
        return sprint

    m = re.search(r"^\*\*Status:\*\*\s*(.+)$", body, re.M)
    if m:
        sprint["status"] = strip_md(re.split(r"\s+[—-]\s+", m.group(1))[0])

    goal = [l for l in section(body, r"^##\s*Goal") if l.strip()]
    if goal:
        sprint["goal"] = clip(strip_md(goal[0]), 250)

    for line in body.splitlines():
        m = re.match(r"^\s*-\s*\[( |x|X)\]\s*(.+)$", line)
        if m:
            sprint["dod"].append({"done": m.group(1).lower() == "x",
                                  "text": m.group(2)})

    for cells in table_rows(section(body, r"^##\s*Sprint Backlog")):
        if len(cells) < 2:
            continue
        m = re.search(r"P(\d)", strip_md(cells[0]))
        if m:
            sprint["backlog"].append({
                "pri": "P" + m.group(1),
                "first": "first" in cells[0].lower(),
                "item": strip_md(cells[1]),
            })

    for cells in table_rows(section(body, r"^##\s*Capacity")):
        if len(cells) >= 2 and "total" not in cells[0].lower():
            sprint["roles"].append(strip_md(cells[0]))

    if re.search(r"hard\s+(blocker|dependency)", body, re.I):
        sprint["hard_blocked"] = True

    # blocking prerequisite slices, e.g. "## Slice 0 — Authorization audit (blocking …)"
    for line in body.splitlines():
        m = re.match(r"^##\s+(Slice\s+\d+\s*[—:-]?\s*.+)$", line)
        if m and re.search(r"block", line, re.I):
            title = strip_md(m.group(1))
            detail = [l for l in section(body, re.escape(m.group(1)[:24])) if l.strip()]
            sprint["gates"].append({
                "title": re.sub(r"\s*\(.*\)\s*$", "", title),
                "detail": clip(strip_md(detail[0]), 260) if detail else "",
            })
    return sprint


def parse_bug_triage():
    body = read(SPEC / "Bug Triage.md")
    items = []
    for line in section(body, r"^##\s*TODO"):
        s = line.strip().lstrip("*").strip()
        if not s or line.strip().startswith("#"):
            continue
        if not line.strip().startswith("*"):
            continue
        m = re.match(r"^\[(.+?)\]\s*(.*)$", strip_md(s), re.S)
        title, detail = (m.group(1), m.group(2)) if m else (strip_md(s), "")
        items.append({"title": clip(title, 120), "detail": detail.strip()})
    return items


def parse_tracker():
    body = read(SPEC / "implementation-agent-tracker.md")
    info = {"verified_date": "", "verified_commit": "", "tests": "",
            "rows": [], "decisions": [], "notes": []}

    m = re.search(r"\*\*Verified\s+([\d-]+)\s+against\s+`([0-9a-f]+)`", body)
    if m:
        info["verified_date"], info["verified_commit"] = m.group(1), m.group(2)

    for cells in table_rows(section(body, r"^##\s*Current Status")):
        if len(cells) >= 3:
            info["rows"].append({"area": strip_md(cells[0]),
                                 "state": strip_md(cells[1]),
                                 "detail": strip_md(cells[2])})
            if re.search(r"test suite", cells[0], re.I):
                t = re.search(r"([\d,]+)\s*green", cells[1])
                if t:
                    info["tests"] = t.group(1)

    for line in section(body, r"Locked decisions", level=3):
        s = line.strip()
        if s.startswith("-"):
            info["decisions"].append(strip_md(s.lstrip("- ")))

    for line in body.splitlines():
        m = re.match(r"^###\s+(Sprint\s+\d+\s*[—-]\s*.+)$", line)
        if m:
            det = [l for l in section(body, re.escape(m.group(1)[:20]), level=3)
                   if l.strip()]
            info["notes"].append({"head": strip_md(m.group(1)),
                                  "body": clip(strip_md(det[0]), 300) if det else ""})
    return info


def parse_open_decisions():
    out = []
    for path in sorted(SPEC.glob("*.md")) + sorted(SPEC.glob("sprints/*.md")):
        body = read(path)
        for line in section(body, r"Open items requiring a human decision"):
            s = line.strip()
            if not s.startswith("-"):
                continue
            s = s.lstrip("- ").strip()
            if s.startswith("~~"):
                continue
            out.append({"source": path.name, "text": clip(strip_md(s), 190)})
    return out


# --------------------------------------------------------------------------
# git
# --------------------------------------------------------------------------

def parse_git():
    log = git("log", "--pretty=format:%h\x1f%ad\x1f%an\x1f%s", "--date=short", "-14")
    commits = []
    for line in log.splitlines():
        p = line.split("\x1f")
        if len(p) == 4:
            commits.append({"sha": p[0], "date": p[1], "author": p[2], "subject": p[3]})
    dirty = [l for l in git("status", "--porcelain").splitlines() if l.strip()]
    counts = Counter(git("log", "--pretty=format:%ad", "--date=short",
                         "--since=21.days").splitlines())
    today = datetime.now().date()
    spark = [(today - timedelta(days=i),
              counts.get(str(today - timedelta(days=i)), 0)) for i in range(20, -1, -1)]
    return {
        "branch": git("rev-parse", "--abbrev-ref", "HEAD", default="?"),
        "head": git("rev-parse", "--short", "HEAD", default="?"),
        "commits": commits, "dirty": dirty, "spark": spark,
    }


ROLE_PATTERNS = [
    (r"review|audit|slice-?0", "Code Reviewer"),
    (r"qa|test|spec-?test", "QA Developer"),
    (r"ui|ux|client|blazor|comp", "UI/UX Developer"),
    (r"backend|api|domain|infra|service", "Backend Developer"),
    (r"doc|spec", "Docs / Spec"),
]


def infer_role(text):
    t = (text or "").lower()
    for pat, role in ROLE_PATTERNS:
        if re.search(pat, t):
            return role
    return "Implementer"


def parse_worktrees():
    out = []
    block = {}
    for line in git("worktree", "list", "--porcelain").splitlines() + [""]:
        if not line.strip():
            if block.get("worktree"):
                out.append(block)
            block = {}
            continue
        k, _, v = line.partition(" ")
        block[k] = v
    trees = []
    for b in out:
        path = Path(b["worktree"])
        branch = b.get("branch", "").replace("refs/heads/", "") or "(detached)"
        is_main = path.resolve() == REPO.resolve()
        last = git("log", "-1", "--pretty=%h\x1f%s\x1f%ar", cwd=path).split("\x1f")
        dirty = [l for l in git("status", "--porcelain", cwd=path).splitlines() if l.strip()]
        trees.append({
            "path": str(path), "name": path.name, "branch": branch, "main": is_main,
            "sha": last[0] if last else "", "subject": last[1] if len(last) > 1 else "",
            "when": last[2] if len(last) > 2 else "",
            "dirty": len(dirty), "role": infer_role(branch + " " + path.name),
        })
    return trees


# --------------------------------------------------------------------------
# agent activity — local Claude Code session transcripts
# --------------------------------------------------------------------------

def _text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return " ".join(parts)
    return ""


def _iter_json(raw):
    for line in raw.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            yield json.loads(line)
        except Exception:
            continue


def parse_agents():
    """One entry per local Claude session recently active on this repo."""
    agents = []
    if not SESSIONS.is_dir():
        return agents
    now = datetime.now().timestamp()
    files = sorted(SESSIONS.glob("*.jsonl"), key=lambda p: p.stat().st_mtime,
                   reverse=True)[:MAX_SESSIONS]

    for path in files:
        try:
            st = path.stat()
        except OSError:
            continue
        age = now - st.st_mtime
        if age > SESSION_WINDOW_H * 3600:
            continue

        task, branch, cwd = "", "", ""
        try:
            with path.open("rb") as fh:
                head = fh.read(HEAD_BYTES).decode("utf-8", "replace")
                if st.st_size > TAIL_BYTES:
                    fh.seek(-TAIL_BYTES, os.SEEK_END)
                    tail = fh.read().decode("utf-8", "replace")
                else:
                    tail = head
        except OSError:
            continue

        for obj in _iter_json(head):
            if obj.get("type") == "user" and not obj.get("isSidechain"):
                t = _text_of(obj.get("message", {}).get("content"))
                if t and not t.startswith("<"):
                    task = t
                    branch = obj.get("gitBranch", "")
                    cwd = obj.get("cwd", "")
                    break

        subagent, doing, turns, sidechains = "", "", 0, 0
        for obj in _iter_json(tail):
            typ = obj.get("type")
            if obj.get("gitBranch"):
                branch = obj["gitBranch"]
            if obj.get("cwd"):
                cwd = obj["cwd"]
            if typ == "user":
                if obj.get("isSidechain"):
                    sidechains += 1
                    t = _text_of(obj.get("message", {}).get("content"))
                    if t:
                        subagent = t
                else:
                    turns += 1
                    t = _text_of(obj.get("message", {}).get("content"))
                    if t and not t.startswith("<"):
                        doing = t
            elif typ == "assistant":
                for block in obj.get("message", {}).get("content", []) or []:
                    if isinstance(block, dict) and block.get("type") == "tool_use":
                        name = block.get("name", "")
                        if name:
                            doing_tool = name
                            obj["_tool"] = doing_tool

        last_tool = ""
        for obj in reversed(list(_iter_json(tail))):
            if obj.get("type") == "assistant":
                for block in reversed(obj.get("message", {}).get("content", []) or []):
                    if isinstance(block, dict) and block.get("type") == "tool_use":
                        last_tool = block.get("name", "")
                        break
            if last_tool:
                break

        if age < 120:
            state, label = "working", "working now"
        elif age < 900:
            state, label = "active", "active"
        else:
            state, label = "idle", "idle"

        agents.append({
            "id": path.stem[:8], "full": path.stem, "task": task or "(no prompt captured)",
            "current": doing or task, "subagent": subagent, "sidechains": sidechains,
            "turns": turns, "tool": last_tool, "branch": branch or "?",
            "cwd": Path(cwd).name if cwd else REPO.name, "age": age,
            "state": state, "label": label, "size_mb": st.st_size / 1e6,
        })
    return agents


# --------------------------------------------------------------------------
# change tracking — diff this refresh against the previous one
# --------------------------------------------------------------------------

def make_snapshot(sprints, tracker, g, blocker_index, agents):
    return {
        "head": g["head"],
        "branch": g["branch"],
        "dirty": len(g["dirty"]),
        "tests": tracker["tests"],
        "verified": tracker["verified_commit"],
        "sprints": {str(s["num"]): {
            "status": s.get("status", ""),
            "dod_done": sum(1 for d in s["dod"] if d["done"]),
            "dod_total": len(s["dod"]),
            "checked": [d["text"] for d in s["dod"] if d["done"]],
        } for s in sprints},
        "blockers": blocker_index,
        "agents": {a["full"]: a["state"] for a in agents},
    }


def diff_and_log(snap):
    """Compare against the last snapshot, append new events, return the feed."""
    prev = None
    if STATE.exists():
        try:
            prev = json.loads(STATE.read_text(encoding="utf-8"))
        except Exception:
            prev = None

    events = []

    def ev(kind, text):
        events.append({"ts": datetime.now().isoformat(timespec="seconds"),
                       "kind": kind, "text": text})

    if prev:
        if prev.get("head") != snap["head"]:
            new = git("log", "--pretty=format:%h %s",
                      "%s..%s" % (prev.get("head"), snap["head"])).splitlines()
            if new:
                for line in reversed(new[:8]):
                    ev("commit", line)
            else:
                ev("commit", "HEAD moved %s → %s" % (prev.get("head"), snap["head"]))

        if prev.get("branch") != snap["branch"]:
            ev("branch", "branch %s → %s" % (prev.get("branch"), snap["branch"]))

        if bool(prev.get("dirty")) != bool(snap["dirty"]):
            ev("tree", "working tree %s (%d changed)"
               % ("dirty" if snap["dirty"] else "clean again", snap["dirty"]))

        if prev.get("tests") != snap["tests"] and snap["tests"]:
            ev("tests", "test count %s → %s" % (prev.get("tests") or "?", snap["tests"]))

        if prev.get("verified") != snap["verified"] and snap["verified"]:
            ev("tracker", "tracker re-verified against %s" % snap["verified"])

        ps, cs = prev.get("sprints", {}), snap["sprints"]
        for num, cur in cs.items():
            old = ps.get(num)
            if not old:
                continue
            if old.get("status") != cur["status"]:
                ev("sprint", "Sprint %s: %s → %s"
                   % (num, old.get("status") or "?", cur["status"]))
            gained = [t for t in cur["checked"] if t not in (old.get("checked") or [])]
            for t in gained:
                ev("dod", "Sprint %s DoD %d/%d — %s"
                   % (num, cur["dod_done"], cur["dod_total"], clip(strip_md(t), 110)))

        pb, cb = prev.get("blockers", {}), snap["blockers"]
        for key, title in cb.items():
            if key not in pb:
                ev("blocker", "new blocker %s — %s" % (key, clip(title, 90)))
        for key, title in pb.items():
            if key not in cb:
                ev("cleared", "blocker cleared %s — %s" % (key, clip(title, 90)))

        pa, ca = prev.get("agents", {}), snap["agents"]
        for sid, state in ca.items():
            old = pa.get(sid)
            if old is None:
                ev("agent", "new agent session %s" % sid[:8])
            elif old != state and state == "working":
                ev("agent", "session %s resumed working" % sid[:8])
            elif old == "working" and state != "working":
                ev("agent", "session %s went quiet" % sid[:8])

    try:
        if events:
            with EVENTS.open("a", encoding="utf-8") as fh:
                for e in events:
                    fh.write(json.dumps(e) + "\n")
        STATE.write_text(json.dumps(snap, indent=1), encoding="utf-8")
    except OSError:
        pass

    feed = []
    if EVENTS.exists():
        try:
            lines = EVENTS.read_text(encoding="utf-8").splitlines()[-400:]
            for line in lines:
                try:
                    feed.append(json.loads(line))
                except Exception:
                    continue
        except OSError:
            pass
    return list(reversed(feed))[:24], len(events)


# --------------------------------------------------------------------------
# board assembly
# --------------------------------------------------------------------------

def classify(sprints):
    cols = {"Backlog": [], "Up Next": [], "In Progress": [], "Done": []}
    up_next_taken = False
    for s in sprints:
        st = (s.get("status") or "").lower()
        if st.startswith("complete"):
            cols["Done"].append(s)
        elif "in progress" in st:
            cols["In Progress"].append(s)
        elif not up_next_taken:
            cols["Up Next"].append(s)
            up_next_taken = True
        else:
            cols["Backlog"].append(s)
    return cols


def dod_progress(sprint):
    dod = sprint.get("dod") or []
    if not dod:
        return None
    done = sum(1 for d in dod if d["done"])
    return done, len(dod), round(100 * done / len(dod))


# --------------------------------------------------------------------------
# rendering
# --------------------------------------------------------------------------

CSS = """
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#f4f5f7;--surface:#fff;--surface-2:#ebecf0;--col:#f1f2f4;
  --ink:#172b4d;--ink-2:#44546f;--ink-3:#626f86;--line:#dcdfe4;
  --accent:#0c66e4;--accent-soft:#e9f2ff;--done:#216e4e;--done-soft:#dcfff1;
  --warn:#a54800;--warn-soft:#fff4e5;--danger:#c9372c;--danger-soft:#ffeceb;
  --purple:#5e4db2;--purple-soft:#f3f0ff;
  --shadow:0 1px 1px rgba(9,30,66,.16),0 0 1px rgba(9,30,66,.12);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#1d2125;--surface:#22272b;--surface-2:#2c333a;--col:#161a1d;
  --ink:#dee4ea;--ink-2:#9fadbc;--ink-3:#8595a4;--line:#333b43;
  --accent:#579dff;--accent-soft:#1c2b41;--done:#7ee2b8;--done-soft:#1c3329;
  --warn:#f5cd47;--warn-soft:#3b2c14;--danger:#ff9c8f;--danger-soft:#42221f;
  --purple:#b8acf6;--purple-soft:#2b273f;
  --shadow:0 1px 1px rgba(0,0,0,.5),0 0 1px rgba(0,0,0,.4);
}}
:root[data-theme="dark"]{
  --bg:#1d2125;--surface:#22272b;--surface-2:#2c333a;--col:#161a1d;
  --ink:#dee4ea;--ink-2:#9fadbc;--ink-3:#8595a4;--line:#333b43;
  --accent:#579dff;--accent-soft:#1c2b41;--done:#7ee2b8;--done-soft:#1c3329;
  --warn:#f5cd47;--warn-soft:#3b2c14;--danger:#ff9c8f;--danger-soft:#42221f;
  --purple:#b8acf6;--purple-soft:#2b273f;
  --shadow:0 1px 1px rgba(0,0,0,.5),0 0 1px rgba(0,0,0,.4);
}
body{margin:0;background:var(--bg);color:var(--ink);
  font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;
  background:var(--surface-2);padding:1px 4px;border-radius:3px}
.strike{text-decoration:line-through;opacity:.6}
.ref{color:var(--accent)}
h2.sec{margin:22px 20px 0;font-size:11.5px;font-weight:700;text-transform:uppercase;
  letter-spacing:.09em;color:var(--ink-3)}

header{position:sticky;top:0;z-index:20;background:var(--surface);
  border-bottom:1px solid var(--line);padding:10px 20px}
.bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.crumb{font-size:12px;color:var(--ink-3)}
h1{margin:0;font-size:19px;font-weight:600;letter-spacing:-.01em}
.spacer{flex:1 1 auto}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;
  padding:3px 9px;border-radius:999px;white-space:nowrap}
.pill.ok{background:var(--done-soft);color:var(--done)}
.pill.warn{background:var(--warn-soft);color:var(--warn)}
.pill.bad{background:var(--danger-soft);color:var(--danger)}
.pill.info{background:var(--accent-soft);color:var(--accent)}
.pill.mute{background:var(--surface-2);color:var(--ink-2)}
.dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.live .dot,.st-working .dot{animation:blink 1.8s ease-in-out infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(156px,1fr));
  gap:10px;padding:14px 20px 2px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:6px;
  padding:10px 12px;box-shadow:var(--shadow)}
.stat .k{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;
  color:var(--ink-3);font-weight:700}
.stat .v{font-size:21px;font-weight:600;margin-top:3px;letter-spacing:-.02em}
.stat .s{font-size:11.5px;color:var(--ink-3);margin-top:1px}
.stat.alert{border-color:var(--warn)}.stat.alert .v{color:var(--warn)}
.stat.good .v{color:var(--done)}

/* agents */
.agents{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
  gap:10px;padding:8px 20px 0}
.agent{background:var(--surface);border:1px solid var(--line);border-radius:8px;
  padding:11px 13px;box-shadow:var(--shadow);border-left:3px solid var(--line)}
.agent.st-working{border-left-color:var(--done)}
.agent.st-active{border-left-color:var(--accent)}
.agent.st-idle{border-left-color:var(--line);opacity:.82}
.agent.tree{border-left-color:var(--purple)}
.agent .top{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
.agent .who{font-size:13px;font-weight:600}
.agent .task{font-size:12.5px;color:var(--ink-2);line-height:1.45}
.agent .now{font-size:12px;color:var(--ink-3);margin-top:7px;padding-top:7px;
  border-top:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap;
  align-items:center}
.agent .lbl{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;color:var(--ink-3)}

.board{display:grid;grid-template-columns:repeat(5,minmax(240px,1fr));gap:10px;
  padding:8px 20px 18px;align-items:start}
@media (max-width:1250px){.board{grid-template-columns:repeat(2,minmax(240px,1fr))}}
@media (max-width:700px){.board{grid-template-columns:1fr}}
.col{background:var(--col);border-radius:8px;padding:8px;min-width:0}
.col-head{display:flex;align-items:center;gap:8px;padding:4px 6px 10px}
.col-title{font-size:11.5px;font-weight:700;text-transform:uppercase;
  letter-spacing:.08em;color:var(--ink-2)}
.count{background:var(--surface-2);color:var(--ink-2);font-size:11px;font-weight:700;
  border-radius:999px;padding:1px 7px}
.col.blockers .col-title{color:var(--danger)}
.col.prog .col-title{color:var(--purple)}
.col.next .col-title{color:var(--accent)}
.col.done .col-title{color:var(--done)}

.card{background:var(--surface);border-radius:6px;box-shadow:var(--shadow);
  padding:10px 11px;margin-bottom:8px;border-left:3px solid transparent}
.card.b-danger{border-left-color:var(--danger)}
.card.b-accent{border-left-color:var(--accent)}
.card.b-done{border-left-color:var(--done)}
.card.b-mute{border-left-color:var(--line)}
.card.b-purple{border-left-color:var(--purple)}
.card h3{margin:0 0 6px;font-size:13.5px;font-weight:600;line-height:1.35}
.card .goal{font-size:12px;color:var(--ink-3);margin:0 0 8px;line-height:1.45}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.tag{font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:3px;
  background:var(--surface-2);color:var(--ink-2)}
.tag.p0{background:var(--danger-soft);color:var(--danger)}
.tag.p1{background:var(--warn-soft);color:var(--warn)}
.tag.hi{background:var(--accent-soft);color:var(--accent)}
.foot{display:flex;align-items:center;gap:8px;margin-top:9px;padding-top:8px;
  border-top:1px solid var(--line)}
.key{font-family:ui-monospace,Menlo,monospace;font-size:11px;font-weight:700;
  color:var(--ink-3)}
.bar-track{height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden;
  flex:1;min-width:36px}
.bar-fill{height:100%;background:var(--accent);border-radius:3px}
.bar-fill.full{background:var(--done)}
.pct{font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.items{margin:8px 0 0;padding:0;list-style:none}
.items li{font-size:12px;color:var(--ink-2);padding:3px 0 3px 15px;position:relative;
  line-height:1.4}
.items li::before{content:"";position:absolute;left:2px;top:9px;width:5px;height:5px;
  border-radius:50%;background:var(--ink-3);opacity:.55}
.items li.chk{padding-left:20px}
.items li.chk::before{display:none}
.box{position:absolute;left:0;top:4px;width:13px;height:13px;border-radius:3px;
  border:1.5px solid var(--ink-3);font-size:9px;line-height:10px;text-align:center;
  color:transparent}
.box.on{background:var(--done);border-color:var(--done);color:var(--surface)}
.empty{font-size:12px;color:var(--ink-3);padding:14px 8px;text-align:center;
  border:1px dashed var(--line);border-radius:6px}

.panels{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:8px 20px 24px}
@media (max-width:1250px){.panels{grid-template-columns:1fr 1fr}}
@media (max-width:900px){.panels{grid-template-columns:1fr}}
.ev{display:flex;gap:9px;padding:7px 0;border-bottom:1px solid var(--line);font-size:12.5px;
  align-items:flex-start}
.ev:last-child{border-bottom:none}
.ev .t{color:var(--ink-3);flex:none;font-variant-numeric:tabular-nums;font-size:11.5px;
  padding-top:1px;width:52px}
.ev .x{min-width:0;color:var(--ink-2);word-break:break-word}
.ev .badge{flex:none;font-size:9.5px;font-weight:700;text-transform:uppercase;
  letter-spacing:.05em;padding:1px 6px;border-radius:3px;background:var(--surface-2);
  color:var(--ink-3);margin-top:1px}
.ev.k-commit .badge{background:var(--accent-soft);color:var(--accent)}
.ev.k-dod .badge,.ev.k-cleared .badge{background:var(--done-soft);color:var(--done)}
.ev.k-sprint .badge{background:var(--purple-soft);color:var(--purple)}
.ev.k-blocker .badge{background:var(--danger-soft);color:var(--danger)}
.ev.k-agent .badge{background:var(--warn-soft);color:var(--warn)}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:8px;
  box-shadow:var(--shadow);overflow:hidden}
.panel h2{margin:0;font-size:11.5px;font-weight:700;text-transform:uppercase;
  letter-spacing:.08em;color:var(--ink-2);padding:11px 14px;
  border-bottom:1px solid var(--line)}
.panel .body{padding:4px 14px 12px}
.row{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);
  font-size:12.5px}
.row:last-child{border-bottom:none}
.row .sha{font-family:ui-monospace,Menlo,monospace;color:var(--accent);flex:none}
.row .when{color:var(--ink-3);flex:none;font-variant-numeric:tabular-nums}
.row .what{color:var(--ink-2);min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;flex:1}
.kv{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);
  font-size:12.5px}
.kv:last-child{border-bottom:none}
.kv .k{color:var(--ink-3);flex:none;width:120px}
.kv .v{color:var(--ink-2);flex:1;min-width:0}
.spark{display:flex;align-items:flex-end;gap:3px;height:42px;padding:10px 14px 4px}
.spark i{flex:1;background:var(--accent);border-radius:2px 2px 0 0;min-height:2px;
  opacity:.85}
.spark i.zero{background:var(--line);opacity:1}
.sparkx{display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink-3);
  padding:0 14px 10px}
footer{padding:0 20px 26px;font-size:11.5px;color:var(--ink-3);line-height:1.6}
"""


def card(key, title, *, border="mute", goal="", tags=(), items=(),
         progress=None, checklist=None):
    p = ['<div class="card b-%s">' % border, "<h3>%s</h3>" % md_inline(title)]
    if goal:
        p.append('<p class="goal">%s</p>' % md_inline(goal))
    if tags:
        p.append('<div class="tags">%s</div>' % "".join(
            '<span class="tag %s">%s</span>' % (c, html.escape(t)) for t, c in tags))
    if items:
        p.append('<ul class="items">%s</ul>' % "".join(
            "<li>%s</li>" % md_inline(i) for i in items))
    if checklist:
        p.append('<ul class="items">%s</ul>' % "".join(
            '<li class="chk"><span class="box %s">&#10003;</span>%s</li>'
            % ("on" if d else "", md_inline(t)) for d, t in checklist))
    p.append('<div class="foot"><span class="key">%s</span>' % html.escape(key))
    if progress:
        done, total, pct = progress
        p.append('<div class="bar-track"><div class="bar-fill %s" style="width:%d%%">'
                 '</div></div><span class="pct">%d/%d</span>'
                 % ("full" if pct == 100 else "", pct, done, total))
    p.append("</div></div>")
    return "".join(p)


def build():
    sprints = [parse_sprint_file(s) for s in parse_sprint_index()]
    bugs = parse_bug_triage()
    tracker = parse_tracker()
    decisions = parse_open_decisions()
    g = parse_git()
    trees = parse_worktrees()
    agents = parse_agents()
    cols = classify(sprints)

    active = (cols["In Progress"] or cols["Up Next"] or [None])[0]
    stale = bool(tracker["verified_commit"]) and \
        tracker["verified_commit"][:7] != g["head"][:7]

    # ---------------- blockers ----------------
    blockers, blocker_index = [], {}

    def add_blocker(key, title, **kw):
        blocker_index[key] = title
        blockers.append(card(key, title, **kw))

    if active:
        for i, gate in enumerate(active.get("gates", []), 1):
            add_blocker("GATE-%d" % i, gate["title"], border="danger",
                        goal=gate["detail"],
                        tags=[("Blocks Sprint %d" % active["num"], "p0"),
                              ("Sprint %d" % active["num"], "")])
    for i, b in enumerate(bugs, 1):
        first = re.split(r"(?<=\.)\s", b["detail"])[0] if b["detail"] else ""
        add_blocker("BUG-%d" % i, b["title"], border="danger", goal=clip(first, 230),
                    tags=[("Gates new features", "p0"), ("Bug Triage", "")])
    for i, d in enumerate(decisions, 1):
        add_blocker("DEC-%d" % i, d["text"], border="purple",
                    tags=[("Needs your call", "p1"), (d["source"], "")])
    for row in tracker["rows"]:
        if re.search(r"qa|review", row["area"], re.I) and \
           not re.match(r"complete", row["state"], re.I):
            add_blocker("DEBT-1", "%s — %s" % (row["area"], row["state"]),
                        border="danger", goal=clip(row["detail"], 250),
                        tags=[("Carried debt", "p1")])

    snap = make_snapshot(sprints, tracker, g, blocker_index, agents)
    feed, new_events = diff_and_log(snap)

    # ---------------- sprint cards ----------------
    def sprint_card(s, border, detail):
        tags = [("Sprint %d" % s["num"], "hi" if detail == "full" else "")]
        if s.get("size"):
            tags.append((s["size"], ""))
        if s.get("hard_blocked") and border != "done":
            tags.append(("Hard dependency", "p0"))
        for r in s.get("roles", [])[:5]:
            tags.append((clip(r, 26), ""))
        items, checklist = (), None
        if detail == "full":
            checklist = [(d["done"], d["text"]) for d in s["dod"]]
        elif detail == "backlog":
            items = ["%s%s — %s" % (b["pri"], " first" if b["first"] else "",
                                    clip(b["item"], 70)) for b in s["backlog"][:4]]
        return card("SPR-%d" % s["num"], s["name"], border=border,
                    goal=s.get("goal", "") if detail != "none" else "",
                    tags=tags, items=items, checklist=checklist,
                    progress=dod_progress(s))

    def col(title, cards, cls=""):
        inner = "".join(cards) if cards else '<div class="empty">Nothing here</div>'
        return ('<div class="col %s"><div class="col-head"><span class="col-title">%s'
                '</span><span class="count">%d</span></div>%s</div>'
                % (cls, html.escape(title), len(cards), inner))

    board = "".join([
        col("Blockers", blockers, "blockers"),
        col("Backlog", [sprint_card(s, "mute", "backlog") for s in cols["Backlog"]]),
        col("Up Next", [sprint_card(s, "accent", "backlog") for s in cols["Up Next"]],
            "next"),
        col("In Progress", [sprint_card(s, "purple", "full")
                            for s in cols["In Progress"]], "prog"),
        col("Done", [sprint_card(s, "done", "none") for s in reversed(cols["Done"])],
            "done"),
    ])

    # ---------------- agents ----------------
    def agent_card(a):
        cls = "st-%s" % a["state"]
        pill = {"working": "ok live", "active": "info", "idle": "mute"}[a["state"]]
        bits = []
        if a["tool"]:
            bits.append('<span class="lbl">last tool</span><code>%s</code>'
                        % html.escape(a["tool"]))
        bits.append('<span class="lbl">branch</span><code>%s</code>'
                    % html.escape(a["branch"]))
        if a["sidechains"]:
            bits.append('<span class="lbl">subagents</span>%d' % a["sidechains"])
        sub = ""
        if a["subagent"]:
            sub = ('<div class="now"><span class="lbl">subagent</span>%s</div>'
                   % md_inline(clip(a["subagent"], 150)))
        return (
            '<div class="agent %s"><div class="top">'
            '<span class="pill %s"><span class="dot"></span>%s</span>'
            '<span class="who">session %s</span>'
            '<span class="spacer"></span><span class="pill mute">%s</span></div>'
            '<div class="task">%s</div>'
            '<div class="now">%s</div>%s</div>'
            % (cls, pill, html.escape(a["label"]), html.escape(a["id"]),
               html.escape(ago(a["age"])), md_inline(clip(a["current"], 200)),
               " &nbsp;·&nbsp; ".join(bits), sub))

    def tree_card(t):
        return (
            '<div class="agent tree"><div class="top">'
            '<span class="pill %s">%s</span><span class="who">%s</span>'
            '<span class="spacer"></span><span class="pill mute">%s</span></div>'
            '<div class="task">%s</div>'
            '<div class="now"><span class="lbl">branch</span><code>%s</code>'
            ' &nbsp;·&nbsp; <span class="lbl">head</span><code>%s</code>'
            ' &nbsp;·&nbsp; <span class="lbl">uncommitted</span>%d</div></div>'
            % ("bad" if t["dirty"] else "mute",
               "worktree" if not t["main"] else "primary checkout",
               html.escape(t["role"]), html.escape(t["when"]),
               md_inline(clip(t["subject"], 160)), html.escape(t["branch"]),
               html.escape(t["sha"]), t["dirty"]))

    agent_cards = [agent_card(a) for a in agents] + \
                  [tree_card(t) for t in trees if not t["main"]]
    if not agent_cards:
        agent_cards = ['<div class="empty">No agent sessions or worktrees '
                       'active in the last %dh</div>' % SESSION_WINDOW_H]
    agents_html = "".join(agent_cards)

    working = sum(1 for a in agents if a["state"] == "working")
    extra_trees = sum(1 for t in trees if not t["main"])

    last_change = "—"
    if feed:
        try:
            delta = datetime.now() - datetime.fromisoformat(feed[0]["ts"])
            last_change = ago(delta.total_seconds())
        except Exception:
            last_change = feed[0].get("ts", "")[11:16]

    # ---------------- stats ----------------
    if active:
        p = dod_progress(active) or (0, 0, 0)
        a_label, a_sub = "Sprint %d" % active["num"], "%d of %d DoD done" % (p[0], p[1])
    else:
        a_label, a_sub = "—", "no active sprint"

    stats = [
        ("Active sprint", a_label, a_sub, ""),
        ("Sprints complete", "%d / %d" % (len(cols["Done"]), len(sprints)),
         "%d in progress · %d queued" % (len(cols["In Progress"]),
                                         len(cols["Backlog"]) + len(cols["Up Next"])), ""),
        ("Blockers", str(len(blockers)),
         "gating work" if blockers else "queue clear",
         "alert" if blockers else "good"),
        ("Agents working", str(working),
         "%d session(s) · %d worktree(s)" % (len(agents), extra_trees),
         "good" if working else ""),
        ("Last change", last_change,
         ("%d new this refresh" % new_events) if new_events else "no change this refresh",
         "good" if new_events else ""),
        ("Test suite", tracker["tests"] or "—",
         "green as of %s" % (tracker["verified_date"] or "?"), ""),
        ("Tracker freshness", "stale" if stale else "current",
         "verified @ %s vs HEAD %s" % (tracker["verified_commit"] or "?", g["head"]),
         "alert" if stale else ""),
    ]
    stats_html = "".join(
        '<div class="stat %s"><div class="k">%s</div><div class="v">%s</div>'
        '<div class="s">%s</div></div>'
        % (c, html.escape(k), html.escape(v), html.escape(s)) for k, v, s, c in stats)

    # ---------------- panels ----------------
    commits = "".join(
        '<div class="row"><span class="sha">%s</span><span class="when">%s</span>'
        '<span class="what">%s</span></div>'
        % (html.escape(c["sha"]), html.escape(c["date"]), html.escape(c["subject"]))
        for c in g["commits"])
    peak = max([n for _, n in g["spark"]] + [1])
    spark = "".join(
        '<i class="%s" style="height:%d%%" title="%s: %d commits"></i>'
        % ("zero" if n == 0 else "", max(4, round(100 * n / peak)), d.isoformat(), n)
        for d, n in g["spark"])
    status_rows = "".join(
        '<div class="kv"><span class="k">%s</span><span class="v">%s</span></div>'
        % (md_inline(r["area"]), md_inline(r["state"])) for r in tracker["rows"])
    notes = "".join(
        '<div class="kv"><span class="k">%s</span><span class="v">%s</span></div>'
        % (md_inline(n["head"]), md_inline(n["body"])) for n in tracker["notes"])
    upcoming = "".join(
        '<div class="kv"><span class="k">Sprint %d</span><span class="v">%s</span></div>'
        % (s["num"], md_inline(s["name"])) for s in cols["Up Next"] + cols["Backlog"])
    locked = "".join('<div class="row"><span class="what">%s</span></div>' % md_inline(d)
                     for d in tracker["decisions"])

    feed_html = "".join(
        '<div class="ev k-%s"><span class="t">%s</span>'
        '<span class="badge">%s</span><span class="x">%s</span></div>'
        % (html.escape(e.get("kind", "")), html.escape(e.get("ts", "")[11:16]),
           html.escape(e.get("kind", "")), md_inline(clip(e.get("text", ""), 200)))
        for e in feed)
    if not feed_html:
        feed_html = ('<div class="empty">Watching. Nothing has changed since '
                     'monitoring started.</div>')
    generated = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Collega — Sprint Board</title>
<style>{CSS}</style>
</head>
<body>
<header>
  <div class="bar">
    <div>
      <div class="crumb">Collega &nbsp;/&nbsp; Delivery &nbsp;/&nbsp; Pre-MVP sprints</div>
      <h1>Sprint Board</h1>
    </div>
    <div class="spacer"></div>
    <span class="pill mute">HEAD <code>{html.escape(g['head'])}</code></span>
    <span class="pill {'bad' if g['dirty'] else 'ok'}">{
      ('%d uncommitted' % len(g['dirty'])) if g['dirty'] else 'tree clean'}</span>
    <span class="pill info">branch {html.escape(g['branch'])}</span>
    <span class="pill ok live"><span class="dot"></span>live · <span id="cd">60</span>s</span>
  </div>
</header>

<div class="stats">{stats_html}</div>

<h2 class="sec">Agents — who is working on what, right now</h2>
<div class="agents">{agents_html}</div>

<h2 class="sec">Board</h2>
<div class="board">{board}</div>

<div class="panels">
  <div class="panel">
    <h2>Change feed — what moved while monitoring</h2>
    <div class="body">{feed_html}</div>
  </div>
  <div class="panel">
    <h2>Recent activity</h2>
    <div class="spark">{spark}</div>
    <div class="sparkx"><span>21 days ago</span><span>commits / day</span><span>today</span></div>
    <div class="body">{commits}</div>
  </div>
  <div class="panel">
    <h2>Ground truth — tracker current status</h2>
    <div class="body">{status_rows}
      <div class="kv"><span class="k">Verified</span><span class="v">{
        html.escape(tracker['verified_date'])} against <code>{
        html.escape(tracker['verified_commit'])}</code>{
        ' &nbsp;<span class="pill warn">stale vs HEAD</span>' if stale else ''}</span></div>
    </div>
    <h2 style="border-top:1px solid var(--line)">Sprint notes</h2>
    <div class="body">{notes}</div>
    <h2 style="border-top:1px solid var(--line)">Coming up, in order</h2>
    <div class="body">{upcoming}</div>
    <h2 style="border-top:1px solid var(--line)">Locked decisions</h2>
    <div class="body">{locked}</div>
  </div>
</div>

<footer>
  Generated {html.escape(generated)} from <code>SPEC/95-next-sprints.md</code>,
  <code>SPEC/sprints/*.md</code>, <code>SPEC/Bug Triage.md</code>,
  <code>SPEC/implementation-agent-tracker.md</code>, <code>git worktree</code> and
  local Claude Code session transcripts.<br>
  Page reloads every 60s; the file behind it is regenerated every 60s by
  <code>.sprint-dashboard/run.sh</code>.
</footer>

<script>
(function(){{
  var k='collega-board-scroll';
  var y=sessionStorage.getItem(k); if(y) window.scrollTo(0, parseInt(y,10)||0);
  addEventListener('beforeunload', function(){{
    sessionStorage.setItem(k, String(window.scrollY));
  }});
  var n=60, el=document.getElementById('cd');
  setInterval(function(){{
    n--; if(el) el.textContent = n<0 ? 0 : n;
    if(n<=0) location.reload();
  }}, 1000);
}})();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    try:
        OUT.write_text(build(), encoding="utf-8")
        print("wrote %s at %s" % (OUT, datetime.now().strftime("%H:%M:%S")))
    except Exception as exc:
        print("generate failed: %r" % exc, file=sys.stderr)
        sys.exit(1)

<nav class="switch" aria-label="Comp screens">
  <b>Comp O-3</b><span class="lbl">Delivery · DESIGN.md applied</span>
  <button data-go="s-sprint" aria-current="true">Sprint</button>
  <button data-go="s-backlog">Backlog table</button>
  <button data-go="s-roadmap">Roadmap</button>
</nav>
<div class="explore"><b>Direction probe</b><span>Built on <b>DESIGN.md</b> (Notion analysis). The densest surfaces in Collega, against a system drawn for an airy marketing page — this is where the direction is most likely to break. Changes nothing in <code>SPEC/</code>.</span></div>

<section class="screen" id="s-sprint" data-on="1"><div class="shell">
@@SIDE:sprint@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <b>Sprint 12</b></span><span class="spacer"></span>
      <div class="seg"><button aria-pressed="true">Board</button><button aria-pressed="false">Table</button></div>
      <button class="btn">Sprint settings</button><button class="btn pri">Add issue</button></div>
    <div class="body" style="max-width:none">
      <div class="pagehead"><div class="grow">
        <div class="chipbar" style="margin-bottom:var(--s-sm)"><span class="marker"><span class="dot" style="background:var(--green)"></span>Active</span><span class="badge">12 of 20</span></div>
        <h1>Sprint 12</h1><p>18 Aug – 29 Aug 2026 · 9 issues, 34 tasks. Tasks live on an issue only once it reaches the Delivery phase.</p></div></div>
      <div class="stat"><span>Issues <b>9</b></span><span>Done <b>4</b></span><span>In progress <b>3</b></span><span>Not started <b>2</b></span><span>Tasks complete <b>21 / 34</b></span></div>
      <div class="lanes" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="lane">
          <div class="lanehd"><span class="dot"></span><span class="t">Not started</span><span class="ct">2</span></div>
          <div class="kcard"><span class="t">Retire the legacy export path</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="tag">ISS-214</span><span class="av s">—</span></div></div>
          <div class="kcard"><span class="t">Org-scoped user search</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="tag">ISS-219</span><span class="av s">AL</span></div></div>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--orange)"></span><span class="t">In progress</span><span class="ct">3</span></div>
          <div class="kcard"><span class="t">Automate weekly reporting</span>
            <p class="d">3 of 5 tasks complete</p>
            <ul class="tasks" style="margin-bottom:10px">
              <li><span class="box on"></span><span class="done grow">Schema for saved reports</span></li>
              <li><span class="box on"></span><span class="done grow">Nightly aggregation job</span></li>
              <li><span class="box"></span><span class="grow">Email template</span></li>
            </ul>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span><span class="tag">ISS-201</span><span class="av s">MP</span></div></div>
          <div class="kcard"><span class="t">SSO via SAML</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span><span class="tag">ISS-207</span><span class="av s">AL</span></div></div>
          <div class="kcard"><span class="t">Notification digest email</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="tag">ISS-211</span><span class="av s">JR</span></div></div>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--purple)"></span><span class="t">In review</span><span class="ct">0</span></div>
          <div class="emptylane">Nothing waiting on a reviewer</div>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--green)"></span><span class="t">Done</span><span class="ct">4</span></div>
          <div class="kcard" style="background:var(--canvas-soft)"><span class="t">Mobile responsive board</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span><span class="tag">ISS-198</span><span class="av s">TD</span></div></div>
          <div class="kcard" style="background:var(--canvas-soft)"><span class="t">Mention autocomplete</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="tag">ISS-203</span><span class="av s">MP</span></div></div>
          <div class="kcard" style="background:var(--canvas-soft)"><span class="t">Audit log for admin actions</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="tag">ISS-190</span><span class="av s">JR</span></div></div>
          <div class="kcard" style="background:var(--canvas-soft)"><span class="t">Bulk import from CSV</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="tag">ISS-205</span><span class="av s">TD</span></div></div>
        </div>
      </div>
      <div class="note"><b>Where it strains.</b> 16px card padding and 12px radii are generous for a four-lane sprint board — this screen fits noticeably fewer cards above the fold than comp&nbsp;L does. The checkbox list survives well; the card chrome is what costs the space.</div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-backlog" data-on="0"><div class="shell">
@@SIDE:backlog@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <b>Backlog</b></span><span class="spacer"></span>
      <button class="btn">Export</button><button class="btn pri">Plan sprint</button></div>
    <div class="body">
      <div class="pagehead"><div class="grow"><h1>Backlog</h1><p>16 delivery issues not yet assigned to an active sprint.</p></div></div>
      <div class="cmdbar">
        <input type="text" placeholder="Filter issues…" style="width:240px">
        <select><option>Outcome: All</option></select>
        <select><option>Assignee: All</option></select>
        <span class="spacer"></span><span class="cap faint">16 rows</span>
      </div>
      <div class="card flush">
        <table>
          <thead><tr><th style="width:104px">Issue</th><th>Title</th><th style="width:132px">Priority</th><th style="width:206px">Outcome</th><th style="width:120px">Tasks</th><th style="width:120px">Assignee</th></tr></thead>
          <tbody>
            <tr><td><a href="#">ISS-214</a></td><td>Retire the legacy export path</td><td><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span></td><td>Retire legacy steps</td><td class="muted">0 / 3</td><td><span class="av s">—</span></td></tr>
            <tr><td><a href="#">ISS-219</a></td><td>Org-scoped user search</td><td><span class="marker"><span class="dot"></span>Low</span></td><td class="faint">Not grouped</td><td class="muted">0 / 2</td><td><span class="av s">AL</span></td></tr>
            <tr><td><a href="#">ISS-221</a></td><td>Saved filter views</td><td><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span></td><td>Make review predictable</td><td class="muted">1 / 4</td><td><span class="av s">MP</span></td></tr>
            <tr><td><a href="#">ISS-223</a></td><td>Keyboard shortcuts cheat sheet</td><td><span class="marker"><span class="dot"></span>Low</span></td><td class="faint">Not grouped</td><td class="muted">0 / 1</td><td><span class="av s">—</span></td></tr>
            <tr><td><a href="#">ISS-226</a></td><td>Export board to PDF</td><td><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span></td><td>Cut reporting effort</td><td class="muted">2 / 6</td><td><span class="av s">JR</span></td></tr>
            <tr><td><a href="#">ISS-229</a></td><td>Standardize the intake form</td><td><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span></td><td>Standardize intake</td><td class="muted">0 / 5</td><td><span class="av s">TD</span></td></tr>
            <tr><td><a href="#">ISS-231</a></td><td>Status change audit trail</td><td><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span></td><td>Make review predictable</td><td class="muted">3 / 3</td><td><span class="av s">JR</span></td></tr>
            <tr><td><a href="#">ISS-234</a></td><td>Bulk status move</td><td><span class="marker"><span class="dot"></span>Low</span></td><td class="faint">Not grouped</td><td class="muted">0 / 2</td><td><span class="av s">AL</span></td></tr>
          </tbody>
        </table>
      </div>
      <div class="note"><b>The table is the strongest surface here.</b> <code>ex-data-table-cell</code> maps onto Collega without translation — canvas-soft header, 12px uppercase eyebrow, 15px body, hairline row rules. Priority sits in the same dot-plus-label marker used everywhere else, so the column stays scannable without a colour ramp.</div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-roadmap" data-on="0"><div class="shell">
@@SIDE:roadmap@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <b>Roadmap</b></span><span class="spacer"></span>
      <div class="seg"><button aria-pressed="true">Quarters</button><button aria-pressed="false">Sprints</button></div>
      <button class="btn pri">Add outcome</button></div>
    <div class="body">
      <div class="pagehead"><div class="grow"><h1>Roadmap</h1><p>Outcomes over time. Sprints stay flat underneath — an outcome groups issues, it does not own them.</p></div></div>
      <div class="stat"><span>Delivery issues <b>16</b></span><span>Grouped <b>14</b></span><span>Not grouped <b>2</b></span><span>Memberships <b>14</b></span></div>
      <div class="road">
        <div class="hd">Outcome</div><div class="hd">Q3 2026</div><div class="hd">Q4 2026</div><div class="hd">Q1 2027</div><div class="hd">Q2 2027</div>
        <div class="out">Cut reporting effort<small>4 issues · 3 done</small></div>
        <div><span class="bar"><span class="dot" style="background:var(--sky)"></span> Sprints 11–12</span></div><div></div><div></div><div></div>
        <div class="out">Make review predictable<small>5 issues · 1 done</small></div>
        <div></div><div><span class="bar"><span class="dot" style="background:var(--teal)"></span> Sprint 12</span></div><div><span class="bar"><span class="dot" style="background:var(--teal)"></span> Sprints 13–15</span></div><div></div>
        <div class="out">Standardize intake<small>3 issues · 0 done</small></div>
        <div></div><div></div><div><span class="bar"><span class="dot" style="background:var(--purple)"></span> Sprints 14–16</span></div><div><span class="bar"><span class="dot" style="background:var(--purple)"></span> Sprints 17–18</span></div>
        <div class="out">Retire legacy steps<small>2 issues · 0 done</small></div>
        <div></div><div></div><div></div><div><span class="bar"><span class="dot" style="background:var(--orange)"></span> Sprints 19–20</span></div>
        <div class="out" style="color:var(--ink-faint)">Not grouped<small>2 issues · no bar</small></div>
        <div></div><div></div><div></div><div></div>
      </div>
      <div class="note"><b>Bars lose their colour coding.</b> In comps M and N each outcome owns a tinted bar. DESIGN.md forbids a structural fill from the sticker palette, so bars become neutral chips carrying a category dot instead. It stays legible, but the roadmap is the one screen where the &ldquo;decoration only&rdquo; rule costs real scanning speed — outcomes no longer separate at a glance across a wide grid.</div>
    </div>
  </div>
</div></section>

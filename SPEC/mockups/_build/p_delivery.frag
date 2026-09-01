<section class="screen" id="s-roadmap" data-on="0"><div class="shell">
@@DESK:roadmap@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <b>Roadmap</b></span><span class="spacer"></span>
      <div class="seg"><button aria-pressed="true">Quarters</button><button aria-pressed="false">Sprints</button></div>
      <button class="btn pri">Add outcome</button></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Roadmap</h1>
        <div class="sub">Outcomes over time. An issue may serve every outcome it advances, so rows overlap.</div></div></div>
      <div class="kpis">
        <div class="kpi"><div class="k">Delivery issues</div><div class="v num">16</div><div class="d">the real set</div></div>
        <div class="kpi"><div class="k">Grouped</div><div class="v num">14</div><div class="d">distinct issues</div></div>
        <div class="kpi"><div class="k">Memberships</div><div class="v num">18</div><div class="d">4 issues serve two</div></div>
        <div class="kpi"><div class="k">Not grouped</div><div class="v num">2</div><div class="d">no outcome, no bar</div></div>
      </div>
      <div class="roadwrap">
        <div class="roadgrid">
          <div class="hd">Outcome</div><div class="hd">Q3 2026</div><div class="hd">Q4 2026</div><div class="hd">Q1 2027</div><div class="hd">Q2 2027</div>
          <div class="out">Cut reporting effort<small>5 issues · 3 done</small><span class="marks"><span class="shared-tag">2 shared</span></span></div>
          <div><span class="barx"><span class="dot" style="background:var(--sky)"></span>Sprints 11–12</span></div>
          <div><span class="barx shared"><span class="dot" style="background:var(--sky)"></span>Sprint 12 · shared</span></div><div></div><div></div>
          <div class="out">Make review predictable<small>5 issues · 1 done</small><span class="marks"><span class="shared-tag">2 shared</span></span></div>
          <div></div><div><span class="barx"><span class="dot" style="background:var(--teal)"></span>Sprint 12</span></div>
          <div><span class="barx"><span class="dot" style="background:var(--teal)"></span>Sprints 13–15</span></div><div></div>
          <div class="out">Standardize intake<small>5 issues · 1 done</small><span class="marks"><span class="shared-tag">2 shared</span></span></div>
          <div></div><div><span class="barx shared"><span class="dot" style="background:var(--green)"></span>Sprint 12 · shared</span></div>
          <div><span class="barx"><span class="dot" style="background:var(--green)"></span>Sprints 14–16</span></div>
          <div><span class="barx"><span class="dot" style="background:var(--green)"></span>Sprints 17–18</span></div>
          <div class="out">Retire legacy steps<small>3 issues · 0 done</small><span class="marks"><span class="shared-tag">2 shared</span></span></div>
          <div></div><div></div><div><span class="barx shared"><span class="dot" style="background:var(--orange)"></span>Sprint 13 · shared</span></div>
          <div><span class="barx"><span class="dot" style="background:var(--orange)"></span>Sprints 19–20</span></div>
          <div class="out dim">Not grouped<small>2 issues · 0 done</small></div>
          <div class="dim"></div><div class="dim"></div><div class="dim"></div><div class="dim faint">no outcome, no bar</div>
        </div>
        <div class="sum"><span>4 outcomes</span><span>rows sum to <b>18</b></span><span>distinct <b>14</b></span><span>+ 2 not grouped = <b>16</b></span><span class="warnflag">sum &ne; the delivery set</span></div>
      </div>
      <div class="note"><b>Shared is a border, not a hue.</b> Comp&nbsp;N tinted each outcome&rsquo;s bar; DESIGN.md forbids a structural fill from the sticker palette, and comp&nbsp;O-3 showed neutral bars alone lose the outcome at a glance. So the outcome keeps a category dot and <b>&ldquo;shared&rdquo; is carried by a dashed outline</b> — not a colour, so it survives greyscale, colour blindness and a printed page, none of which a tint does. Every total still needs its distinct-count beside it: <b>18 memberships over 14 issues</b> is a cover, not a partition.</div>
    </div>
  </div>
</div></section>


<section class="screen" id="s-issue" data-on="0"><div class="shell">
@@DESK:roadmap@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / Sprint 12 / <b>CLG-114</b></span><span class="spacer"></span>
      <button class="btn" data-go="s-roadmap">Back to roadmap</button><button class="btn pri">Save</button></div>
    <div class="work">
      <div class="pgh"><div class="grow">
        <div class="chipbar" style="margin-bottom:var(--s-sm)"><span class="key">CLG-114</span>
          <span class="marker"><span class="dot" style="background:var(--orange)"></span>Delivery</span>
          <span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium effort</span></div>
        <h1>Automate weekly reporting</h1>
        <div class="sub">Development · Sprint 12 · assigned to Marcus Green</div></div></div>
      <div class="cols">
        <div class="panel">
          <h3><span class="grow">Tasks</span><span class="cap faint" style="font-weight:400">3 of 5 done</span></h3>
          <div class="in">
            <div class="task done"><input type="checkbox" checked aria-labelledby="p-task1"><div class="grow"><span id="p-task1">Agree the report&rsquo;s column set with Ops</span><div class="who">Marcus Green · done 24 Aug</div></div></div>
            <div class="task done"><input type="checkbox" checked aria-labelledby="p-task2"><div class="grow"><span id="p-task2">Build the extract query</span><div class="who">Marcus Green · done 26 Aug</div></div></div>
            <div class="task done"><input type="checkbox" checked aria-labelledby="p-task3"><div class="grow"><span id="p-task3">Schedule the Friday 06:00 run</span><div class="who">Olivia Administer · done 28 Aug</div></div></div>
            <div class="task"><input type="checkbox" aria-labelledby="p-task4"><div class="grow"><span id="p-task4">Handle the empty-week edge case</span><div class="who">Marcus Green · in progress</div></div></div>
            <div class="task"><input type="checkbox" aria-labelledby="p-task5"><div class="grow"><span id="p-task5">Write the one-page runbook</span><div class="who">Unassigned</div></div></div>
            <button class="addtask">+ Add task</button>
          </div>
        </div>
        <div class="panel">
          <h3>Delivery</h3>
          <div class="in">
            <dl class="kv">
              <dt>Status</dt><dd>Development</dd>
              <dt>Sprint</dt><dd>Sprint 12 <span class="badge">Active</span></dd>
              <dt>Effort</dt><dd>Medium</dd>
              <dt>Assignee</dt><dd>Marcus Green</dd>
              <dt>Outcomes</dt><dd><div class="tagrow">
                <span class="rmtag"><span class="dot" style="background:var(--sky)"></span>Cut reporting effort <x>&times;</x></span>
                <span class="rmtag"><span class="dot" style="background:var(--green)"></span>Standardize intake <x>&times;</x></span>
                <button class="btn sm2" data-go="s-group">+ add</button></div></dd>
            </dl>
          </div>
        </div>
      </div>
      <div class="note"><b>A list, not a value.</b> Outcome cannot sit in the same visual grammar as Sprint, because Sprint is one and Outcome is many. It needs chips, an add affordance, and a rule for the empty case: removing the last chip returns this issue to <em>Not grouped</em> — it is never silently orphaned. This is the affordance that only exists if multi-parent wins.</div>
    </div>
  </div>
</div></section>


<section class="screen" id="s-group" data-on="0"><div class="shell">
@@DESK:roadmap@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / Sprint 12 / <b>CLG-114</b></span><span class="spacer"></span>
      <button class="btn" data-go="s-issue">Back to issue</button></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Automate weekly reporting</h1>
        <div class="sub">Choose every outcome this issue advances.</div></div></div>
      <div class="panel" style="max-width:560px"><h3>Grouping</h3><div class="in">
        <p class="sm muted" style="margin-bottom:var(--s-md)">Adding an outcome does not remove the others — this is an <b class="sec">add/remove</b>, never a move. Nothing is displaced.</p>
        <ul class="tasks">
          <li><span class="box on"></span><span class="dot" style="background:var(--sky)"></span><span class="grow">Cut reporting effort</span><span class="cap faint">5 issues</span></li>
          <li><span class="box on"></span><span class="dot" style="background:var(--green)"></span><span class="grow">Standardize intake</span><span class="cap faint">5 issues</span></li>
          <li><span class="box"></span><span class="dot" style="background:var(--teal)"></span><span class="grow">Make review predictable</span><span class="cap faint">5 issues</span></li>
          <li><span class="box"></span><span class="dot" style="background:var(--orange)"></span><span class="grow">Retire legacy steps</span><span class="cap faint">3 issues</span></li>
        </ul>
        <div style="display:flex;gap:var(--s-sm);margin-top:var(--s-md);padding-top:var(--s-md);border-top:1px solid var(--hairline)">
          <button class="btn pri" data-go="s-issue">Save grouping</button><button class="btn sec2" data-go="s-issue">Cancel</button></div>
      </div></div>
      <div class="note" style="max-width:560px"><b>Two selected, and that is legal.</b> Under single-parent this control would be a radio group and picking a second option would silently drop the first. The checkbox is the whole difference, and it is why the reverse migration is lossy: going multi&nbsp;&rarr;&nbsp;single later forces a human to choose which grouping survives.</div>
    </div>
  </div>
</div></section>


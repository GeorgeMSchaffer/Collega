<nav class="switch" aria-label="Comp screens">
  <b>Comp P</b><span class="lbl">Focus Desk + multi-parent roadmap · DESIGN.md</span>
  <button data-go="s-login">Login</button>
  <button data-go="s-home" aria-current="true">Home</button>
  <button data-go="s-ideas">Ideas list</button>
  <button data-go="s-board">Board</button>
  <button data-go="s-inspect">Inspector</button>
  <button data-go="s-roadmap">Roadmap</button>
  <button data-go="s-issue">Issue</button>
  <button data-go="s-group">Grouping</button>
  <button data-go="s-settings">Settings</button>
  <button data-go="s-palette">Command palette</button>
</nav>
<div class="explore"><b>How to read this</b><span>Comp&nbsp;<b>D</b>&rsquo;s Focus Desk carrying comp&nbsp;<b>N</b>&rsquo;s multi-parent roadmap, styled per <b>DESIGN.md</b>. Ten screens on one token layer; nothing in <code>SPEC/</code> changes.
  <span class="how">
    <span>&bull; The tab bar above switches screens.</span>
    <span>&bull; <span class="k">Ctrl K</span> opens the palette from any screen, <span class="k">Esc</span> closes it.</span>
    <span>&bull; The sidebar nav is live for the screens that exist.</span>
    <span>&bull; <b>Roadmap</b> carries the open cardinality question &mdash; a layout choice, not a decision.</span>
    <span>&bull; <b>Ideas list</b> carries the measured density cost of the 15px body.</span>
  </span></span></div>

<section class="screen" id="s-home" data-on="1"><div class="shell">
@@DESK:home@@
  <div class="main">
    <div class="topbar"><span class="crumb"><b>Home</b></span><span class="spacer"></span>
      <button class="btn">View as…</button><button class="btn pri">New idea</button></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Good afternoon, Olivia</h1>
        <div class="sub">Here&rsquo;s what needs you today. Acme Robotics has 22 ideas across 2 boards and 16 delivery issues in flight &mdash; press <span class="kbd">Ctrl K</span> to jump straight to any of them.</div></div></div>
      <div class="tip">
        <div><b>New to Collega?</b> An idea moves New / Pending &rarr; In Review &rarr; In Progress &rarr; Client Review &rarr; Complete, and the people, comments and history stay attached the whole way. Start one from any board, or press <span class="kbd">Ctrl K</span> and type &ldquo;new idea&rdquo;.</div>
        <button class="btn sm2">Got it</button>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="k">Open ideas</div><div class="v num">14</div><div class="d">of 22 total</div><div class="why">Anything not yet Complete or Archived, on any board you can see.</div></div>
        <div class="kpi"><div class="k">Awaiting review</div><div class="v num">4</div><div class="d">2 over 7 days</div><div class="why">Sitting in In Review, waiting on a decision from a person.</div></div>
        <div class="kpi"><div class="k">Assigned to me</div><div class="v num">6</div><div class="d">1 critical</div><div class="why">Open ideas with your name in the Assigned field.</div></div>
        <div class="kpi"><div class="k">Completed · 30d</div><div class="v num">6</div><div class="d">+2 vs prior</div><div class="why">Reached Complete in the last 30 days, against the 30 days before it.</div></div>
      </div>
      <div class="cols">
        <div class="panel">
          <h2><span class="grow">Needs your attention</span><button class="btn sm2">View all</button></h2>
          <div class="lede">Open ideas that are critical, high priority, or have gone a week without moving. Oldest first &mdash; a stalled idea is the failure mode, not a busy one.</div>
          <table>
            <thead><tr><th>Idea</th><th style="width:172px">Status</th><th style="width:120px">Priority</th><th style="width:64px">Age</th></tr></thead>
            <tbody>
              <tr><td><a class="t" href="#">Pilot a faster review path</a><div class="bd">Ideas · Process Revision</div></td>
                <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>In Review</span></td>
                <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span></td><td class="num">9d</td></tr>
              <tr><td><a class="t" href="#">Validate the customer feedback loop</a><div class="bd">Ideas · Process Revision</div></td>
                <td><span class="marker"><span class="dot" style="background:var(--pink)"></span>Client Review</span></td>
                <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span></td><td class="num">8d</td></tr>
              <tr><td><a class="t" href="#">Standardize the intake checklist</a><div class="bd">Ideas · Continuous Improvement</div></td>
                <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>New / Pending</span></td>
                <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td><td class="num">6d</td></tr>
              <tr><td><a class="t" href="#">Create a shared playbook</a><div class="bd">Ideas · Continuous Improvement</div></td>
                <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>In Progress</span></td>
                <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td><td class="num">5d</td></tr>
            </tbody>
          </table>
        </div>
        <div class="panel">
          <h2><span class="grow">Recent activity</span></h2>
          <div class="lede">Everything anyone changed in Acme Robotics, newest first. You only see activity on boards you have access to.</div>
          <ul class="feed">
            <li><span class="av s">NC</span><span>Noah moved <b>Automate weekly reporting</b> to In Progress</span><span class="when">14m</span></li>
            <li><span class="av s">MC</span><span>Maya commented on <b>Improve exception visibility</b></span><span class="when">1h</span></li>
            <li><span class="av s">OA</span><span>You added <b>Automate weekly reporting</b> to <b>Standardize intake</b></span><span class="when">2h</span></li>
            <li><span class="av s">OA</span><span>You upvoted <b>Reduce manual handoffs</b></span><span class="when">3h</span></li>
            <li><span class="av s">NC</span><span>Noah created <b>Roll out the proven workflow</b></span><span class="when">yest</span></li>
          </ul>
        </div>
      </div>
      <div class="note"><b>Two voices, kept apart.</b> Everything inside the app frame is product copy, written to be lifted straight into the real UI: what each KPI counts, how the attention queue is ordered, and what a first-run user needs to know before touching anything. Everything addressed to a reviewer of this comp &mdash; the screen list, the keyboard shortcuts, which screens carry open questions &mdash; sits in the band above the frame, outside the mock, so nobody has to guess which sentences would ship. Comp&nbsp;D&rsquo;s premise survives intact underneath: Home answers &ldquo;what needs me now&rdquo;, not &ldquo;what exists&rdquo;, and every number here is a filtered query you can open.</div>
    </div>
  </div>
</div></section>

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
            <div class="task done"><input type="checkbox" checked><div class="grow"><span>Agree the report&rsquo;s column set with Ops</span><div class="who">Marcus Green · done 24 Aug</div></div></div>
            <div class="task done"><input type="checkbox" checked><div class="grow"><span>Build the extract query</span><div class="who">Marcus Green · done 26 Aug</div></div></div>
            <div class="task done"><input type="checkbox" checked><div class="grow"><span>Schedule the Friday 06:00 run</span><div class="who">Olivia Administer · done 28 Aug</div></div></div>
            <div class="task"><input type="checkbox"><div class="grow"><span>Handle the empty-week edge case</span><div class="who">Marcus Green · in progress</div></div></div>
            <div class="task"><input type="checkbox"><div class="grow"><span>Write the one-page runbook</span><div class="who">Unassigned</div></div></div>
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

<section class="screen" id="s-palette" data-on="0">
  <div class="shell" style="filter:blur(1.5px);opacity:.6" aria-hidden="true">
@@DESK:home@@
    <div class="main"><div class="topbar"><span class="crumb">Home / <b>Roadmap</b></span></div>
      <div class="work"><div class="pgh"><h1>Roadmap</h1></div><div class="panel" style="height:300px"></div></div></div>
  </div>
  <div class="cp-back">
    <div class="cp" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="q"><span class="faint">⌕</span><input type="text" value="intake" aria-label="Search or run a command"></div>
      <div class="grp">Ideas</div>
      <div class="it on">Standardize the intake checklist <span class="faint" style="font-weight:400">· Ideas · New / Pending</span><span class="kbd">↵</span></div>
      <div class="it">Standardize the intake form <span class="faint" style="font-weight:400">· CLG-229 · Delivery</span></div>
      <div class="grp">Outcomes</div>
      <div class="it"><span class="dot" style="background:var(--green)"></span>Standardize intake <span class="faint" style="font-weight:400">· 5 issues · 2 shared</span></div>
      <div class="grp">Actions</div>
      <div class="it">Create idea &ldquo;intake&rdquo;<span class="kbd">Ctrl N</span></div>
      <div class="it">Add CLG-114 to an outcome…</div>
      <div class="it">View as another user…</div>
      <div class="cpfoot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> navigate</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">Esc</span> dismiss</span></div>
    </div>
  </div>
</section>

<!-- ==================== LOGIN ==================== -->
<section class="screen" id="s-login" data-on="0">
  <div class="authwrap">
    <div class="authpitch">
      <div class="mark">CG</div>
      <h2>Every idea your organization has, in one place.</h2>
      <p>Collega tracks an idea from the first rough note through review, work, and delivery — with the people, comments, and history attached to it the whole way.</p>
      <ul>
        <li><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"/></svg><span>One account per person, scoped to your organization</span></li>
        <li><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"/></svg><span>Boards, statuses and idea types you define yourself</span></li>
        <li><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"/></svg><span>Keyboard-first: press <span class="kbd">Ctrl K</span> anywhere</span></li>
      </ul>
    </div>
    <div class="authform"><div class="in">
      <h1>Sign in</h1>
      <p class="sub">One email, one account. We&rsquo;ll take you straight to your organization.</p>
      <!-- NATIVE submit button: Enter submits. Carried from comp D, which fixed the live finding filed 2026-08-16. -->
      <form>
        <div class="field">
          <label for="p-email">Email</label>
          <input type="text" inputmode="email" id="p-email" name="email" autocomplete="username" placeholder="you@yourcompany.com">
        </div>
        <div class="field">
          <label for="p-pw">Password</label>
          <input type="password" id="p-pw" name="password" autocomplete="current-password">
        </div>
        <button type="submit" class="btn pri" style="width:100%;justify-content:center">Sign in</button>
      </form>
      <p class="foot2">Have an invite code? <a href="#">Create an account</a>.<br>
      Forgot your password? Ask your organization admin to reset it.</p>
      <div class="note"><b>Accessibility carried over unchanged.</b> Native <code>&lt;button type="submit"&gt;</code> so Enter submits; <code>autocomplete="username"</code> paired with the password field so password managers work; a real <code>&lt;label for&gt;</code> bound to a real <code>&lt;input&gt;</code>. The restyle touches paint, never markup — <b>#213183</b> for the pitch band and <b>#0075de</b> for the single blue action.</div>
    </div></div>
  </div>
</section>

<!-- ==================== IDEAS LIST ==================== -->
<section class="screen" id="s-ideas" data-on="0"><div class="shell">
@@DESK:ideas@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#">Home</a> / <b>Ideas</b></span><span class="spacer"></span>
      <div class="seg" role="group" aria-label="Scope"><button aria-pressed="true">All</button><button aria-pressed="false">Created by me</button><button aria-pressed="false">Assigned to me</button></div>
      <button class="btn pri">New idea</button></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Ideas</h1>
        <div class="sub">Every idea in Acme Robotics, across all boards.</div></div></div>
      <!-- every filter keeps a real, visible label -->
      <div class="filters">
        <div class="fw wide"><label for="p-q">Search</label><input type="text" id="p-q" placeholder="Title, tag, assignee…"></div>
        <div class="fw"><label for="p-board">Board</label><select id="p-board"><option>All boards</option><option>Ideas</option><option>Opportunities</option></select></div>
        <div class="fw"><label for="p-type">Idea type</label><select id="p-type"><option>All types</option><option>Continuous Improvement</option><option>Process Revision</option></select></div>
        <div class="fw"><label for="p-status">Status</label><select id="p-status"><option>All statuses</option><option>New / Pending</option><option>In Review</option><option>In Progress</option><option>Client Review</option><option>Complete</option></select></div>
        <div class="fw"><label for="p-user">Person</label><select id="p-user"><option>Any user</option><option>Maya Collaborator</option><option>Noah Contributor</option><option>Olivia Administer</option></select></div>
      </div>
      <div class="panel">
        <table>
          <thead><tr>
            <th style="width:31%"><button type="button">Title <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M5 7 2 4h6Z"/></svg></button></th>
            <th style="width:198px">Type</th><th style="width:158px">Status</th><th style="width:112px">Priority</th>
            <th style="width:78px">Assigned</th><th style="width:96px"><button type="button">Created</button></th><th style="width:68px">Votes</th>
          </tr></thead>
          <tbody>
            <tr><td><a class="t" href="#" data-go="s-inspect">Standardize the intake checklist</a><div class="bd">Ideas · <span class="tag">cycle-time</span> <span class="tag">quality</span></div></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>New / Pending</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td>
              <td><span class="avstack"><span class="av s">MC</span><span class="av s">OA</span></span></td><td class="num">Aug 15</td><td class="num">2</td></tr>
            <tr><td><a class="t" href="#">Add proactive alerts</a><div class="bd">Ideas · <span class="tag">safety</span></div></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>New / Pending</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td>
              <td><span class="avstack"><span class="av s">NC</span></span></td><td class="num">Aug 15</td><td class="num">1</td></tr>
            <tr><td><a class="t" href="#">Pilot a faster review path</a><div class="bd">Ideas</div></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>In Review</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span></td>
              <td><span class="faint">—</span></td><td class="num">Aug 15</td><td class="num">0</td></tr>
            <tr><td><a class="t" href="#">Improve exception visibility</a><div class="bd">Ideas · <span class="tag">automation</span></div></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>In Review</span></td>
              <td><span class="marker"><span class="dot"></span>Low</span></td>
              <td><span class="avstack"><span class="av s">NC</span></span></td><td class="num">Aug 15</td><td class="num">1</td></tr>
            <tr><td><a class="t" href="#">Automate weekly reporting</a><div class="bd">Ideas · <span class="tag">quality</span> <span class="tag">safety</span></div></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>In Progress</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td>
              <td><span class="avstack"><span class="av s">MC</span><span class="av s">OA</span></span></td><td class="num">Aug 15</td><td class="num">2</td></tr>
            <tr><td><a class="t" href="#">Create a shared playbook</a><div class="bd">Ideas</div></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>In Progress</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td>
              <td><span class="faint">—</span></td><td class="num">Aug 15</td><td class="num">0</td></tr>
            <tr><td><a class="t" href="#">Validate the customer feedback loop</a><div class="bd">Ideas · <span class="tag">cycle-time</span></div></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--pink)"></span>Client Review</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span></td>
              <td><span class="avstack"><span class="av s">NC</span></span></td><td class="num">Aug 15</td><td class="num">1</td></tr>
            <tr><td><a class="t" href="#">Roll out the proven workflow</a><div class="bd">Ideas · <span class="tag">automation</span> <span class="tag">safety</span></div></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--green)"></span>Complete</span></td>
              <td><span class="marker"><span class="dot"></span>Low</span></td>
              <td><span class="avstack"><span class="av s">MC</span><span class="av s">OA</span></span></td><td class="num">Aug 15</td><td class="num">2</td></tr>
            <tr><td><a class="t" href="#">Retire the legacy step</a><div class="bd">Ideas · <span class="tag">quality</span></div></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--green)"></span>Complete</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td>
              <td><span class="avstack"><span class="av s">NC</span></span></td><td class="num">Aug 15</td><td class="num">1</td></tr>
            <tr><td><a class="t" href="#">Measure time saved</a><div class="bd">Ideas</div></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--green)"></span>Complete</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td>
              <td><span class="faint">—</span></td><td class="num">Aug 15</td><td class="num">0</td></tr>
          </tbody>
        </table>
        <div class="pgfoot">
          <span class="num">Showing 1&ndash;10 of 22</span><span class="spacer"></span>
          <label for="p-size">Rows per page</label>
          <select id="p-size"><option>10</option><option>25</option><option>50</option></select>
          <button class="btn sm2">Previous</button><button class="btn sm2">Next</button>
        </div>
      </div>
      <div class="note"><b>Density under a 15px body.</b> DESIGN.md&rsquo;s body-sm is 15px against comp&nbsp;D&rsquo;s 12.5px, so the same ten rows are taller here: measured in the browser, a row is <b>67px</b> against comp&nbsp;D&rsquo;s <b>57&ndash;59px</b>, and these ten rows run <b>669px</b> against comp&nbsp;D&rsquo;s <b>584px</b>. That is about 15% more vertical space for the same page &mdash; the real cost of this direction, worth stating plainly rather than discovering after a build. Type, status and priority all use one dot-plus-label marker, so no column shouts louder than the others.</div>
    </div>
  </div>
</div></section>

<!-- ==================== BOARD ==================== -->
<section class="screen" id="s-board" data-on="0"><div class="shell">
@@DESK:boards@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#">Boards</a> / <b>Ideas</b></span><span class="spacer"></span>
      <div class="seg" role="group" aria-label="View"><button aria-pressed="false" data-go="s-ideas">List</button><button aria-pressed="true">Lanes</button></div>
      <button class="btn">Export CSV</button><button class="btn pri">New idea</button></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Ideas</h1>
        <div class="sub">Move a card with drag, or focus it and press <span class="kbd">&larr;</span> <span class="kbd">&rarr;</span>. Both paths do the same thing.</div></div></div>
      <div class="lanes">
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--sky)"></span><span class="t">New / Pending</span><span class="ct num">3</span></div>
          <div class="kcard"><span class="t">Standardize the intake checklist</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span><span class="spacer"></span><span class="av s">MC</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up">&#9650; 2</button></div></div>
          <div class="kcard"><span class="t">Add proactive alerts</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span><span class="spacer"></span><span class="av s">NC</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up">&#9650; 1</button></div></div>
          <div class="kcard"><span class="t">Reduce manual handoffs</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="spacer"></span><span class="faint" style="font-size:14px">Unassigned</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up mine">&#9650; 2</button></div></div>
          <button class="btn ghost sm2" style="width:100%">+ Add idea</button>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--purple)"></span><span class="t">In Review</span><span class="ct num">2</span></div>
          <div class="kcard"><span class="t">Improve exception visibility</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="spacer"></span><span class="av s">NC</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up">&#9650; 1</button></div></div>
          <div class="kcard"><span class="t">Pilot a faster review path</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span><span class="spacer"></span><span class="faint" style="font-size:14px">Unassigned</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up">&#9650; 0</button></div></div>
          <button class="btn ghost sm2" style="width:100%">+ Add idea</button>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--orange)"></span><span class="t">In Progress</span><span class="ct num">2</span></div>
          <div class="kcard"><span class="t">Automate weekly reporting</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span><span class="spacer"></span><span class="av s">MC</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up">&#9650; 2</button></div></div>
          <div class="kcard"><span class="t">Create a shared playbook</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span><span class="spacer"></span><span class="faint" style="font-size:14px">Unassigned</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up">&#9650; 0</button></div></div>
          <button class="btn ghost sm2" style="width:100%">+ Add idea</button>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--pink)"></span><span class="t">Client Review</span><span class="ct num">1</span></div>
          <div class="kcard"><span class="t">Validate the customer feedback loop</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span><span class="spacer"></span><span class="av s">NC</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up">&#9650; 1</button></div></div>
          <div class="emptylane">Drop here to send an idea to the client</div>
          <button class="btn ghost sm2" style="width:100%">+ Add idea</button>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--green)"></span><span class="t">Complete</span><span class="ct num">3</span></div>
          <div class="kcard"><span class="t">Roll out the proven workflow</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="spacer"></span><span class="av s">MC</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up">&#9650; 2</button></div></div>
          <div class="kcard"><span class="t">Retire the legacy step</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span><span class="spacer"></span><span class="av s">NC</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up">&#9650; 1</button></div></div>
          <div class="kcard"><span class="t">Measure time saved</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span><span class="spacer"></span><span class="faint" style="font-size:14px">Unassigned</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up">&#9650; 0</button></div></div>
          <button class="btn ghost sm2" style="width:100%">+ Add idea</button>
        </div>
      </div>
      <div class="note"><b>Two fixes survive the restyle.</b> Idea type is written as text on every card rather than encoded in a coloured dot alone, and the page header states the keyboard equivalent for drag, so moving a card never requires a pointer. Every sticker colour on this screen &mdash; lane header, priority marker &mdash; is a dot with its own label beside it, which is the only use DESIGN.md allows colour to carry a category.</div>
    </div>
  </div>
</div></section>

<!-- ==================== DOCKED INSPECTOR ==================== -->
<section class="screen" id="s-inspect" data-on="0"><div class="shell insp">
@@DESK:ideas@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#">Home</a> / <b>Ideas</b></span><span class="spacer"></span><button class="btn pri">New idea</button></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Ideas</h1>
        <div class="sub">The list stays live and scrollable while the inspector is open.</div></div></div>
      <div class="panel">
        <table>
          <thead><tr><th style="width:44%">Title</th><th style="width:158px">Status</th><th style="width:112px">Priority</th><th style="width:78px">Assigned</th><th style="width:68px">Votes</th></tr></thead>
          <tbody>
            <tr class="sel"><td><a class="t" href="#">Standardize the intake checklist</a><div class="bd">Ideas · Continuous Improvement</div></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>New / Pending</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td>
              <td><span class="avstack"><span class="av s">MC</span><span class="av s">OA</span></span></td><td class="num">2</td></tr>
            <tr><td><a class="t" href="#">Add proactive alerts</a><div class="bd">Ideas · Process Revision</div></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>New / Pending</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td>
              <td><span class="avstack"><span class="av s">NC</span></span></td><td class="num">1</td></tr>
            <tr><td><a class="t" href="#">Pilot a faster review path</a><div class="bd">Ideas · Process Revision</div></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>In Review</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span></td>
              <td><span class="faint">—</span></td><td class="num">0</td></tr>
            <tr><td><a class="t" href="#">Automate weekly reporting</a><div class="bd">Ideas · Process Revision</div></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>In Progress</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td>
              <td><span class="avstack"><span class="av s">MC</span></span></td><td class="num">2</td></tr>
            <tr><td><a class="t" href="#">Create a shared playbook</a><div class="bd">Ideas · Continuous Improvement</div></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>In Progress</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td>
              <td><span class="faint">—</span></td><td class="num">0</td></tr>
          </tbody>
        </table>
      </div>
      <div class="note"><b>Docked, not modal.</b> The inspector is a third grid column, so background content is never covered and never needs <code>inert</code>. There is no focus trap to get wrong, Escape simply closes the column, and you can compare two ideas by arrowing down the list with the inspector open. The selected row is marked by a 3px rule in <b>#0075de</b> plus a soft ground — both readable in greyscale.</div>
    </div>
  </div>
  <aside class="inspector" aria-label="Idea inspector">
    <div class="insp-head">
      <div class="eyebrow">Ideas board · #IDEA-118</div>
      <h2>Standardize the intake checklist</h2>
      <div class="meta">Created by Noah Contributor · Aug 15, 2026</div>
    </div>
    <div class="insp-body">
      <dl class="kv">
        <dt>Status</dt><dd><select aria-label="Status" style="width:auto"><option>New / Pending</option><option>In Review</option><option>In Progress</option></select></dd>
        <dt>Type</dt><dd><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></dd>
        <dt>Priority</dt><dd><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></dd>
        <dt>Impact</dt><dd>Operational efficiency</dd>
        <dt>Assigned</dt><dd><span class="avstack" style="display:inline-flex;vertical-align:middle"><span class="av s">MC</span><span class="av s">OA</span></span> Maya, Olivia</dd>
        <dt>Outcomes</dt><dd><span class="tagrow"><span class="rmtag">Q3 · Cut intake rework</span><span class="rmtag">Q4 · One front door</span></span></dd>
        <dt>Tags</dt><dd><span class="tagrow"><span class="tag">cycle-time</span><span class="tag">quality</span></span></dd>
      </dl>
      <div>
        <div class="sec-t">Description</div>
        <p class="prose" style="font-size:15px;line-height:1.33;margin:0">Use one concise checklist so requests arrive complete and ready for action. Today three teams each keep their own version, and roughly a third of intake requests bounce back for missing information.</p>
      </div>
      <div>
        <div class="sec-t">Discussion · 3</div>
        <div class="cmt"><span class="av s">MC</span><div><div class="who">Maya Collaborator <span class="when">2d ago</span></div><p>Can we fold the safety sign-off into the same checklist? It&rsquo;s the step people forget.</p></div></div>
        <div class="cmt"><span class="av s">NC</span><div><div class="who">Noah Contributor <span class="when">1d ago</span></div><p>Yes — drafted it as section 4. Worth a review before we pilot.</p></div></div>
        <div class="cmt"><span class="av s">OA</span><div><div class="who">Olivia Administer <span class="when">3h ago</span></div><p>Looks right. Moving to In Review after standup.</p></div></div>
        <div class="field" style="margin:var(--s-sm) 0 0">
          <label for="p-cmt">Add a comment</label>
          <textarea id="p-cmt" rows="2" placeholder="Write a comment…"></textarea>
        </div>
      </div>
    </div>
    <div class="insp-foot"><button class="btn pri" style="flex:1;justify-content:center">Save</button><button class="btn" data-go="s-ideas">Close</button></div>
  </aside>
</div></section>

<!-- ==================== SETTINGS ==================== -->
<section class="screen" id="s-settings" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#">Settings</a> / <b>Statuses</b></span><span class="spacer"></span><button class="btn pri">Add status</button></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Statuses</h1>
        <div class="sub">The columns your boards group ideas by. Order here is the order on every board.</div></div></div>
      <div class="cols" style="grid-template-columns:minmax(0,1fr) 356px">
        <div class="panel">
          <table>
            <thead><tr><th style="width:36px"><span class="faint">Drag</span></th><th>Name</th><th style="width:168px">Colour</th><th style="width:74px">Ideas</th><th style="width:74px">Order</th><th style="width:66px"></th></tr></thead>
            <tbody>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>New / Pending</b></td><td><span class="marker"><span class="dot" style="background:var(--sky)"></span>Sky</span></td><td class="num">6</td><td class="num">1</td><td><button class="btn ghost sm2">Edit</button></td></tr>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>In Review</b></td><td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Purple</span></td><td class="num">4</td><td class="num">2</td><td><button class="btn ghost sm2">Edit</button></td></tr>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>In Progress</b></td><td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Orange</span></td><td class="num">4</td><td class="num">3</td><td><button class="btn ghost sm2">Edit</button></td></tr>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>Client Review</b></td><td><span class="marker"><span class="dot" style="background:var(--pink)"></span>Pink</span></td><td class="num">2</td><td class="num">4</td><td><button class="btn ghost sm2">Edit</button></td></tr>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>Complete</b></td><td><span class="marker"><span class="dot" style="background:var(--green)"></span>Green</span></td><td class="num">6</td><td class="num">5</td><td><button class="btn ghost sm2">Edit</button></td></tr>
            </tbody>
          </table>
          <div class="pgfoot"><span>Reorder by dragging, or focus a row and press <span class="kbd">Alt &uarr;</span> / <span class="kbd">Alt &darr;</span>.</span></div>
        </div>
        <div class="card">
          <h3 style="font-size:20px;font-weight:600;letter-spacing:-.125px;line-height:1.4;margin:0 0 var(--s-md)">Add status</h3>
          <form>
            <div class="field"><label for="p-sname">Name <span class="req" aria-hidden="true">*</span></label><input type="text" id="p-sname" required><div class="hint">Shown as a lane header on every board.</div></div>
            <div class="field"><label for="p-shex">Colour</label>
              <div style="display:flex;gap:var(--s-xs)"><input type="text" id="p-shex" value="#62aef0" style="flex:1"><input type="color" value="#62aef0" aria-label="Pick colour visually" style="width:44px;padding:2px;height:36px;flex:none"></div>
              <div class="hint">Colour is decoration — the status name always shows beside it.</div></div>
            <div class="field"><label for="p-sord">Position</label><select id="p-sord"><option>Last</option><option>First</option><option>After New / Pending</option></select></div>
            <button type="submit" class="btn pri" style="width:100%;justify-content:center">Add status</button>
          </form>
        </div>
      </div>
      <div class="note"><b>Create is inline, not a drawer.</b> A short create form sits beside the list it adds to, so the list stays visible for reference and there is no overlay to trap focus in. Longer edits still open the docked inspector. The swatch picker offers the DESIGN.md sticker palette by name, which is why the Colour column reads &ldquo;Sky&rdquo; rather than a hex value.</div>
    </div>
  </div>
</div></section>

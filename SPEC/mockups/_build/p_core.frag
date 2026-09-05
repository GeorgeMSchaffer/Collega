<!-- ==================== HOME ==================== -->

<section class="screen" id="s-home" data-on="1"><div class="shell">
@@DESK:home@@
  <div class="main">
    <div class="topbar"><span class="crumb"><b>Home</b></span><span class="spacer"></span>
      <button class="btn" data-roles="SiteAdmin OrgAdmin" data-go="comp-p-auth.html#s-viewas">View as&hellip;</button>
      <button class="btn pri" data-roles="OrgAdmin User" data-go="s-brainstorm">New idea</button>
      <span class="deniedwrap" data-roles="SiteAdmin"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-hn-sa">New idea</button><span class="denied" id="p-why-hn-sa">Act as a member of an organization to add ideas</span></span>
      <span class="deniedwrap" data-roles="ReadOnly"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-hn-ro">New idea</button><span class="denied" id="p-why-hn-ro">Read-only accounts can&rsquo;t create ideas</span></span></div>
    <div class="work">
      <div class="pgh" data-roles="OrgAdmin"><div class="grow"><h1>Good afternoon, Olivia</h1>
        <div class="sub">Here&rsquo;s what needs you today. Acme Robotics has 22 ideas across 2 boards and 16 delivery issues in flight &mdash; press <span class="kbd">Ctrl K</span> to jump straight to any of them.</div></div></div>
      <div class="pgh" data-roles="User"><div class="grow"><h1>Good afternoon, Umar</h1>
        <div class="sub">Here&rsquo;s what needs you today. Acme Robotics has 22 ideas across 2 boards and 16 delivery issues in flight &mdash; press <span class="kbd">Ctrl K</span> to jump straight to any of them.</div></div></div>
      <div class="pgh" data-roles="ReadOnly"><div class="grow"><h1>Good afternoon, Rae</h1>
        <div class="sub">Here&rsquo;s what&rsquo;s moving today. Acme Robotics has 22 ideas across 2 boards and 16 delivery issues in flight &mdash; press <span class="kbd">Ctrl K</span> to jump straight to any of them.</div></div></div>
      <div class="pgh" data-roles="SiteAdmin"><div class="grow"><h1>Good afternoon, Sam</h1>
        <div class="sub">Platform-wide activity across every organization. Two organizations, 41 ideas, 16 delivery issues. You are not a member of any of them &mdash; to change what they own, act as one of their administrators.</div></div></div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Couldn&rsquo;t load your boards.</b> Nothing has been changed. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>

      <div data-when="loading" aria-busy="true">
        <div class="kpis"><div class="kpi"><span class="skel w40"></span><span class="skel w60" style="margin-top:14px"></span></div><div class="kpi"><span class="skel w40"></span><span class="skel w60" style="margin-top:14px"></span></div><div class="kpi"><span class="skel w40"></span><span class="skel w60" style="margin-top:14px"></span></div><div class="kpi"><span class="skel w40"></span><span class="skel w60" style="margin-top:14px"></span></div></div>
        <div class="cols"><div class="panel"><div class="in"><span class="skel w80"></span><span class="skel w60"></span><span class="skel w80"></span></div></div><div class="panel"><div class="in"><span class="skel w60"></span><span class="skel w80"></span></div></div></div>
      </div>

      <div data-when="empty">
        <div class="empty" data-roles="OrgAdmin User ReadOnly">
          <h3>No boards yet</h3>
          <p>Your organization doesn&rsquo;t have any boards to show. An Org Admin can create boards from Settings.</p>
          <a class="btn pri" href="#" data-go="comp-p-admin.html#s-boards-admin" data-roles="OrgAdmin">Create a board</a>
        </div>
        <div class="empty" data-roles="SiteAdmin">
          <h3>No organizations yet</h3>
          <p>Nothing to show until an organization exists. Creating one provisions its default statuses and a first board.</p>
          <a class="btn pri" href="#" data-go="comp-p-admin.html#s-orgs">Create an organization</a>
        </div>
      </div>

      <div data-when="normal" data-roles="OrgAdmin User ReadOnly">
        <div class="tip">
          <div><b>New to Collega?</b> An idea moves New / Pending &rarr; In Review &rarr; In Progress &rarr; Client Review &rarr; Complete, and the people, comments and history stay attached the whole way. Start one from any board, or press <span class="kbd">Ctrl K</span> and type &ldquo;new idea&rdquo;.</div>
          <button class="btn sm2">Got it</button>
        </div>
        <div class="kpis">
          <div class="kpi"><div class="k">Open ideas</div><div class="v num">14</div><div class="d">of 22 total</div><div class="why">Anything not yet Complete or Archived, on any board you can see.</div></div>
          <div class="kpi"><div class="k">Awaiting review</div><div class="v num">4</div><div class="d">2 over 7 days</div><div class="why">Sitting in In Review, waiting on a decision from a person.</div></div>
          <div class="kpi"><div class="k">Assigned to me</div><div class="v num">6</div><div class="d">1 critical</div><div class="why">Open ideas with your name in the Assigned field.</div></div>
          <div class="kpi"><div class="k">Completed &middot; 30d</div><div class="v num">6</div><div class="d">+2 vs prior</div><div class="why">Reached Complete in the last 30 days, against the 30 days before it.</div></div>
        </div>
        <div class="cols">
          <div class="panel">
            <h2><span class="grow">Needs your attention</span><button class="btn sm2" data-go="s-ideas">View all</button></h2>
            <div class="lede">Open ideas that are critical, high priority, or have gone a week without moving. Oldest first &mdash; a stalled idea is the failure mode, not a busy one.</div>
            <table class="wrap1">
              <thead><tr><th>Idea</th><th style="width:172px">Status</th><th style="width:120px">Priority</th><th style="width:64px">Age</th></tr></thead>
              <tbody>
                <tr><td><a class="t" href="#" data-go="s-inspect">Pilot a faster review path</a><div class="bd">Ideas · Process Revision</div></td>
                  <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>In Review</span></td>
                  <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span></td><td class="num">9d</td></tr>
                <tr><td><a class="t" href="#" data-go="s-inspect">Validate the customer feedback loop</a><div class="bd">Ideas · Process Revision</div></td>
                  <td><span class="marker"><span class="dot" style="background:var(--pink)"></span>Client Review</span></td>
                  <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span></td><td class="num">8d</td></tr>
                <tr><td><a class="t" href="#" data-go="s-inspect">Standardize the intake checklist</a><div class="bd">Ideas · Continuous Improvement</div></td>
                  <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>New / Pending</span></td>
                  <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td><td class="num">6d</td></tr>
                <tr><td><a class="t" href="#" data-go="s-inspect">Create a shared playbook</a><div class="bd">Ideas · Continuous Improvement</div></td>
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
              <li><span class="av s">OA</span><span>Olivia grouped <b>Automate weekly reporting</b> under <b>Cut reporting effort</b></span><span class="when">2h</span></li>
              <li><span class="av s">OA</span><span>Olivia upvoted <b>Reduce manual handoffs</b></span><span class="when">3h</span></li>
              <li><span class="av s">NC</span><span>Noah created <b>Roll out the proven workflow</b></span><span class="when">yest</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div data-when="normal" data-roles="SiteAdmin">
        <div class="kpis">
          <div class="kpi"><div class="k">Organizations</div><div class="v num">2</div><div class="d">0 archived</div><div class="why">Every organization on this deployment, archived ones excluded.</div></div>
          <div class="kpi"><div class="k">Boards</div><div class="v num">4</div><div class="d">across 2 organizations</div><div class="why">Every board anyone can reach; open one to read it.</div></div>
          <div class="kpi"><div class="k">Open ideas</div><div class="v num">27</div><div class="d">of 41 total</div><div class="why">Anything not yet Complete or Archived, in any organization.</div></div>
          <div class="kpi"><div class="k">Users</div><div class="v num">8</div><div class="d">1 inactive</div><div class="why">Every account, whatever its organization or role.</div></div>
        </div>
        <div class="cols">
          <div class="panel">
            <h2><span class="grow">All boards</span><button class="btn sm2" data-go="s-boards">View all</button></h2>
            <div class="lede">Every board in every organization, grouped by organization. Open one to read it; to change it, act as one of its administrators.</div>
            <table class="wrap1">
              <thead><tr><th>Board</th><th style="width:180px">Organization</th><th style="width:110px">Swimlanes</th></tr></thead>
              <tbody>
                <tr><td><a class="t" href="#" data-go="s-board">Ideas</a></td><td>Acme Robotics</td><td class="num">5</td></tr>
                <tr><td><a class="t" href="#">Opportunities</a></td><td>Acme Robotics</td><td class="num">4</td></tr>
                <tr><td><a class="t" href="#">Product ideas</a></td><td>Globex Industrial</td><td class="num">5</td></tr>
                <tr><td><a class="t" href="#">Ops improvements</a></td><td>Globex Industrial</td><td class="num">3</td></tr>
              </tbody>
            </table>
          </div>
          <div class="panel">
            <h2><span class="grow">Recent activity</span></h2>
            <div class="lede">Everything anyone changed, in any organization, newest first.</div>
            <ul class="feed">
              <li><span class="av s">NC</span><span>Noah moved <b>Automate weekly reporting</b> to In Progress <span class="faint">· Acme</span></span><span class="when">14m</span></li>
              <li><span class="av s">LT</span><span>Lena created the board <b>Ops improvements</b> <span class="faint">· Globex</span></span><span class="when">40m</span></li>
              <li><span class="av s">MC</span><span>Maya commented on <b>Improve exception visibility</b> <span class="faint">· Acme</span></span><span class="when">1h</span></li>
              <li><span class="av s">SA</span><span>You created the organization <b>Globex Industrial</b></span><span class="when">yest</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="note"><b>Two voices, kept apart.</b> Everything inside the app frame is product copy, written to be lifted straight into the real UI: what each KPI counts, how the attention queue is ordered, and what a first-run user needs to know before touching anything. Everything addressed to a reviewer of this comp &mdash; the screen list, the keyboard shortcuts, which screens carry open questions &mdash; sits in the band above the frame, outside the mock, so nobody has to guess which sentences would ship. Comp&nbsp;D&rsquo;s premise survives intact underneath: Home answers &ldquo;what needs me now&rdquo;, not &ldquo;what exists&rdquo;, and every number here is a filtered query you can open. A Site Admin has no &ldquo;me&rdquo; inside any organization, so their Home is the one roll-up in the product.</div>
    </div>
  </div>
</div></section>

<!-- ==================== BOARDS ==================== -->

<section class="screen" id="s-boards" data-on="0"><div class="shell">
@@DESK:boards@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-home">Home</a> / <b>Boards</b></span><span class="spacer"></span>
      <a class="btn" href="#" data-go="comp-p-admin.html#s-boards-admin" data-roles="OrgAdmin">Manage boards</a></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Boards</h1>
        <div class="sub" data-roles="OrgAdmin User ReadOnly">Boards you can access. Selecting a board opens its swim lanes.</div>
        <div class="sub" data-roles="SiteAdmin">Every board in every organization. Selecting a board opens its swim lanes, read-only.</div></div></div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Couldn&rsquo;t load boards.</b> Nothing has been changed. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>
      <div data-when="loading" aria-busy="true" class="panel"><div class="in"><span class="skel w60"></span><span class="skel w80"></span><span class="skel w40"></span></div></div>
      <div data-when="empty" class="empty">
        <h3>No boards yet</h3>
        <p>An organization admin can create boards under Settings. A new organization starts with one default board and five statuses.</p>
        <a class="btn pri" href="#" data-go="comp-p-admin.html#s-boards-admin" data-roles="OrgAdmin">Create a board</a>
      </div>

      <div data-when="normal" class="panel">
        <table class="wrap1">
          <thead><tr><th>Board</th><th style="width:190px" data-roles="SiteAdmin">Organization</th><th style="width:120px">Swimlanes</th><th style="width:190px">User status moves</th><th style="width:96px"><span class="vh">Open</span></th></tr></thead>
          <tbody>
            <tr><td><a class="t" href="#" data-go="s-board">Ideas</a><div class="bd">Process ideas for the whole organization</div></td><td data-roles="SiteAdmin">Acme Robotics</td><td class="num">5</td><td><span class="marker"><span class="dot" style="background:var(--green)"></span>Allowed</span></td><td><a class="btn sm2" href="#" data-go="s-board">Open</a></td></tr>
            <tr><td><a class="t" href="#">Opportunities</a><div class="bd">Commercial and partnership leads</div></td><td data-roles="SiteAdmin">Acme Robotics</td><td class="num">4</td><td><span class="marker"><span class="dot"></span>Admins only</span></td><td><a class="btn sm2" href="#">Open</a></td></tr>
            <tr data-roles="SiteAdmin"><td><a class="t" href="#">Product ideas</a><div class="bd">Feature requests from the field</div></td><td>Globex Industrial</td><td class="num">5</td><td><span class="marker"><span class="dot" style="background:var(--green)"></span>Allowed</span></td><td><a class="btn sm2" href="#">Open</a></td></tr>
            <tr data-roles="SiteAdmin"><td><a class="t" href="#">Ops improvements</a><div class="bd">Plant-floor process changes</div></td><td>Globex Industrial</td><td class="num">3</td><td><span class="marker"><span class="dot"></span>Admins only</span></td><td><a class="btn sm2" href="#">Open</a></td></tr>
          </tbody>
        </table>
      </div>

      <div class="note"><b>A list, not a command center.</b> Boards are created and configured under Settings, so this page has no create action; it exists so a member can find a board by name and see, before opening it, whether members may move cards on it. &ldquo;User status moves&rdquo; is the board&rsquo;s <code>AllowUserStatusUpdate</code> flag written as a marker with a label, never a bare colour. A Site Admin sees the same table with an Organization column and every organization&rsquo;s boards in it.</div>
    </div>
  </div>
</div></section>

<!-- ==================== IDEAS LIST ==================== -->

<section class="screen" id="s-ideas" data-on="0"><div class="shell">
@@DESK:ideas@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-home">Home</a> / <b>Ideas</b></span><span class="spacer"></span>
      <div class="seg" role="group" aria-label="Scope" data-roles="OrgAdmin User ReadOnly"><button aria-pressed="true">All</button><button aria-pressed="false">Created by me</button><button aria-pressed="false">Assigned to me</button></div>
      <button class="btn pri" data-roles="OrgAdmin User" data-go="s-brainstorm">New idea</button>
      <span class="deniedwrap" data-roles="SiteAdmin"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-in-sa">New idea</button><span class="denied" id="p-why-in-sa">Act as a member of an organization to add ideas</span></span>
      <span class="deniedwrap" data-roles="ReadOnly"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-in-ro">New idea</button><span class="denied" id="p-why-in-ro">Read-only accounts can&rsquo;t create ideas</span></span></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Ideas</h1>
        <div class="sub" data-roles="OrgAdmin User ReadOnly">Every idea in Acme Robotics, across all boards.</div>
        <div class="sub" data-roles="SiteAdmin">Every idea in every organization, read-only from here. Act as a member to change one.</div></div></div>
      <!-- every filter keeps a real, visible label -->
      <div class="filters" data-roles="OrgAdmin User ReadOnly">
        <div class="fw wide"><label for="p-q">Search</label><input type="search" id="p-q" placeholder="Title, description, people, status, or a custom field&hellip;"></div>
        <div class="fw"><label for="p-board">Board</label><select id="p-board"><option>All boards</option><option>Ideas</option><option>Opportunities</option></select></div>
        <div class="fw"><label for="p-type">Idea type</label><select id="p-type"><option>All types</option><option>Continuous Improvement</option><option>Process Revision</option></select></div>
        <div class="fw"><label for="p-status">Status</label><select id="p-status"><option>All statuses</option><option>New / Pending</option><option>In Review</option><option>In Progress</option><option>Client Review</option><option>Complete</option></select></div>
        <div class="fw"><label for="p-tag">Tag</label><input type="text" id="p-tag" placeholder="Tag&hellip;"></div>
        <div class="fw"><label for="p-user">Person</label><select id="p-user"><option>Any user</option><option>Maya Collaborator</option><option>Noah Contributor</option><option>Olivia Administer</option></select></div>
        <button class="btn" type="button" aria-expanded="true">Hide field filters (1)</button>
      </div>
      <div class="filters" data-roles="SiteAdmin">
        <div class="fw wide"><label for="p-q-sa">Search</label><input type="search" id="p-q-sa" placeholder="Title, description, people, status, or a custom field&hellip;"></div>
        <div class="fw"><label for="p-org-sa">Organization</label><select id="p-org-sa"><option>All organizations</option><option>Acme Robotics</option><option>Globex Industrial</option></select></div>
      </div>
      <div class="panel" data-when="normal" data-roles="OrgAdmin User ReadOnly" style="margin-bottom:var(--s-md)">
        <h2><span class="grow">Custom fields</span><span class="cap faint" style="font-weight:400">1 active</span></h2>
        <div class="lede">One control per field the organization defined, typed to match: a range for numbers and dates, any-of for multi-select. Unknown values are ignored rather than refused.</div>
        <div class="in">
          <div class="ff">
            <div class="field" style="margin:0"><label for="p-ff-sav-min">Estimated savings</label><div class="range"><input type="text" inputmode="numeric" id="p-ff-sav-min" placeholder="min" value="5000" aria-label="Estimated savings, minimum"><span class="faint">&ndash;</span><input type="text" inputmode="numeric" id="p-ff-sav-max" placeholder="max" aria-label="Estimated savings, maximum"></div></div>
            <div class="field" style="margin:0"><label for="p-ff-td-from">Target date</label><div class="range"><input type="text" id="p-ff-td-from" placeholder="from" aria-label="Target date, from"><span class="faint">&ndash;</span><input type="text" id="p-ff-td-to" placeholder="to" aria-label="Target date, to"></div></div>
            <div class="field" style="margin:0"><label for="p-ff-vendor">Needs vendor</label><select id="p-ff-vendor"><option>Any</option><option>Yes</option><option>No</option></select></div>
            <div class="field" style="margin:0"><label for="p-ff-region">Region</label><select id="p-ff-region"><option>Any</option><option>EMEA</option><option>Americas</option><option>APAC</option></select></div>
          </div>
          <div style="display:flex;gap:var(--s-xs);margin-top:var(--s-md)"><button class="btn pri">Apply filters</button><button class="btn">Clear filters</button></div>
        </div>
      </div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Couldn&rsquo;t load ideas.</b> Nothing has been changed. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>
      <div data-when="loading" aria-busy="true" class="panel"><div class="in"><span class="skel w80"></span><span class="skel w60"></span><span class="skel w80"></span><span class="skel w40"></span><span class="skel w80"></span></div></div>
      <div data-when="empty" class="empty">
        <h3>No ideas match this filter</h3>
        <p>Try a different filter, or clear the search.</p>
        <button class="btn">Clear filters</button>
      </div>

      <div class="panel" data-when="normal">
        <table class="wrap1">
          <thead data-roles="OrgAdmin User ReadOnly"><tr>
            <th style="width:28%"><button type="button" aria-sort="none">Title <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M5 7 2 4h6Z"/></svg></button></th>
            <th style="width:186px">Type</th><th style="width:150px"><button type="button">Status</button></th><th style="width:104px">Priority</th>
            <th style="width:78px"><button type="button">Assigned</button></th><th style="width:96px"><button type="button" aria-sort="descending">Created <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M5 7 2 4h6Z"/></svg></button></th><th style="width:68px">Votes</th>
          </tr></thead>
          <thead data-roles="SiteAdmin"><tr>
            <th style="width:30%">Title</th><th style="width:150px">Organization</th>
            <th style="width:186px">Type</th><th style="width:150px">Status</th><th style="width:104px">Priority</th>
            <th style="width:96px">Created</th>
          </tr></thead>
          <tbody>
            <tr><td><a class="t" href="#" data-go="s-inspect">Standardize the intake checklist</a><div class="bd">Ideas · <span class="tag">cycle-time</span> <span class="tag">quality</span></div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>New / Pending</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="avstack"><span class="av s">MC</span><span class="av s">OA</span></span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">2</td></tr>
            <tr><td><a class="t" href="#" data-go="s-inspect">Add proactive alerts</a><div class="bd">Ideas · <span class="tag">safety</span></div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>New / Pending</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="avstack"><span class="av s">NC</span></span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">1</td></tr>
            <tr><td><a class="t" href="#" data-go="s-inspect">Pilot a faster review path</a><div class="bd">Ideas</div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>In Review</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="faint">—</span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">0</td></tr>
            <tr><td><a class="t" href="#" data-go="s-inspect">Improve exception visibility</a><div class="bd">Ideas · <span class="tag">automation</span></div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>In Review</span></td>
              <td><span class="marker"><span class="dot"></span>Low</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="avstack"><span class="av s">NC</span></span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">1</td></tr>
            <tr><td><a class="t" href="#" data-go="s-inspect">Automate weekly reporting</a><div class="bd">Ideas · <span class="tag">quality</span> <span class="tag">safety</span></div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>In Progress</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="avstack"><span class="av s">MC</span><span class="av s">OA</span></span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">2</td></tr>
            <tr><td><a class="t" href="#" data-go="s-inspect">Create a shared playbook</a><div class="bd">Ideas</div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>In Progress</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="faint">—</span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">0</td></tr>
            <tr><td><a class="t" href="#" data-go="s-inspect">Validate the customer feedback loop</a><div class="bd">Ideas · <span class="tag">cycle-time</span></div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--pink)"></span>Client Review</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="avstack"><span class="av s">NC</span></span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">1</td></tr>
            <tr><td><a class="t" href="#" data-go="s-inspect">Roll out the proven workflow</a><div class="bd">Ideas · <span class="tag">automation</span> <span class="tag">safety</span></div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--green)"></span>Complete</span></td>
              <td><span class="marker"><span class="dot"></span>Low</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="avstack"><span class="av s">MC</span><span class="av s">OA</span></span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">2</td></tr>
            <tr><td><a class="t" href="#" data-go="s-inspect">Retire the legacy step</a><div class="bd">Ideas · <span class="tag">quality</span></div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--green)"></span>Complete</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="avstack"><span class="av s">NC</span></span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">1</td></tr>
            <tr><td><a class="t" href="#" data-go="s-inspect">Measure time saved</a><div class="bd">Ideas</div></td><td data-roles="SiteAdmin">Acme Robotics</td>
              <td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--green)"></span>Complete</span></td>
              <td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td>
              <td data-roles="OrgAdmin User ReadOnly"><span class="faint">—</span></td><td class="num">Aug 15</td><td class="num" data-roles="OrgAdmin User ReadOnly">0</td></tr>
          </tbody>
        </table>
        <div class="pgfoot">
          <span class="num" data-roles="OrgAdmin User ReadOnly">Showing 1&ndash;10 of 22</span><span class="num" data-roles="SiteAdmin">Showing 1&ndash;10 of 41</span><span class="spacer"></span>
          <label for="p-size">Rows per page</label>
          <select id="p-size"><option>25</option><option>50</option><option>100</option><option>250</option></select>
          <button class="btn sm2" aria-disabled="true">Previous</button><button class="btn sm2">Next</button>
        </div>
      </div>
      <div class="note"><b>Density under a 15px body.</b> DESIGN.md&rsquo;s body-sm is 15px against comp&nbsp;D&rsquo;s 12.5px, so the same ten rows are taller here: measured in the browser, a row is <b>67px</b> against comp&nbsp;D&rsquo;s <b>57&ndash;59px</b>, and these ten rows run <b>669px</b> against comp&nbsp;D&rsquo;s <b>584px</b>. That is about 15% more vertical space for the same page &mdash; the real cost of this direction, worth stating plainly rather than discovering after a build. Type, status and priority all use one dot-plus-label marker, so no column shouts louder than the others. Page sizes are the spec&rsquo;s 25 / 50 / 100 / 250; the ten rows here are a measurement sample, not a page.</div>
      <div class="note"><b>Every filter is server-side, and search reads every column.</b> Title, description, the people who raised or hold it, the status name, and the text of any custom field &mdash; one box, one query. A Site Admin gets search and an Organization filter and nothing else: no scope chips, because there is no &ldquo;me&rdquo; to scope to, and no sort, because the cross-organization list is a lookup, not a worklist.</div>
    </div>
  </div>
</div></section>

<!-- ==================== BOARD ==================== -->

<section class="screen" id="s-board" data-on="0"><div class="shell">
@@DESK:boards@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-boards">Boards</a> / <b>Ideas</b></span><span class="spacer"></span>
      <div class="seg" role="group" aria-label="View"><button aria-pressed="false" data-go="s-ideas">List</button><button aria-pressed="true">Lanes</button></div>
      <label for="p-boardpick" class="vh">Board</label><select id="p-boardpick" style="width:auto"><option selected>Ideas</option><option>Opportunities</option></select>
      <button class="btn">Export CSV</button>
      <button class="btn" data-roles="OrgAdmin User" aria-expanded="true">Hide import</button>
      <span class="deniedwrap" data-roles="SiteAdmin"><button class="btn" aria-disabled="true" aria-describedby="p-why-bi-sa">Import CSV</button><span class="denied" id="p-why-bi-sa">Through View As</span></span>
      <button class="btn pri" data-roles="OrgAdmin User" data-go="s-brainstorm">New idea</button>
      <span class="deniedwrap" data-roles="SiteAdmin"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-bn-sa">New idea</button><span class="denied" id="p-why-bn-sa">Act as a member</span></span>
      <span class="deniedwrap" data-roles="ReadOnly"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-bn-ro">New idea</button><span class="denied" id="p-why-bn-ro">Read-only account</span></span></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Ideas</h1>
        <div class="sub" data-roles="OrgAdmin User">Move a card with drag, or focus it and press <span class="kbd">&larr;</span> <span class="kbd">&rarr;</span>. Both paths do the same thing. Members may move cards on this board; an administrator can turn that off per board.</div>
        <div class="sub" data-roles="SiteAdmin ReadOnly">Cards open read-only for your role, and nothing here can be moved. Export is still yours &mdash; the CSV is a read.</div></div></div>
      <div class="filters" data-when="normal">
        <div class="fw wide"><label for="p-bq">Search</label><input type="search" id="p-bq" placeholder="Search title, tag, assignee&hellip;"></div>
        <button class="btn" type="button">Clear</button>
      </div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Moving the idea failed.</b> The card is back where it was. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>
      <div data-when="loading" aria-busy="true" class="lanes">
        <div class="lane"><div class="lanehd"><span class="skel w60"></span></div><div class="kcard"><span class="skel w80"></span><span class="skel w40"></span></div><div class="kcard"><span class="skel w60"></span><span class="skel w40"></span></div></div>
        <div class="lane"><div class="lanehd"><span class="skel w60"></span></div><div class="kcard"><span class="skel w80"></span><span class="skel w40"></span></div></div>
        <div class="lane"><div class="lanehd"><span class="skel w60"></span></div></div>
        <div class="lane"><div class="lanehd"><span class="skel w60"></span></div></div>
      </div>
      <div data-when="empty">
        <div class="lanes">
          <div class="lane"><div class="lanehd"><span class="dot" style="background:var(--sky)"></span><span class="t">New / Pending</span><span class="ct num">0</span></div><div class="emptylane">No ideas</div></div>
          <div class="lane"><div class="lanehd"><span class="dot" style="background:var(--purple)"></span><span class="t">In Review</span><span class="ct num">0</span></div><div class="emptylane">No ideas</div></div>
          <div class="lane"><div class="lanehd"><span class="dot" style="background:var(--orange)"></span><span class="t">In Progress</span><span class="ct num">0</span></div><div class="emptylane">No ideas</div></div>
          <div class="lane"><div class="lanehd"><span class="dot" style="background:var(--pink)"></span><span class="t">Client Review</span><span class="ct num">0</span></div><div class="emptylane">No ideas</div></div>
          <div class="lane"><div class="lanehd"><span class="dot" style="background:var(--green)"></span><span class="t">Complete</span><span class="ct num">0</span></div><div class="emptylane">No ideas</div></div>
        </div>
        <div class="empty" style="margin-top:var(--s-md)">
          <h3>No ideas on this board yet</h3>
          <p data-roles="OrgAdmin User">Use &ldquo;New idea&rdquo; to add the first one. It lands in New / Pending, the left-most lane.</p>
          <p data-roles="SiteAdmin ReadOnly">Nothing has been raised here yet.</p>
          <button class="btn pri" data-roles="OrgAdmin User" data-go="s-brainstorm">New idea</button>
        </div>
      </div>

      <div data-when="normal">
      <div class="lanes">
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--sky)"></span><span class="t">New / Pending</span><span class="ct num">3</span></div>
          <div class="kcard" data-go="s-inspect"><span class="t">Standardize the intake checklist</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span><span class="spacer"></span><span class="av s">MC</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 2</button><span class="up" data-roles="SiteAdmin" title="Upvote counts are read-only for a Site Admin; use View as… to vote as a member">&#9650; 2</span></div></div>
          <div class="kcard"><span class="t">Add proactive alerts</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span><span class="spacer"></span><span class="av s">NC</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 1</button><span class="up" data-roles="SiteAdmin">&#9650; 1</span></div></div>
          <div class="kcard"><span class="t">Reduce manual handoffs</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="spacer"></span><span class="faint" style="font-size:14px">Unassigned</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up mine" data-roles="OrgAdmin User ReadOnly" aria-label="Remove your upvote" aria-pressed="true">&#9650; 2</button><span class="up" data-roles="SiteAdmin">&#9650; 2</span></div></div>
          <button class="btn ghost sm2" data-roles="OrgAdmin User" data-go="s-create">+ Add idea</button>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--purple)"></span><span class="t">In Review</span><span class="ct num">2</span></div>
          <div class="kcard"><span class="t">Improve exception visibility</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="spacer"></span><span class="av s">NC</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 1</button><span class="up" data-roles="SiteAdmin">&#9650; 1</span></div></div>
          <div class="kcard"><span class="t">Pilot a faster review path</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span><span class="spacer"></span><span class="faint" style="font-size:14px">Unassigned</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 0</button><span class="up" data-roles="SiteAdmin">&#9650; 0</span></div></div>
          <button class="btn ghost sm2" data-roles="OrgAdmin User" data-go="s-create">+ Add idea</button>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--orange)"></span><span class="t">In Progress</span><span class="ct num">2</span></div>
          <div class="kcard"><span class="t">Automate weekly reporting</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span><span class="spacer"></span><span class="av s">MC</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 2</button><span class="up" data-roles="SiteAdmin">&#9650; 2</span></div></div>
          <div class="kcard"><span class="t">Create a shared playbook</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span><span class="spacer"></span><span class="faint" style="font-size:14px">Unassigned</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 0</button><span class="up" data-roles="SiteAdmin">&#9650; 0</span></div></div>
          <button class="btn ghost sm2" data-roles="OrgAdmin User" data-go="s-create">+ Add idea</button>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--pink)"></span><span class="t">Client Review</span><span class="ct num">1</span></div>
          <div class="kcard"><span class="t">Validate the customer feedback loop</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>Critical</span><span class="spacer"></span><span class="av s">NC</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 1</button><span class="up" data-roles="SiteAdmin">&#9650; 1</span></div></div>
          <div class="emptylane" data-roles="OrgAdmin User">Drop here to send an idea to the client</div>
          <button class="btn ghost sm2" data-roles="OrgAdmin User" data-go="s-create">+ Add idea</button>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--green)"></span><span class="t">Complete</span><span class="ct num">3</span></div>
          <div class="kcard"><span class="t">Roll out the proven workflow</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="spacer"></span><span class="av s">MC</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 2</button><span class="up" data-roles="SiteAdmin">&#9650; 2</span></div></div>
          <div class="kcard"><span class="t">Retire the legacy step</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span><span class="spacer"></span><span class="av s">NC</span></div><div class="ft"><span class="tag">Continuous Improvement</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 1</button><span class="up" data-roles="SiteAdmin">&#9650; 1</span></div></div>
          <div class="kcard"><span class="t">Measure time saved</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span><span class="spacer"></span><span class="faint" style="font-size:14px">Unassigned</span></div><div class="ft"><span class="tag">Process Revision</span><span class="spacer"></span><button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea">&#9650; 0</button><span class="up" data-roles="SiteAdmin">&#9650; 0</span></div></div>
          <button class="btn ghost sm2" data-roles="OrgAdmin User" data-go="s-create">+ Add idea</button>
        </div>
      </div>

      <div class="card" data-roles="OrgAdmin User" style="margin-top:var(--s-md);max-width:760px">
        <div class="title" style="margin-bottom:4px">Import ideas from CSV</div>
        <p class="sm muted" style="margin:0 0 var(--s-sm)">Columns: Title, Description, Priority, Idea Type, Business Impact, Status (optional), Due Date (optional), Tags (optional). Idea Type and Business Impact must match an active option by name. Each row creates a new idea. Tip: export first for the exact format.</p>
        <div class="field" style="margin-bottom:var(--s-sm)"><label for="p-csv">CSV file</label><input type="file" id="p-csv" accept=".csv"></div>
        <div class="alert warn" role="status"><span><b>Imported 12 ideas, 2 rejected.</b> Row 7 &ldquo;Fix the thing&rdquo; &mdash; Idea Type &ldquo;Quick Win&rdquo; is not an active option. Row 11 &ldquo;&rdquo; &mdash; Title is required.</span></div>
      </div>
      </div>

      <div class="note"><b>Two fixes survive the restyle.</b> Idea type is written as text on every card rather than encoded in a coloured dot alone, and the page header states the keyboard equivalent for drag, so moving a card never requires a pointer. Every sticker colour on this screen &mdash; lane header, priority marker &mdash; is a dot with its own label beside it, which is the only use DESIGN.md allows colour to carry a category. The rail is 288px columns that scroll; the page does not. A Site Admin and a Read Only account see the same board with nothing to press but Export; whether a member may drag is the board&rsquo;s own setting, enforced by the server on the move rather than by hiding the handle.</div>
    </div>
  </div>
</div></section>

<!-- ==================== DOCKED INSPECTOR ==================== -->

<section class="screen" id="s-inspect" data-on="0"><div class="shell insp">
@@DESK:ideas@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-home">Home</a> / <b>Ideas</b></span><span class="spacer"></span>
      <button class="btn pri" data-roles="OrgAdmin User" data-go="s-brainstorm">New idea</button></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Ideas</h1>
        <div class="sub">The list stays live and scrollable while the inspector is open.</div></div></div>
      <div class="panel">
        <table class="wrap1">
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
      <div class="note"><b>Docked, not modal.</b> The inspector is a third grid column, so background content is never covered and never needs <code>inert</code>. There is no focus trap to get wrong, Escape simply closes the column, and you can compare two ideas by arrowing down the list with the inspector open. The selected row is marked by a 3px rule in <b>#0075de</b> plus a soft ground &mdash; both readable in greyscale.</div>
      <div class="note"><b>Four roles, one panel.</b> An Org Admin gets everything, including the break-glass type reassignment and delete. A member edits, votes and comments. A Read Only account cannot edit but still votes and comments &mdash; engagement is deliberately kept open to them. A Site Admin can do none of it directly: not a member of the organization, so no vote, no comment, no edit, and the panel says so where each control would be.</div>
    </div>
  </div>
  <aside class="inspector" aria-label="Idea inspector">
    <div class="insp-head">
      <div class="eyebrow">Ideas board · #IDEA-118 · New / Pending</div>
      <h2>Standardize the intake checklist</h2>
      <div class="meta">Created by Noah Contributor · Aug 15, 2026 · Ideas · High priority</div>
    </div>
    <div class="insp-body">
      <div data-when="error"><div class="alert" role="alert"><span><b>This idea could not be loaded.</b> It may have been deleted, or it belongs to an organization you cannot see.</span></div></div>
      <div data-when="loading" aria-busy="true"><p class="sm muted" style="margin:0 0 var(--s-sm)">Loading idea&hellip;</p><span class="skel w80"></span><span class="skel w60"></span><span class="skel w80"></span><span class="skel w40"></span></div>
      <div data-when="normal empty" style="display:flex;flex-direction:column;gap:var(--s-lg)">
        <dl class="kv">
          <dt>Status</dt><dd><select aria-label="Move in board" style="width:auto" data-roles="OrgAdmin User"><option>New / Pending</option><option>In Review</option><option>In Progress</option><option>Client Review</option><option>Complete</option></select><span data-roles="SiteAdmin ReadOnly"><span class="marker"><span class="dot" style="background:var(--sky)"></span>New / Pending</span></span></dd>
          <dt>Type</dt><dd><span class="marker"><span class="dot" style="background:var(--teal)"></span>Continuous Improvement</span> <button class="btn sm2" data-roles="OrgAdmin" style="margin-left:6px">Reassign&hellip;</button></dd>
          <dt>Priority</dt><dd><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></dd>
          <dt>Impact</dt><dd><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></dd>
          <dt>Due date</dt><dd class="num">Sep 30, 2026</dd>
          <dt>Assigned</dt><dd><span class="avstack" style="display:inline-flex;vertical-align:middle"><span class="av s">MC</span><span class="av s">OA</span></span> Maya, Olivia</dd>
          <dt>Tags</dt><dd><span class="tagrow"><span class="tag">cycle-time</span><span class="tag">quality</span></span></dd>
        </dl>
        <div>
          <div class="sec-t">Custom fields</div>
          <dl class="kv">
            <dt>Est. savings</dt><dd class="num">$12,400 / yr</dd>
            <dt>Region</dt><dd>EMEA</dd>
            <dt>Needs vendor</dt><dd>No</dd>
            <dt>Vendor contact <span class="archtag">archived</span></dt><dd class="muted">ops-vendors@acme.example</dd>
          </dl>
        </div>
        <div>
          <div class="sec-t">Description</div>
          <p class="prose" style="font-size:15px;line-height:1.33;margin:0">Use one concise checklist so requests arrive complete and ready for action. Today three teams each keep their own version, and roughly a third of intake requests bounce back for missing information.</p>
        </div>
        <div>
          <div class="sec-t" style="display:flex;align-items:center;gap:var(--s-xs)"><span class="grow">Discussion · 3</span>
            <button class="up" data-roles="OrgAdmin User ReadOnly" aria-label="Upvote this idea" style="margin:0">&#9650; 2</button>
            <span class="up" data-roles="SiteAdmin" style="margin:0" title="Upvote counts are read-only for a Site Admin; use View as… to vote as a member">&#9650; 2</span></div>
          <div class="cmt"><span class="av s">MC</span><div><div class="who">Maya Collaborator <span class="when">2d ago</span></div><p>Can we fold the safety sign-off into the same checklist? It&rsquo;s the step people forget.</p></div></div>
          <div class="cmt"><span class="av s">NC</span><div><div class="who">Noah Contributor <span class="when">1d ago</span></div><p>Yes — drafted it as section 4. Worth a review before we pilot.</p></div></div>
          <div class="cmt"><span class="av s">OA</span><div><div class="who">Olivia Administer <span class="when">3h ago</span></div><p>Looks right. Moving to In Review after standup.</p></div></div>
          <div class="field" style="margin:var(--s-sm) 0 0" data-roles="OrgAdmin User ReadOnly">
            <label for="p-cmt">Add a comment</label>
            <textarea id="p-cmt" rows="2" placeholder="Join the discussion… type someone's email with @ to notify them" maxlength="2000"></textarea>
            <div class="charcount">0 / 2000</div>
          </div>
          <p class="sm muted" style="margin:var(--s-sm) 0 0" data-roles="SiteAdmin">Commenting is available through <b>View as&hellip;</b> &mdash; a Site Admin is not a member of this organization, so a comment is posted as one of its users.</p>
        </div>
        <div class="dz" data-roles="OrgAdmin" style="margin-top:0">
          <div class="sec-t">Danger zone</div>
          <p class="sm muted" style="margin:0 0 var(--s-xs)">Delete this idea? This can&rsquo;t be undone. The board updates immediately.</p>
          <button class="btn warn sm2">Delete idea</button>
        </div>
      </div>
    </div>
    <div class="insp-foot">
      <button class="btn pri" style="flex:1;justify-content:center" data-roles="OrgAdmin User" data-when="normal empty">Edit idea</button>
      <span class="deniedwrap" data-roles="SiteAdmin" data-when="normal empty" style="flex:1"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-ie-sa">Edit idea</button><span class="denied" id="p-why-ie-sa">Act as a member to edit</span></span>
      <span class="deniedwrap" data-roles="ReadOnly" data-when="normal empty" style="flex:1"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-ie-ro">Edit idea</button><span class="denied" id="p-why-ie-ro">Read-only account</span></span>
      <button class="btn" data-go="s-ideas">Close</button>
    </div>
  </aside>
</div></section>

<!-- ==================== NEW IDEA (docked) ==================== -->

<section class="screen" id="s-create" data-on="0">
  <div class="shell insp" data-roles="OrgAdmin User">
@@DESK:boards@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-boards">Boards</a> / <b>Ideas</b></span><span class="spacer"></span>
      <div class="seg" role="group" aria-label="View"><button aria-pressed="false" data-go="s-ideas">List</button><button aria-pressed="true">Lanes</button></div></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Ideas</h1>
        <div class="sub">The board stays where it is while the idea is written on the right. When it is saved, the card appears in New / Pending and the column closes.</div></div></div>
      <div class="lanes" aria-hidden="true">
        <div class="lane"><div class="lanehd"><span class="dot" style="background:var(--sky)"></span><span class="t">New / Pending</span><span class="ct num">3</span></div>
          <div class="kcard"><span class="t">Standardize the intake checklist</span><div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>High</span></div></div>
          <div class="kcard"><span class="t">Add proactive alerts</span><div class="ft"><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></div></div>
          <div class="emptylane">New idea lands here</div></div>
        <div class="lane"><div class="lanehd"><span class="dot" style="background:var(--purple)"></span><span class="t">In Review</span><span class="ct num">2</span></div>
          <div class="kcard"><span class="t">Improve exception visibility</span><div class="ft"><span class="marker"><span class="dot"></span>Low</span></div></div></div>
      </div>
      <div class="note"><b>Docked create, three ways in.</b> The same column opens from <em>New idea</em>, from a lane&rsquo;s <em>+ Add idea</em>, and from the brainstorm chat&rsquo;s <em>Continue</em>. Only the last arrives with suggestions: the teal <em>Suggested</em> chip, tinted field and 3px left border mark a value the assistant proposed and nothing else, and each is an editable default rather than a decision. Switch the state control to <b>empty</b> to see the form opened directly when the assistant is unavailable &mdash; the flash is informational, names no cause, and never blocks the form.</div>
    </div>
  </div>
  <aside class="inspector" aria-label="New idea">
    <div class="insp-head">
      <div class="eyebrow">New idea</div>
      <h2>Create an idea</h2>
      <div class="meta">Ideas board &middot; Acme Robotics</div>
    </div>
    <div class="insp-body" style="gap:0">
      <div class="authnote" role="status" data-when="empty"><span>AI assist is currently unavailable. Fill in the idea manually &mdash; nothing else changes.</span></div>
      <div class="alert" role="alert" data-when="error"><span><b>A title is required.</b> Idea Type and Business Impact are required too; everything else can wait.</span></div>
      <div data-when="loading" aria-busy="true"><p class="sm muted" style="margin:0 0 var(--s-sm)">Loading&hellip;</p><span class="skel w60"></span><span class="skel w80"></span><span class="skel w40"></span></div>
      <form data-when="normal empty error">
        <div class="field" data-when="normal">
          <label for="p-ct">Title <span class="req">*</span><span class="sugchip">Suggested</span><button type="button" class="sug-clear">clear</button></label>
          <input type="text" id="p-ct" class="sug-input" maxlength="150" value="Automate the weekly Ops summary">
          <div class="charcount">31 / 150</div>
        </div>
        <div class="field" data-when="empty">
          <label for="p-ct-e">Title <span class="req">*</span></label>
          <input type="text" id="p-ct-e" maxlength="150" placeholder="What's the idea?">
          <div class="charcount">0 / 150</div>
        </div>
        <div class="field bad" data-when="error">
          <label for="p-ct-x">Title <span class="req">*</span></label>
          <input type="text" id="p-ct-x" maxlength="150" placeholder="What's the idea?" aria-describedby="p-ct-msg">
          <span class="msg" id="p-ct-msg">A title is required.</span>
        </div>
        <div class="field" data-when="normal">
          <label for="p-cd">Description <span class="req">*</span><span class="sugchip">Suggested</span><button type="button" class="sug-clear">clear</button></label>
          <textarea id="p-cd" class="sug-input" rows="4" maxlength="4000">Coordinators rebuild the same weekly summary by hand every Friday. Generating it from the data we already hold removes roughly three hours a week for Ops and the transcription errors that come with it.</textarea>
          <div class="hint">Type an email with @ to notify that person.</div>
          <div class="charcount">198 / 4000</div>
        </div>
        <div class="field" data-when="empty error">
          <label for="p-cd-e">Description <span class="req">*</span></label>
          <textarea id="p-cd-e" rows="4" maxlength="4000" placeholder="Add context, motivation, or details…"></textarea>
          <div class="hint">Type an email with @ to notify that person.</div>
          <div class="charcount">0 / 4000</div>
        </div>
        <div class="field">
          <label for="p-ctype">Idea type <span class="req">*</span><span class="sugchip" data-when="normal">Suggested</span></label>
          <select id="p-ctype" class="sug-input" data-when="normal"><option>Continuous Improvement</option><option selected>Process Revision</option></select>
          <select id="p-ctype-e" aria-label="Idea type" data-when="empty error"><option selected>Continuous Improvement</option><option>Process Revision</option></select>
          <div class="hint">Set at creation and immutable after. It decides which custom fields appear below.</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-sm)">
          <div class="field">
            <label for="p-cimp">Business impact <span class="req">*</span><span class="sugchip" data-when="normal">Suggested</span></label>
            <select id="p-cimp" class="sug-input" data-when="normal"><option>Critical</option><option selected>High</option><option>Medium</option><option>Low</option></select>
            <select id="p-cimp-e" aria-label="Business impact" data-when="empty error"><option>Critical</option><option>High</option><option selected>Medium</option><option>Low</option></select>
          </div>
          <div class="field">
            <label for="p-cpri">Priority<span class="sugchip" data-when="normal">Suggested</span></label>
            <select id="p-cpri" class="sug-input" data-when="normal"><option>Critical</option><option selected>High</option><option>Medium</option><option>Low</option></select>
            <select id="p-cpri-e" aria-label="Priority" data-when="empty error"><option>Critical</option><option>High</option><option selected>Medium</option><option>Low</option></select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-sm)">
          <div class="field"><label for="p-cst">Status</label><select id="p-cst"><option selected>New / Pending</option><option>In Review</option><option>In Progress</option><option>Client Review</option><option>Complete</option></select></div>
          <div class="field"><label for="p-cdue">Due date</label><input type="text" id="p-cdue" placeholder="YYYY-MM-DD"></div>
        </div>
        <div class="field">
          <label for="p-cas">Assigned to <span class="faint">(1 / 5)</span></label>
          <div class="chips"><span class="chip"><span class="av s" style="width:18px;height:18px;font-size:8px">MG</span>Marcus Green<button type="button" aria-label="Remove assignee Marcus Green">&times;</button></span></div>
          <select id="p-cas"><option>Add assignee&hellip;</option><option>Maya Collaborator</option><option>Noah Contributor</option><option>Olivia Administer</option><option>Umar Mensah</option></select>
        </div>
        <div class="field">
          <label for="p-ctag">Tags <span class="faint">(2 / 10)</span></label>
          <div class="chips"><span class="chip">quality<button type="button" aria-label="Remove tag quality">&times;</button></span><span class="chip">safety<button type="button" aria-label="Remove tag safety">&times;</button></span></div>
          <div style="display:flex;gap:var(--s-xs)"><input type="text" id="p-ctag" placeholder="Add a tag" style="flex:1"><button type="button" class="btn">Add</button></div>
          <div class="hint">Autocomplete starts at two characters; Enter or a comma adds one.</div>
        </div>
        <div class="sec-t" style="margin-top:var(--s-sm)">Custom fields</div>
        <div class="field"><label for="p-cf-sav">Estimated savings <span class="req" title="Required">*</span></label><input type="text" inputmode="numeric" id="p-cf-sav" placeholder="Per year, in dollars"><div class="hint">Required for Process Revision.</div></div>
        <div class="field"><label for="p-cf-reg">Region</label><select id="p-cf-reg"><option value="">&mdash; Select &mdash;</option><option>EMEA</option><option>Americas</option><option>APAC</option></select></div>
        <div class="field"><label class="chk" for="p-cf-ven" style="display:inline-flex"><input type="checkbox" id="p-cf-ven">Needs vendor &mdash; Yes</label></div>
      </form>
    </div>
    <div class="insp-foot">
      <button class="btn pri" style="flex:1;justify-content:center" data-when="normal empty error" data-go="s-board">Create idea</button>
      <button class="btn pri" style="flex:1;justify-content:center" aria-disabled="true" aria-busy="true" data-when="loading">Creating&hellip;</button>
      <button class="btn" data-go="s-board">Cancel</button>
    </div>
  </aside>
  </div>
  <div class="shell" data-roles="SiteAdmin ReadOnly">
@@DESK:boards@@
    <div class="main">
      <div class="topbar"><span class="crumb"><a href="#" data-go="s-boards">Boards</a> / <b>Ideas</b></span></div>
      <div class="work">
        <div class="pgh"><div class="grow"><h1>Not available</h1><div class="sub">Creating an idea is a member&rsquo;s action.</div></div></div>
        <div class="empty">
          <h3 data-roles="SiteAdmin">A Site Admin does not raise ideas directly</h3>
          <p data-roles="SiteAdmin">Ideas are organization content. Use <b>View As</b> to act as a member of Acme Robotics and this form opens as normal.</p>
          <h3 data-roles="ReadOnly">Read-only accounts cannot create ideas</h3>
          <p data-roles="ReadOnly">You can read every idea, vote on it and join its discussion, and raise none. Ask an administrator to change your role if that is wrong.</p>
          <a class="btn" href="#" data-go="s-board">Back to the board</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ==================== BRAINSTORM CHAT ==================== -->

<section class="screen" id="s-brainstorm" data-on="0">
  <div data-roles="OrgAdmin User">
  <div class="shell" style="filter:blur(1.5px);opacity:.6" aria-hidden="true">
@@DESK:boards@@
    <div class="main"><div class="topbar"><span class="crumb">Boards / <b>Ideas</b></span></div>
      <div class="work"><div class="pgh"><h1>Ideas</h1></div><div class="lanes"><div class="lane" style="height:320px"></div><div class="lane" style="height:320px"></div><div class="lane" style="height:320px"></div></div></div></div>
  </div>
  <div class="cp-back">
    <div class="chatm" role="dialog" aria-modal="true" aria-labelledby="p-bs-title">
      <div class="insp-head">
        <div class="eyebrow">New idea</div>
        <h2 id="p-bs-title">Let&rsquo;s flesh out your idea</h2>
        <div class="meta">Chat it out &mdash; what you say becomes the idea.</div>
      </div>
      <div class="chat" aria-live="polite">
        <div class="bub ai"><div class="who">AI</div>Hi! Tell me about your idea in your own words. What are you trying to build or improve?</div>
        <div class="bub me" data-when="normal loading error"><div class="who">You</div>Coordinators rebuild the same weekly summary by hand every Friday. It takes each of them about three hours.</div>
        <div class="bub ai" data-when="normal loading error"><div class="who">AI</div>Nice &mdash; what problem does this solve, and who feels it most? Is it the time, the errors, or both?</div>
        <div class="bub me" data-when="normal"><div class="who">You</div>Both. Ops feels it most; the numbers get retyped and the errors show up in the Monday review.</div>
        <div class="bub ai" data-when="normal"><div class="who">AI</div>Got it. How would you know this idea succeeded? What would change?</div>
        <div class="bub me ghost" data-when="error"><div class="who">You</div>What&rsquo;s a good lasagna recipe?</div>
        <div class="sysnote" data-when="error"><b>That one&rsquo;s outside what I can help with here.</b> Let&rsquo;s keep to process ideas for Acme Robotics. That message wasn&rsquo;t added to the conversation. Repeated off-topic messages will end the chat.</div>
        <div class="bub ai" data-when="loading"><div class="who">AI</div><span class="thinking" aria-label="Thinking"><i></i><i></i><i></i></span></div>
      </div>
      <div class="strip">
        <span class="lead">Drafting</span>
        <span data-when="empty">Nothing classified yet</span>
        <span data-when="normal loading error">Type <b>Process Revision</b></span>
        <span data-when="normal loading error">Impact <b>High</b></span>
        <span data-when="normal loading error">Priority not set yet</span>
        <span class="faint" data-when="normal loading">just now</span>
        <span class="faint" data-when="error">unchanged</span>
      </div>
      <div class="composer">
        <label for="p-bs-in" class="vh">Your message</label>
        <textarea id="p-bs-in" rows="2" placeholder="Describe your idea… (Enter to send, Shift+Enter for a new line)"></textarea>
        <button class="btn pri" type="button">Send</button>
      </div>
      <div class="chatfoot">
        <button class="btn" data-go="s-board">Cancel</button>
        <span class="spacer"></span>
        <button class="btn" data-go="s-create" title="Skip the chat and fill the form yourself">Skip &amp; fill manually</button>
        <button class="btn pri" data-go="s-create" data-when="normal loading error">Continue to idea form &rarr;</button>
        <button class="btn pri" aria-disabled="true" aria-describedby="p-bs-why" data-when="empty">Continue to idea form &rarr;</button>
        <span class="denied vh" id="p-bs-why">Send at least one message first, or skip</span>
      </div>
    </div>
  </div>
  </div>
  <div class="shell" data-roles="SiteAdmin ReadOnly">
@@DESK:boards@@
    <div class="main">
      <div class="topbar"><span class="crumb"><a href="#" data-go="s-boards">Boards</a> / <b>Ideas</b></span></div>
      <div class="work">
        <div class="pgh"><div class="grow"><h1>Not available</h1><div class="sub">The idea assistant opens from New idea, which is a member&rsquo;s action.</div></div></div>
        <div class="empty">
          <h3>Nothing to brainstorm for this role</h3>
          <p data-roles="SiteAdmin">Use <b>View As</b> to act as a member of Acme Robotics; the assistant then opens from New idea as normal.</p>
          <p data-roles="ReadOnly">Read-only accounts cannot create ideas, so there is no draft to work on.</p>
          <a class="btn" href="#" data-go="s-board">Back to the board</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ==================== COMMAND PALETTE ==================== -->

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
      <div class="it"><span class="dot" style="background:var(--green)"></span>Standardize intake <span class="faint" style="font-weight:400">· 3 issues · 0 done</span></div>
      <div class="grp">Actions</div>
      <div class="it" data-roles="OrgAdmin User">Create idea &ldquo;intake&rdquo;<span class="kbd">Ctrl N</span></div>
      <div class="it" data-roles="OrgAdmin">Set the outcome for CLG-114…</div>
      <div class="it" data-roles="SiteAdmin OrgAdmin">View as another user…</div>
      <div class="cpfoot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> navigate</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">Esc</span> dismiss</span></div>
    </div>
  </div>
</section>

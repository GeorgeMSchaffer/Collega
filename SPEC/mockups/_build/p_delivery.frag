<!-- ==================== SPRINT BOARD ==================== -->

<section class="screen" id="s-sprint" data-on="0"><div class="shell">
@@DESK:sprint@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <b>Sprint board</b></span><span class="spacer"></span>
      <button class="btn" data-roles="OrgAdmin" data-go="s-backlog">Plan next sprint</button>
      <button class="btn" data-roles="OrgAdmin" data-when="normal">Complete sprint</button>
      <span class="deniedwrap" data-roles="SiteAdmin" data-when="normal">
        <button class="btn" aria-disabled="true" aria-describedby="p-why-sp-sa">Complete sprint</button>
        <span class="denied" id="p-why-sp-sa">Act as an Acme Robotics administrator to change this</span></span>
      <span class="deniedwrap" data-roles="User ReadOnly" data-when="normal">
        <button class="btn" aria-disabled="true" aria-describedby="p-why-sp-m">Complete sprint</button>
        <span class="denied" id="p-why-sp-m">Administrators only</span></span></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Sprint board</h1>
        <div class="sub">Issues committed to the running sprint, in five fixed delivery statuses. Move a card with drag, or change its status from the issue. Only the person who raised it, an assignee, or an administrator can move it.</div></div></div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Couldn&rsquo;t load the sprint.</b> Nothing has been changed. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>

      <div data-when="loading" aria-busy="true">
        <div class="card" style="margin-bottom:var(--s-md)"><span class="skel w40"></span><span class="skel w80" style="margin-top:10px"></span></div>
        <div class="lanes">
          <div class="lane"><div class="lanehd"><span class="skel w60"></span></div><div class="kcard"><span class="skel w80"></span><span class="skel w40"></span></div></div>
          <div class="lane"><div class="lanehd"><span class="skel w60"></span></div><div class="kcard"><span class="skel w80"></span><span class="skel w40"></span></div><div class="kcard"><span class="skel w60"></span><span class="skel w40"></span></div></div>
          <div class="lane"><div class="lanehd"><span class="skel w60"></span></div><div class="kcard"><span class="skel w80"></span><span class="skel w40"></span></div></div>
          <div class="lane"><div class="lanehd"><span class="skel w60"></span></div></div>
          <div class="lane"><div class="lanehd"><span class="skel w60"></span></div></div>
        </div>
      </div>

      <div data-when="empty">
        <div class="empty">
          <h3>No sprint is running</h3>
          <p>Acme Robotics has 7 issues in the delivery backlog and no active sprint. An administrator plans a sprint from the backlog, then starts it here.</p>
          <button class="btn pri" data-roles="OrgAdmin" data-go="s-backlog">Plan a sprint</button>
          <span class="deniedwrap" data-roles="SiteAdmin"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-sp-e-sa">Plan a sprint</button><span class="denied" id="p-why-sp-e-sa">Act as an Acme Robotics administrator to plan one</span></span>
          <span class="deniedwrap" data-roles="User ReadOnly"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-sp-e-m">Plan a sprint</button><span class="denied" id="p-why-sp-e-m">Administrators only</span></span>
          <div style="margin-top:var(--s-sm)"><a href="#" data-go="s-backlog">See the backlog</a></div>
        </div>
      </div>

      <div data-when="normal">
        <div class="sprintbar">
          <div class="grow"><div class="chipbar"><span class="title">Sprint 12</span><span class="marker"><span class="dot" style="background:var(--green)"></span>Active</span></div>
            <div class="goal">Goal &mdash; cut weekly reporting effort in half.</div></div>
          <div class="dates"><div class="num">18 Aug &ndash; 1 Sep 2026</div><div class="cap faint">6 issues &middot; 4 days left</div></div>
        </div>
        <div class="lanes">
          <div class="lane">
            <div class="lanehd"><span class="dot"></span><span class="t">Pending</span><span class="ct num">1</span></div>
            <div class="kcard"><span class="key">CLG-118</span><span class="t">Retire the legacy export step</span>
              <div class="ft"><span class="marker"><span class="dot"></span>Low effort</span><span class="spacer"></span><span class="av s">NC</span></div>
              <div class="tprog"><span class="num">Tasks 0 of 2</span><span class="tbar"><i style="width:0"></i></span></div></div>
          </div>
          <div class="lane">
            <div class="lanehd"><span class="dot" style="background:var(--purple)"></span><span class="t">Scoping</span><span class="ct num">1</span></div>
            <div class="kcard"><span class="key">CLG-121</span><span class="t">Standardize the intake checklist</span>
              <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High effort</span><span class="spacer"></span><span class="av s">MG</span></div>
              <div class="tprog"><span class="num">Tasks 1 of 5</span><span class="tbar"><i style="width:20%"></i></span></div></div>
          </div>
          <div class="lane">
            <div class="lanehd"><span class="dot" style="background:var(--sky)"></span><span class="t">Development</span><span class="ct num">2</span></div>
            <div class="kcard" data-go="s-issue"><span class="key">CLG-114</span><span class="t">Automate weekly reporting</span>
              <div class="ft"><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium effort</span><span class="spacer"></span><span class="avstack"><span class="av s">MG</span><span class="av s">OA</span></span></div>
              <div class="tprog"><span class="num">Tasks 3 of 5</span><span class="tbar"><i style="width:60%"></i></span></div></div>
            <div class="kcard"><span class="key">CLG-116</span><span class="t">Add proactive alerts</span>
              <div class="ft"><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium effort</span><span class="spacer"></span><span class="av s">NC</span></div>
              <div class="tprog"><span class="num">Tasks 2 of 4</span><span class="tbar"><i style="width:50%"></i></span></div></div>
          </div>
          <div class="lane">
            <div class="lanehd"><span class="dot" style="background:var(--pink)"></span><span class="t">Review</span><span class="ct num">1</span></div>
            <div class="kcard"><span class="key">CLG-109</span><span class="t">Create a shared playbook</span>
              <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High effort</span><span class="spacer"></span><span class="av s">OA</span></div>
              <div class="tprog"><span class="num">Tasks 4 of 4</span><span class="tbar"><i style="width:100%"></i></span></div></div>
          </div>
          <div class="lane">
            <div class="lanehd"><span class="dot" style="background:var(--green)"></span><span class="t">Complete</span><span class="ct num">1</span></div>
            <div class="kcard"><span class="key">CLG-120</span><span class="t">Document the alert thresholds</span>
              <div class="ft"><span class="marker"><span class="dot"></span>Low effort</span><span class="spacer"></span><span class="av s">NC</span></div>
              <div class="tprog"><span class="num">Tasks 3 of 3</span><span class="tbar"><i style="width:100%"></i></span></div></div>
          </div>
        </div>
      </div>

      <div class="note"><b>Fixed statuses, not swimlanes.</b> Pending, Scoping, Development, Review and Complete govern Delivery only and are not configurable, so this board never inherits the organization&rsquo;s ideation statuses. The rail is the same 288px-column rail as the ideas board, and the card is the same card carrying two more facts: an effort marker and a task count. A card&rsquo;s key never breaks across lines.</div>
    </div>
  </div>
</div></section>

<!-- ==================== BACKLOG & PLANNING ==================== -->

<section class="screen" id="s-backlog" data-on="0"><div class="shell">
@@DESK:backlog@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <b>Backlog</b></span><span class="spacer"></span>
      <button class="btn" data-roles="OrgAdmin">New sprint</button>
      <button class="btn pri" data-roles="OrgAdmin" data-when="normal">Start Sprint 13</button>
      <span class="deniedwrap" data-roles="SiteAdmin" data-when="normal">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-bl-sa">Start Sprint 13</button>
        <span class="denied" id="p-why-bl-sa">Act as an Acme Robotics administrator to change this</span></span>
      <span class="deniedwrap" data-roles="User ReadOnly" data-when="normal">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-bl-m">Start Sprint 13</button>
        <span class="denied" id="p-why-bl-m">Administrators only</span></span></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Backlog</h1>
        <div class="sub">Issues that are committed but not yet in a sprint. Most upvoted first, so the list reads as the organization&rsquo;s own priority order. Assigning a sprint here moves the row; it is still the same idea, still carrying its history.</div></div></div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Couldn&rsquo;t load the backlog.</b> Nothing has been changed. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>

      <div data-when="loading" aria-busy="true" class="cols">
        <div class="panel"><div class="in"><span class="skel w80"></span><span class="skel w60"></span><span class="skel w80"></span><span class="skel w40"></span></div></div>
        <div class="card"><span class="skel w40"></span><span class="skel w80" style="margin-top:10px"></span></div>
      </div>

      <div data-when="empty">
        <div class="empty">
          <h3>Nothing waiting</h3>
          <p>Every committed issue is in a sprint. New issues arrive here when an idea is promoted from a board.</p>
          <a class="btn" href="comp-p-focus-roadmap.html#s-board">Open the ideas board</a>
        </div>
      </div>

      <div data-when="normal">
        <div class="panel" style="margin-bottom:var(--s-md)">
          <h2><span class="grow">Delivery backlog</span><span class="cap faint" style="font-weight:400">7 issues</span></h2>
          <table>
            <thead><tr><th style="width:96px">Key</th><th>Issue</th><th style="width:140px">Effort</th><th style="width:72px">Votes</th><th style="width:180px">Sprint</th></tr></thead>
            <tbody>
              <tr><td><span class="key">CLG-127</span></td><td><a class="t" href="#">Pilot a faster review path</a><div class="bd">Raised by Maya Collaborator</div></td><td><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span></td><td class="num">21</td>
                <td><select aria-label="Sprint for CLG-127" data-roles="OrgAdmin"><option selected>Sprint 13</option><option>&mdash; backlog</option></select><span data-roles="SiteAdmin User ReadOnly">Sprint 13</span></td></tr>
              <tr><td><span class="key">CLG-130</span></td><td><a class="t" href="#">Validate the customer feedback loop</a><div class="bd">Raised by Noah Contributor</div></td><td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td><td class="num">12</td>
                <td><select aria-label="Sprint for CLG-130" data-roles="OrgAdmin"><option selected>&mdash; backlog</option><option>Sprint 13</option></select><span class="faint" data-roles="SiteAdmin User ReadOnly">&mdash;</span></td></tr>
              <tr><td><span class="key">CLG-122</span></td><td><a class="t" href="#">Reduce manual handoffs</a><div class="bd">Raised by Umar Mensah</div></td><td><span class="marker"><span class="dot"></span>Low</span></td><td class="num">9</td>
                <td><select aria-label="Sprint for CLG-122" data-roles="OrgAdmin"><option selected>&mdash; backlog</option><option>Sprint 13</option></select><span class="faint" data-roles="SiteAdmin User ReadOnly">&mdash;</span></td></tr>
              <tr><td><span class="key">CLG-125</span></td><td><a class="t" href="#">Improve exception visibility</a><div class="bd">Raised by Noah Contributor</div></td><td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td><td class="num">6</td>
                <td><select aria-label="Sprint for CLG-125" data-roles="OrgAdmin"><option selected>&mdash; backlog</option><option>Sprint 13</option></select><span class="faint" data-roles="SiteAdmin User ReadOnly">&mdash;</span></td></tr>
              <tr><td><span class="key">CLG-131</span></td><td><a class="t" href="#">Roll out the proven workflow</a><div class="bd">Raised by Maya Collaborator</div></td><td><span class="marker"><span class="dot"></span>Low</span></td><td class="num">4</td>
                <td><select aria-label="Sprint for CLG-131" data-roles="OrgAdmin"><option selected>&mdash; backlog</option><option>Sprint 13</option></select><span class="faint" data-roles="SiteAdmin User ReadOnly">&mdash;</span></td></tr>
              <tr><td><span class="key">CLG-133</span></td><td><a class="t" href="#">Measure time saved per team</a><div class="bd">Raised by Olivia Administer</div></td><td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td><td class="num">3</td>
                <td><select aria-label="Sprint for CLG-133" data-roles="OrgAdmin"><option selected>&mdash; backlog</option><option>Sprint 13</option></select><span class="faint" data-roles="SiteAdmin User ReadOnly">&mdash;</span></td></tr>
              <tr><td><span class="key">CLG-134</span></td><td><a class="t" href="#">Archive the spreadsheet tracker</a><div class="bd">Raised by Umar Mensah</div></td><td><span class="marker"><span class="dot"></span>Low</span></td><td class="num">2</td>
                <td><select aria-label="Sprint for CLG-134" data-roles="OrgAdmin"><option selected>&mdash; backlog</option><option>Sprint 13</option></select><span class="faint" data-roles="SiteAdmin User ReadOnly">&mdash;</span></td></tr>
            </tbody>
          </table>
        </div>
        <div class="cols" style="grid-template-columns:1fr 1fr">
          <div class="card">
            <div class="chipbar" style="margin-bottom:6px"><span class="title">Sprint 13</span><span class="marker"><span class="dot"></span>Planned</span></div>
            <div class="sub" style="margin-bottom:var(--s-md)">1 issue assigned &middot; High effort &times;1. Starting a sprint is an action, never derived from its dates.</div>
            <form data-roles="OrgAdmin">
              <div class="field"><label for="p-sp-goal">Goal</label><textarea id="p-sp-goal" rows="2">Make the review path measurably faster end to end.</textarea></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-md)">
                <div class="field"><label for="p-sp-start">Starts</label><input type="text" id="p-sp-start" value="2026-09-01" inputmode="numeric"></div>
                <div class="field"><label for="p-sp-end">Ends</label><input type="text" id="p-sp-end" value="2026-09-15" inputmode="numeric">
                  <div class="hint">On or after the start date.</div></div>
              </div>
              <div class="field"><label for="p-sp-owner">Owner <span class="faint">(optional)</span></label>
                <select id="p-sp-owner"><option>Unassigned</option><option selected>Olivia Administer</option><option>Maya Collaborator</option></select></div>
              <button type="submit" class="btn">Save sprint</button>
            </form>
            <dl class="kv" data-roles="SiteAdmin User ReadOnly">
              <dt>Goal</dt><dd>Make the review path measurably faster end to end.</dd>
              <dt>Window</dt><dd class="num">1 &ndash; 15 Sep 2026</dd>
              <dt>Owner</dt><dd>Olivia Administer</dd>
            </dl>
          </div>
          <div class="card">
            <div class="title" style="margin-bottom:6px">Sprint lifecycle</div>
            <div class="chipbar" style="margin-bottom:var(--s-sm)"><span class="marker"><span class="dot"></span>Planned</span><span class="faint">&rarr;</span><span class="marker"><span class="dot" style="background:var(--green)"></span>Active</span><span class="faint">&rarr;</span><span class="marker"><span class="dot" style="background:var(--ink)"></span>Completed</span></div>
            <p class="sm sec" style="margin:0">Completing a sprint returns every unfinished issue to this backlog. Nothing is deleted, and an issue&rsquo;s tasks travel with it.</p>
          </div>
        </div>
      </div>

      <div class="note"><b>Assign in place.</b> The sprint column is a control for an administrator and a value for everyone else, which is why the same row reads differently under the role control. A member never sees a disabled select here: the backlog is a list they consult, not a screen they act on, so the control is absent rather than refused.</div>
    </div>
  </div>
</div></section>

<!-- ==================== ISSUE ==================== -->

<section class="screen" id="s-issue" data-on="0"><div class="shell">
@@DESK:sprint@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <a href="#" data-go="s-sprint">Sprint 12</a> / <b>CLG-114</b></span><span class="spacer"></span>
      <button class="btn" data-go="s-sprint">Back to board</button>
      <button class="btn pri" data-roles="OrgAdmin" data-when="normal empty">Save</button>
      <span class="deniedwrap" data-roles="SiteAdmin" data-when="normal empty">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-is-sa">Save</button>
        <span class="denied" id="p-why-is-sa">Act as an Acme Robotics administrator to change this</span></span>
      <span class="deniedwrap" data-roles="User ReadOnly" data-when="normal empty">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-is-m">Save</button>
        <span class="denied" id="p-why-is-m">Only the person who raised it, an assignee, or an administrator</span></span></div>
    <div class="work">
      <div class="pgh"><div class="grow">
        <div class="chipbar" style="margin-bottom:var(--s-sm)"><span class="key">CLG-114</span>
          <span class="marker"><span class="dot" style="background:var(--sky)"></span>Delivery</span>
          <span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium effort</span></div>
        <h1>Automate weekly reporting</h1>
        <div class="sub">Development &middot; Sprint 12 &middot; assigned to Marcus Green and Olivia Administer</div></div></div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Couldn&rsquo;t load this issue.</b> Nothing has been changed. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>

      <div data-when="loading" aria-busy="true" class="cols">
        <div class="panel"><div class="in"><span class="skel w80"></span><span class="skel w60"></span><span class="skel w80"></span></div></div>
        <div class="panel"><div class="in"><span class="skel w40"></span><span class="skel w60"></span></div></div>
      </div>

      <div data-when="normal empty" class="cols">
        <div>
          <div class="panel" style="margin-bottom:var(--s-md)">
            <h2>Description</h2>
            <div class="in"><p class="prose" style="margin:0">Coordinators rebuild the same weekly summary by hand every Friday. Generating it from the data we already hold removes roughly three hours a week and the transcription errors that come with it.</p></div>
          </div>

          <div class="panel" style="margin-bottom:var(--s-md)">
            <h2><span class="grow">Tasks</span><span class="cap faint" style="font-weight:400" data-when="normal">3 of 5 done</span><span class="cap faint" style="font-weight:400" data-when="empty">0 of 0 done</span></h2>
            <div class="lede">The steps that finish this issue, in order. Ticking every box does not complete the issue and an open box does not block it &mdash; the checklist informs the standup, it never gates the board.</div>
            <div class="in" data-when="empty">
              <p class="sm muted" style="margin:0 0 var(--s-sm)">No tasks yet. Break the work into the steps a standup would ask about.</p>
              <button class="addtask" data-roles="OrgAdmin">+ Add task</button>
              <span class="deniedwrap" data-roles="SiteAdmin" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px"><button class="addtask" aria-disabled="true" aria-describedby="p-why-t-e-sa">+ Add task</button><span class="denied" id="p-why-t-e-sa">Act as an Acme Robotics administrator to change this</span></span>
              <span class="deniedwrap" data-roles="User ReadOnly" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px"><button class="addtask" aria-disabled="true" aria-describedby="p-why-t-e">+ Add task</button><span class="denied" id="p-why-t-e">Only the person who raised it, an assignee, or an administrator</span></span>
            </div>
            <div class="in" data-when="normal">
              <div class="task done"><select class="tstate" aria-label="State of: Agree the report's column set with Ops" data-roles="OrgAdmin"><option>Not started</option><option>In progress</option><option selected>Done</option></select><span class="tstate ro" data-roles="SiteAdmin User ReadOnly">Done</span><div class="grow"><span>Agree the report&rsquo;s column set with Ops</span><div class="who">Marcus Green &middot; done 24 Aug</div></div></div>
              <div class="task done"><select class="tstate" aria-label="State of: Build the extract query" data-roles="OrgAdmin"><option>Not started</option><option>In progress</option><option selected>Done</option></select><span class="tstate ro" data-roles="SiteAdmin User ReadOnly">Done</span><div class="grow"><span>Build the extract query</span><div class="who">Marcus Green &middot; done 26 Aug</div></div></div>
              <div class="task done"><select class="tstate" aria-label="State of: Schedule the Friday 06:00 run" data-roles="OrgAdmin"><option>Not started</option><option>In progress</option><option selected>Done</option></select><span class="tstate ro" data-roles="SiteAdmin User ReadOnly">Done</span><div class="grow"><span>Schedule the Friday 06:00 run</span><div class="who">Olivia Administer &middot; done 28 Aug</div></div></div>
              <div class="task"><select class="tstate" aria-label="State of: Handle the empty-week edge case" data-roles="OrgAdmin"><option>Not started</option><option selected>In progress</option><option>Done</option></select><span class="tstate ro" data-roles="SiteAdmin User ReadOnly">In progress</span><div class="grow"><span>Handle the empty-week edge case</span><div class="who">Marcus Green &middot; in progress</div></div></div>
              <div class="task"><select class="tstate" aria-label="State of: Write the one-page runbook" data-roles="OrgAdmin"><option selected>Not started</option><option>In progress</option><option>Done</option></select><span class="tstate ro" data-roles="SiteAdmin User ReadOnly">Not started</span><div class="grow"><span>Write the one-page runbook</span><div class="who">Unassigned &middot; any active member can take it</div></div></div>
              <button class="addtask" data-roles="OrgAdmin">+ Add task</button>
              <span class="deniedwrap" data-roles="SiteAdmin" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px"><button class="addtask" aria-disabled="true" aria-describedby="p-why-t-n-sa">+ Add task</button><span class="denied" id="p-why-t-n-sa">Act as an Acme Robotics administrator to change this</span></span>
              <span class="deniedwrap" data-roles="User ReadOnly" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px"><button class="addtask" aria-disabled="true" aria-describedby="p-why-t-n">+ Add task</button><span class="denied" id="p-why-t-n">Only the person who raised it, an assignee, or an administrator</span></span>
            </div>
          </div>

          <div class="panel">
            <h2><span class="grow">Discussion</span><span class="cap faint" style="font-weight:400">9 comments &middot; from the original idea</span></h2>
            <div class="lede">The debate that led to the commitment, unchanged. Newest last.</div>
            <div class="in">
              <div class="cmt" style="border-top:0;padding-top:0"><span class="av s">MG</span><div><div class="who">Marcus Green <span class="when">14 Jul</span></div><p>Three hours every Friday, every coordinator. If we generate it from what we already store, the errors go too.</p></div></div>
              <div class="cmt"><span class="av s">MC</span><div><div class="who">Maya Collaborator <span class="when">16 Jul</span></div><p>Ops will want the same column set they have now, at least for the first quarter. Worth agreeing that before anything is built.</p></div></div>
              <div class="cmt"><span class="av s">OA</span><div><div class="who">Olivia Administer <span class="when">18 Aug</span></div><p>Promoting this &mdash; 14 votes and a clear scope. Marcus, it&rsquo;s yours.</p></div></div>
              <div class="field" style="margin:var(--s-sm) 0 0" data-roles="OrgAdmin User">
                <label for="p-is-cmt">Add a comment</label>
                <textarea id="p-is-cmt" rows="2" placeholder="Write a comment&hellip;"></textarea>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="panel" style="margin-bottom:var(--s-md)">
            <h2>Delivery</h2>
            <div class="in">
              <dl class="kv">
                <dt>Status</dt><dd><select aria-label="Delivery status" style="width:auto" data-roles="OrgAdmin"><option>Pending</option><option>Scoping</option><option selected>Development</option><option>Review</option><option>Complete</option></select><span data-roles="SiteAdmin User ReadOnly"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Development</span></span></dd>
                <dt>Sprint</dt><dd>Sprint 12 <span class="marker"><span class="dot" style="background:var(--green)"></span>Active</span></dd>
                <dt>Effort</dt><dd><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></dd>
                <dt>Assigned</dt><dd><span class="avstack" style="display:inline-flex;vertical-align:middle"><span class="av s">MG</span><span class="av s">OA</span></span> Marcus, Olivia</dd>
                <dt>Outcome</dt><dd><span class="rmtag"><span class="dot" style="background:var(--sky)"></span>Cut reporting effort</span> <button class="btn sm2" data-roles="OrgAdmin" data-go="s-group" style="margin-left:6px">Change</button></dd>
              </dl>
            </div>
          </div>

          <div class="panel" style="margin-bottom:var(--s-md)">
            <h2>Provenance</h2>
            <div class="lede">Where this work came from. Nothing here is retyped; it is the idea&rsquo;s own record.</div>
            <div class="in">
              <p class="sm sec" style="margin:0 0 var(--s-sm)">Originated as an idea by <b>Marcus Green</b> on <b>14 Jul 2026</b> &middot; <b>14</b> upvotes at promotion (<b>17</b> now) &middot; promoted by <b>Olivia Administer</b> on <b>18 Aug 2026</b>.</p>
              <dl class="kv">
                <dt>Type</dt><dd><span class="marker"><span class="dot" style="background:var(--purple)"></span>Process Revision</span></dd>
                <dt>Impact</dt><dd><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span></dd>
                <dt>Idea status</dt><dd><span class="marker"><span class="dot" style="background:var(--orange)"></span>In Progress</span> <span class="cap faint">kept for history</span></dd>
                <dt>Tags</dt><dd><span class="tagrow"><span class="tag">quality</span><span class="tag">safety</span></span></dd>
              </dl>
            </div>
          </div>

          <div class="card" data-roles="OrgAdmin">
            <div class="title" style="margin-bottom:4px">Return to discovery</div>
            <p class="sm muted" style="margin:0 0 var(--s-sm)">Undo a mistaken promotion. The issue leaves its sprint and goes back to the Ideas board; its effort, tasks and the promotion record are kept so promoting it again loses nothing.</p>
            <button class="btn warn">Return to discovery</button>
          </div>
        </div>
      </div>

      <div class="note"><b>One outcome, the same weight as Sprint.</b> Under single-parent the Outcome field reads exactly like the Sprint field above it: one value, changed by picking another. There is no chip list and no count to reconcile, because an issue has one home. The provenance sentence is written to ship as-is; it is the reason this feature exists.</div>
    </div>
  </div>
</div></section>

<!-- ==================== PROMOTE GATE ==================== -->

<section class="screen" id="s-promote" data-on="0">
  <div class="shell insp" style="filter:blur(1.5px);opacity:.6" aria-hidden="true">
@@DESK:boards@@
    <div class="main"><div class="topbar"><span class="crumb"><a href="#">Boards</a> / <b>Ideas</b></span></div>
      <div class="work"><div class="pgh"><h1>Ideas</h1></div><div class="panel" style="height:300px"></div></div></div>
    <aside class="inspector" aria-hidden="true"><div class="insp-head"><div class="eyebrow">Ideas board &middot; #IDEA-118</div><h2>Standardize the intake checklist</h2></div></aside>
  </div>
  <div class="cp-back">
    <div class="gate" role="dialog" aria-modal="true" aria-labelledby="p-pr-title" data-roles="OrgAdmin">
      <div class="insp-head" style="padding-left:0;padding-right:0">
        <div class="eyebrow">Decision gate</div>
        <h2 id="p-pr-title">Promote to issue</h2>
        <div class="meta">Standardize the intake checklist &middot; <span class="marker"><span class="dot"></span>Discovery</span> &rarr; <span class="marker"><span class="dot" style="background:var(--sky)"></span>Delivery</span></div>
      </div>
      <form>
        <p class="sm sec" style="margin:var(--s-md) 0">This is the same idea, not a copy. It keeps Noah Contributor as its proposer, its 12 upvotes, its business impact and every comment. It leaves the Ideas board and appears in the delivery backlog, or in the sprint you choose.</p>
        <fieldset class="field" style="border:0;padding:0;margin:0 0 var(--s-md)">
          <legend class="lbl">Effort <span class="req">*</span></legend>
          <div class="radioset">
            <label><input type="radio" name="p-eff">Low</label>
            <label><input type="radio" name="p-eff" checked>Medium</label>
            <label><input type="radio" name="p-eff">High</label>
          </div>
          <div class="hint">A size, not an estimate. Required to commit.</div>
        </fieldset>
        <div class="field"><label for="p-pr-sprint">Sprint</label>
          <select id="p-pr-sprint"><option selected>Delivery backlog &mdash; no sprint yet</option><option>Sprint 12 &middot; active</option><option>Sprint 13 &middot; planned</option></select>
          <div class="hint">Optional. An issue with no sprint waits in the backlog.</div></div>
        <div class="field"><label for="p-pr-note">Note <span class="faint">(optional)</span></label>
          <textarea id="p-pr-note" rows="2" placeholder="Why now, or what to watch for&hellip;"></textarea></div>
        <dl class="kv" style="margin-bottom:var(--s-md)">
          <dt>Recorded</dt><dd class="sm">Promoted by Olivia Administer &middot; today &middot; 12 upvotes at promotion &middot; idea status In Review, kept</dd>
        </dl>
        <div style="display:flex;gap:var(--s-xs);justify-content:flex-end;align-items:center">
          <span class="cap faint grow">Written to the audit log.</span>
          <button type="button" class="btn" data-go="s-sprint">Cancel</button>
          <button type="submit" class="btn pri" data-go="s-sprint">Promote to issue</button>
        </div>
      </form>
    </div>
    <div class="gate" role="dialog" aria-modal="true" aria-labelledby="p-pr-no" data-roles="SiteAdmin User ReadOnly">
      <div class="insp-head" style="padding-left:0;padding-right:0">
        <div class="eyebrow">Decision gate</div>
        <h2 id="p-pr-no">Promote to issue</h2>
        <div class="meta">Standardize the intake checklist</div>
      </div>
      <div class="empty" style="margin-top:var(--s-md)">
        <h3 data-roles="SiteAdmin">A Site Admin does not promote directly</h3>
        <p data-roles="SiteAdmin">Committing an organization&rsquo;s idea to delivery is organization content. Use <b>View As</b> to act as an Acme Robotics administrator, and this gate opens.</p>
        <h3 data-roles="User">Only the person who raised it can promote it</h3>
        <p data-roles="User">Noah Contributor raised this idea. You can promote your own ideas; for someone else&rsquo;s, ask an administrator.</p>
        <h3 data-roles="ReadOnly">Read-only accounts cannot promote</h3>
        <p data-roles="ReadOnly">You can read every idea and issue in Acme Robotics, and change none of them.</p>
        <button class="btn" data-go="s-sprint">Close</button>
      </div>
    </div>
  </div>
</section>

<!-- ==================== ROADMAP ==================== -->

<section class="screen" id="s-roadmap" data-on="0"><div class="shell">
@@DESK:roadmap@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <b>Roadmap</b></span><span class="spacer"></span>
      <div class="seg" role="group" aria-label="Time axis" data-when="normal"><button aria-pressed="true">Quarters</button><button aria-pressed="false">Sprints</button></div>
      <button class="btn pri" data-roles="OrgAdmin">Add outcome</button>
      <span class="deniedwrap" data-roles="SiteAdmin">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-rm-sa">Add outcome</button>
        <span class="denied" id="p-why-rm-sa">Act as an Acme Robotics administrator to change this</span></span>
      <span class="deniedwrap" data-roles="User ReadOnly">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-rm-m">Add outcome</button>
        <span class="denied" id="p-why-rm-m">Administrators only</span></span></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Roadmap</h1>
        <div class="sub">What the quarter is for. Each outcome groups the issues that serve it; an issue sits under one outcome, so every count here is a plain count and the rows add up to the delivery set.</div></div></div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Couldn&rsquo;t load the roadmap.</b> Nothing has been changed. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>

      <div data-when="loading" aria-busy="true">
        <div class="kpis"><div class="kpi"><span class="skel w40"></span><span class="skel w60" style="margin-top:14px"></span></div><div class="kpi"><span class="skel w40"></span><span class="skel w60" style="margin-top:14px"></span></div><div class="kpi"><span class="skel w40"></span><span class="skel w60" style="margin-top:14px"></span></div></div>
        <div class="panel"><div class="in"><span class="skel w80"></span><span class="skel w60"></span><span class="skel w80"></span><span class="skel w40"></span></div></div>
      </div>

      <div data-when="empty">
        <div class="empty">
          <h3>No outcomes yet</h3>
          <p>An outcome is a named, dated theme &mdash; &ldquo;cut reporting effort&rdquo; &mdash; that issues are grouped under. Acme Robotics has 16 delivery issues and nothing to group them by.</p>
          <button class="btn pri" data-roles="OrgAdmin">Add the first outcome</button>
          <span class="deniedwrap" data-roles="SiteAdmin User ReadOnly"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-rm-e">Add the first outcome</button><span class="denied" id="p-why-rm-e">Administrators only</span></span>
        </div>
      </div>

      <div data-when="normal">
        <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
          <div class="kpi"><div class="k">Delivery issues</div><div class="v num">16</div><div class="d">across all sprints and the backlog</div><div class="why">Every issue in Acme Robotics, whatever its sprint or outcome.</div></div>
          <div class="kpi"><div class="k">Grouped</div><div class="v num">14</div><div class="d">under 4 outcomes</div><div class="why">Issues with an outcome. Each is counted once, in the row it belongs to.</div></div>
          <div class="kpi"><div class="k">Not grouped</div><div class="v num">2</div><div class="d">no outcome, no bar</div><div class="why">Committed work that serves no stated outcome yet. Worth a look.</div></div>
        </div>
        <div class="roadwrap">
          <div class="roadgrid">
            <div class="hd">Outcome</div><div class="hd">Q3 2026</div><div class="hd">Q4 2026</div><div class="hd">Q1 2027</div><div class="hd">Q2 2027</div>
            <div class="out"><a href="#" data-go="s-outcome">Cut reporting effort</a><small>4 issues &middot; 3 done</small></div>
            <div><span class="barx"><span class="dot" style="background:var(--sky)"></span>Sprints 11&ndash;12</span></div><div></div><div></div><div></div>
            <div class="out"><a href="#">Make review predictable</a><small>5 issues &middot; 1 done</small></div>
            <div></div><div><span class="barx"><span class="dot" style="background:var(--teal)"></span>Sprint 12</span></div>
            <div><span class="barx"><span class="dot" style="background:var(--teal)"></span>Sprints 13&ndash;15</span></div><div></div>
            <div class="out"><a href="#">Standardize intake</a><small>3 issues &middot; 0 done</small></div>
            <div></div><div></div><div><span class="barx"><span class="dot" style="background:var(--green)"></span>Sprints 14&ndash;16</span></div>
            <div><span class="barx"><span class="dot" style="background:var(--green)"></span>Sprints 17&ndash;18</span></div>
            <div class="out"><a href="#">Retire legacy steps</a><small>2 issues &middot; 0 done</small></div>
            <div></div><div></div><div></div><div><span class="barx"><span class="dot" style="background:var(--orange)"></span>Sprints 19&ndash;20</span></div>
            <div class="out dim">Not grouped<small>2 issues &middot; 0 done</small></div>
            <div class="dim"></div><div class="dim"></div><div class="dim"></div><div class="dim faint">no outcome, no bar</div>
          </div>
          <div class="sum"><span>4 outcomes</span><span>rows sum to <b>14</b></span><span>+ 2 not grouped = <b>16</b></span><span><b>= the delivery set</b></span></div>
        </div>
      </div>

      <div class="note"><b>A partition, not a cover.</b> Because an issue has at most one outcome, the four rows and the ungrouped row add up to the 16 delivery issues with nothing counted twice, so the ledger needs no distinct-count beside it. The bars form a staircase for the same reason: an outcome&rsquo;s span is drawn only from its own issues, so a shared issue cannot drag a bar into a quarter its work does not start in. The outcome dot names the row and is always beside its label &mdash; no bar carries a fill.</div>
    </div>
  </div>
</div></section>

<!-- ==================== OUTCOME ==================== -->

<section class="screen" id="s-outcome" data-on="0"><div class="shell">
@@DESK:roadmap@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <a href="#" data-go="s-roadmap">Roadmap</a> / <b>Cut reporting effort</b></span><span class="spacer"></span>
      <button class="btn" data-roles="OrgAdmin">Edit outcome</button>
      <button class="btn pri" data-roles="OrgAdmin" data-go="s-group">Group an issue</button>
      <span class="deniedwrap" data-roles="SiteAdmin">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-oc-sa">Group an issue</button>
        <span class="denied" id="p-why-oc-sa">Act as an Acme Robotics administrator to change this</span></span>
      <span class="deniedwrap" data-roles="User ReadOnly">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-oc-m">Group an issue</button>
        <span class="denied" id="p-why-oc-m">Administrators only</span></span></div>
    <div class="work">
      <div class="pgh"><div class="grow">
        <div class="chipbar" style="margin-bottom:var(--s-sm)"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Outcome</span><span class="cap faint num">Q3 2026 &middot; target 1 Jul &ndash; 30 Sep</span></div>
        <h1>Cut reporting effort</h1>
        <div class="sub">Coordinators spend a day a week on reports nobody reads twice. Halve it. &mdash; 4 issues &middot; 3 done &middot; Sprints 11&ndash;12 &middot; owned by Olivia Administer</div></div></div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Couldn&rsquo;t load this outcome.</b> Nothing has been changed. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>

      <div data-when="loading" aria-busy="true" class="panel"><div class="in"><span class="skel w80"></span><span class="skel w60"></span><span class="skel w80"></span><span class="skel w40"></span></div></div>

      <div data-when="empty" class="empty">
        <h3>Nothing grouped here yet</h3>
        <p>This outcome has a name and a window and no work behind it. Group an issue under it from the issue itself, or from here.</p>
        <button class="btn pri" data-roles="OrgAdmin" data-go="s-group">Group an issue</button>
      </div>

      <div data-when="normal" class="panel">
        <h2><span class="grow">Issues under this outcome</span><span class="cap faint" style="font-weight:400">derived &mdash; nothing here is stored on the outcome</span></h2>
        <div class="lede">Each issue belongs here and nowhere else, so &ldquo;3 of 4 done&rdquo; is a fact about this outcome. Sprint order, then status.</div>
        <table>
          <thead><tr><th style="width:96px">Key</th><th>Issue</th><th style="width:150px">Status</th><th style="width:100px">Sprint</th><th style="width:150px">Effort</th></tr></thead>
          <tbody>
            <tr><td><span class="key">CLG-103</span></td><td><a class="t" href="#">Measure time saved</a></td><td><span class="marker"><span class="dot" style="background:var(--green)"></span>Complete</span></td><td class="num">11</td><td><span class="marker"><span class="dot"></span>Low</span></td></tr>
            <tr><td><span class="key">CLG-127</span></td><td><a class="t" href="#">Publish the reporting data dictionary</a></td><td><span class="marker"><span class="dot" style="background:var(--green)"></span>Complete</span></td><td class="num">11</td><td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td></tr>
            <tr><td><span class="key">CLG-131</span></td><td><a class="t" href="#">Archive the manual Friday template</a></td><td><span class="marker"><span class="dot" style="background:var(--green)"></span>Complete</span></td><td class="num">11</td><td><span class="marker"><span class="dot"></span>Low</span></td></tr>
            <tr><td><span class="key">CLG-114</span></td><td><a class="t" href="#" data-go="s-issue">Automate weekly reporting</a></td><td><span class="marker"><span class="dot" style="background:var(--sky)"></span>Development</span></td><td class="num">12</td><td><span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium</span></td></tr>
          </tbody>
        </table>
      </div>

      <div class="note"><b>The window is intent; the span is fact.</b> The target window is the only thing stored on an outcome. The sprint span, the counts and &ldquo;done&rdquo; are read off the issues each time, so when the two disagree &mdash; a Q3 target with work landing in Sprint 14 &mdash; the page is showing you something true rather than something to tidy.</div>
    </div>
  </div>
</div></section>

<!-- ==================== SET OUTCOME (docked) ==================== -->

<section class="screen" id="s-group" data-on="0"><div class="shell insp">
@@DESK:sprint@@
  <div class="main">
    <div class="topbar"><span class="crumb">Delivery / <a href="#" data-go="s-sprint">Sprint 12</a> / <b>CLG-114</b></span><span class="spacer"></span><button class="btn" data-go="s-issue">Back to issue</button></div>
    <div class="work">
      <div class="pgh"><div class="grow">
        <div class="chipbar" style="margin-bottom:var(--s-sm)"><span class="key">CLG-114</span>
          <span class="marker"><span class="dot" style="background:var(--sky)"></span>Delivery</span>
          <span class="marker"><span class="dot" style="background:var(--teal)"></span>Medium effort</span></div>
        <h1>Automate weekly reporting</h1>
        <div class="sub">The issue stays where it is while the outcome is chosen on the right.</div></div></div>
      <div class="panel">
        <h2>Delivery</h2>
        <div class="in"><dl class="kv">
          <dt>Status</dt><dd><span class="marker"><span class="dot" style="background:var(--sky)"></span>Development</span></dd>
          <dt>Sprint</dt><dd>Sprint 12 <span class="marker"><span class="dot" style="background:var(--green)"></span>Active</span></dd>
          <dt>Outcome</dt><dd><span class="rmtag"><span class="dot" style="background:var(--sky)"></span>Cut reporting effort</span></dd>
        </dl></div>
      </div>
      <div class="note"><b>Docked, like every other edit.</b> Setting the outcome is a short form, so it opens as the third column rather than a drawer: nothing is covered, there is no focus trap, and Escape closes it. The radio group is the whole difference from the rejected multi-parent design &mdash; a checkbox list would make this an add, and an add is what makes every roadmap total a cover instead of a count.</div>
    </div>
  </div>
  <aside class="inspector" aria-label="Set outcome">
    <div class="insp-head">
      <div class="eyebrow">Set outcome</div>
      <h2>Which outcome does <span style="white-space:nowrap">CLG-114</span> serve?</h2>
      <div class="meta">One outcome per issue. Picking another moves it.</div>
    </div>
    <div class="insp-body">
      <fieldset style="border:0;padding:0;margin:0">
        <legend class="vh">Outcome</legend>
        <div class="pick" style="max-height:none">
          <div class="pickrow"><input type="radio" name="p-oc" id="p-oc-1" checked><label for="p-oc-1" class="grow"><span class="dot" style="background:var(--sky);margin-right:6px"></span>Cut reporting effort<span class="ty" style="display:block">4 issues &middot; 3 done &middot; Sprints 11&ndash;12</span></label></div>
          <div class="pickrow"><input type="radio" name="p-oc" id="p-oc-2"><label for="p-oc-2" class="grow"><span class="dot" style="background:var(--teal);margin-right:6px"></span>Make review predictable<span class="ty" style="display:block">5 issues &middot; 1 done &middot; Sprints 12&ndash;15</span></label></div>
          <div class="pickrow"><input type="radio" name="p-oc" id="p-oc-3"><label for="p-oc-3" class="grow"><span class="dot" style="background:var(--green);margin-right:6px"></span>Standardize intake<span class="ty" style="display:block">3 issues &middot; 0 done &middot; Sprints 14&ndash;18</span></label></div>
          <div class="pickrow"><input type="radio" name="p-oc" id="p-oc-4"><label for="p-oc-4" class="grow"><span class="dot" style="background:var(--orange);margin-right:6px"></span>Retire legacy steps<span class="ty" style="display:block">2 issues &middot; 0 done &middot; Sprints 19&ndash;20</span></label></div>
          <div class="pickrow"><input type="radio" name="p-oc" id="p-oc-0"><label for="p-oc-0" class="grow"><span class="dot" style="margin-right:6px"></span>Not grouped<span class="ty" style="display:block">no outcome, no bar on the roadmap</span></label></div>
        </div>
      </fieldset>
      <div class="alert warn" role="status"><span><b>This is a move, not an addition.</b> Choosing <em>Standardize intake</em> takes CLG-114 out of <em>Cut reporting effort</em>, which would then read 3 issues &middot; 3 done &mdash; finished, while the work it depends on is still in Development. That is the honest cost of one home; the roadmap shows it rather than hiding it.</span></div>
      <p class="cap faint" style="margin:0">Changing the outcome writes one audit event.</p>
    </div>
    <div class="insp-foot">
      <button class="btn pri" style="flex:1;justify-content:center" data-roles="OrgAdmin" data-go="s-issue">Move issue</button>
      <span class="deniedwrap" data-roles="SiteAdmin User ReadOnly" style="flex:1"><button class="btn pri" aria-disabled="true" aria-describedby="p-why-gr">Move issue</button><span class="denied" id="p-why-gr">Administrators only</span></span>
      <button class="btn" data-go="s-issue">Cancel</button>
    </div>
  </aside>
</div></section>

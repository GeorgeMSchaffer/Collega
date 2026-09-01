<section class="screen" id="s-settings" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><b>Settings</b></span><span class="spacer"></span></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Settings</h1>
        <div class="sub">Manage your profile and organization configuration.</div></div></div>

      <div data-when="normal empty" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(292px,1fr));gap:var(--s-md)">
        <a class="card" href="#" data-go="s-profile" style="color:inherit;text-decoration:none">
          <b>My Profile</b><div class="sub" style="margin-top:4px">Update your name and password.</div></a>

        <a class="card" href="#" data-go="s-orgs" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>Organizations</b><div class="sub" style="margin-top:4px">Create organizations and manage each organization&rsquo;s configuration.</div></a>
        <a class="card" href="#" data-go="s-users" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>Manage Users</b> <span class="tag">Cross-org</span><div class="sub" style="margin-top:4px">View users across every organization, then open one to manage it.</div></a>
        <a class="card" href="#" data-go="s-boards" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>Boards</b> <span class="tag">Cross-org</span><div class="sub" style="margin-top:4px">View boards across every organization, then open one to work with it.</div></a>
        <a class="card" href="#" data-go="s-statuses" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>Manage Statuses</b> <span class="tag">Cross-org</span><div class="sub" style="margin-top:4px">View statuses across every organization, then open one to manage it.</div></a>
        <a class="card" href="#" data-go="s-idea-types" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>Manage Idea Types</b> <span class="tag">Cross-org</span><div class="sub" style="margin-top:4px">View idea types across every organization, then open one to manage it.</div></a>
        <a class="card" href="#" data-go="s-fields" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>Manage User-Defined Fields</b> <span class="tag">Cross-org</span><div class="sub" style="margin-top:4px">View fields across every organization, then open one to manage it.</div></a>
        <a class="card" href="#" data-go="s-ai-assist" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>AI Assist</b><div class="sub" style="margin-top:4px">Tune an organization&rsquo;s assistant scope. Act as a member to configure theirs.</div></a>
        <a class="card" href="#" data-go="s-api" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>API</b><div class="sub" style="margin-top:4px">AI assist token usage and cost by organization, against the daily limit.</div></a>
        <a class="card" href="#" data-go="s-ai-prompt" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>AI Prompt</b> <span class="tag">Site Admin only</span><div class="sub" style="margin-top:4px">Edit the assistant&rsquo;s instructions for every organization, with history and rollback.</div></a>

        <a class="card" href="#" data-go="s-users" data-roles="OrgAdmin" style="color:inherit;text-decoration:none">
          <b>Manage Users</b><div class="sub" style="margin-top:4px">Create, edit, and import users in your organization.</div></a>
        <a class="card" href="#" data-go="s-boards" data-roles="OrgAdmin" style="color:inherit;text-decoration:none">
          <b>Manage Boards</b><div class="sub" style="margin-top:4px">Create and configure boards in your organization.</div></a>
        <a class="card" href="#" data-go="s-statuses" data-roles="OrgAdmin" style="color:inherit;text-decoration:none">
          <b>Manage Statuses</b><div class="sub" style="margin-top:4px">Configure the statuses used by your organization&rsquo;s boards.</div></a>
        <a class="card" href="#" data-go="s-idea-types" data-roles="OrgAdmin" style="color:inherit;text-decoration:none">
          <b>Manage Idea Types</b><div class="sub" style="margin-top:4px">Configure the idea types your organization files ideas under.</div></a>
        <a class="card" href="#" data-go="s-fields" data-roles="OrgAdmin" style="color:inherit;text-decoration:none">
          <b>Manage User-Defined Fields</b><div class="sub" style="margin-top:4px">Configure the fields your organization captures on ideas.</div></a>
        <a class="card" href="#" data-go="s-ai-assist" data-roles="OrgAdmin" style="color:inherit;text-decoration:none">
          <b>AI Assist</b><div class="sub" style="margin-top:4px">Tune what the idea assistant will and won&rsquo;t discuss for your organization.</div></a>
        <a class="card" href="#" data-go="s-api" data-roles="OrgAdmin" style="color:inherit;text-decoration:none">
          <b>API</b><div class="sub" style="margin-top:4px">Your organization&rsquo;s AI assist token usage and estimated cost.</div></a>
      </div>

      <div class="note" data-when="normal empty" data-roles="User ReadOnly"><b>Settings is almost entirely administrative.</b> A member sees only their own profile here. Everything else on this screen &mdash; users, boards, statuses, idea types, fields, and the assistant &mdash; is configured by an organization administrator, so it is absent rather than refused.</div>

      <div data-when="loading" aria-busy="true" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(292px,1fr));gap:var(--s-md)">
        <div class="card"><span class="skel w60"></span><span class="skel w80" style="margin-top:10px"></span></div>
        <div class="card"><span class="skel w40"></span><span class="skel w80" style="margin-top:10px"></span></div>
        <div class="card"><span class="skel w80"></span><span class="skel w60" style="margin-top:10px"></span></div>
        <div class="card"><span class="skel w60"></span><span class="skel w80" style="margin-top:10px"></span></div>
        <div class="card"><span class="skel w40"></span><span class="skel w60" style="margin-top:10px"></span></div>
        <div class="card"><span class="skel w80"></span><span class="skel w80" style="margin-top:10px"></span></div>
      </div>

      <div data-when="error">
        <div class="alert" role="alert"><span><b>Couldn&rsquo;t load your settings.</b> Which sections you can reach depends on your role, and the role could not be read. Nothing is missing &mdash; it is unknown. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div>
      </div>

      <div class="note"><b>The hub is a role map, not a menu.</b> A Site Admin sees nine sections, an Org Admin seven, and a member exactly one. The two admin sets overlap in name but not in meaning: a Site Admin&rsquo;s <b>Manage Statuses</b> is a cross-organization roll-up that leads to a chosen organization, while an Org Admin&rsquo;s goes straight to their own. Switch the role control to see both.</div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-profile" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>Profile</b></span><span class="spacer"></span></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>My Profile</h1>
        <div class="sub">Edit your name and change your password. Email and role are read-only.</div></div></div>

      <div data-when="error"><div class="alert" role="alert"><span><b>Couldn&rsquo;t load your profile.</b> Nothing has been changed. Retrying is safe.</span></div>
        <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div></div>

      <div data-when="loading" aria-busy="true">
        <div class="card" style="max-width:720px"><span class="skel w40"></span><span class="skel w80" style="margin-top:10px"></span><span class="skel w60" style="margin-top:10px"></span></div>
      </div>

      <div data-when="normal empty" class="cols" style="grid-template-columns:minmax(0,720px) auto">
        <div>
          @@PROFILE@@

          <div class="card">
            <h3 style="font-size:20px;font-weight:600;letter-spacing:-.125px;line-height:1.4;margin:0 0 6px">Change password</h3>
            <div class="sub" style="margin-bottom:var(--s-md)">After changing your password, sign in again with the new one.</div>
            <form>
              <div class="field" style="max-width:340px"><label for="p-curpw">Current password</label><input type="password" id="p-curpw" autocomplete="current-password"></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-md)">
                <div class="field"><label for="p-newpw">New password</label><input type="password" id="p-newpw" autocomplete="new-password">
                  <div class="hint">At least 12 characters.</div></div>
                <div class="field"><label for="p-confpw">Confirm new password</label><input type="password" id="p-confpw" autocomplete="new-password"></div>
              </div>
              <button type="submit" class="btn pri">Change password</button>
            </form>
          </div>
        </div>
      </div>

      <div class="note"><b>Profile is the one settings screen every role reaches.</b> It is also the only place a member changes their own password, which is why it sits under Settings rather than behind the avatar menu. Email and role render read-only rather than absent, so a member can see what they are without being able to change it.</div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-statuses" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>Statuses</b></span><span class="spacer"></span>
      <button class="btn pri" data-roles="OrgAdmin">Add status</button>
      <span class="deniedwrap" data-roles="User ReadOnly">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-add">Add status</button>
        <span class="denied" id="p-why-add">Administrators only</span>
      </span></div>
    <div class="work">
      <div class="pgh" data-roles="SiteAdmin"><div class="grow"><h1>All statuses</h1>
        <div class="sub">Workflow statuses across every organization. Open an organization to change its statuses.</div></div></div>
      <div class="pgh" data-roles="OrgAdmin User ReadOnly"><div class="grow"><h1>Statuses</h1>
        <div class="sub">The columns your boards group ideas by. Order here is the order on every board.</div></div></div>

      <div class="filters" data-when="normal">
        <div class="fw wide"><label for="p-st-q">Search</label><input type="search" id="p-st-q" placeholder="Search statuses&hellip;"></div>
      </div>

      @@ROLLUP:st@@

      <div data-roles="OrgAdmin User ReadOnly">
      @@EDITOR:st:own@@
      <div class="note"><b>Create is inline, not a drawer.</b> A short create form sits beside the list it adds to, so the list stays visible for reference and there is no overlay to trap focus in. Longer edits still open the docked inspector. The swatch picker offers the DESIGN.md sticker palette by name, which is why the Colour column reads &ldquo;Sky&rdquo; rather than a hex value.</div>
      <div class="note"><b>This screen is the worked example for the shared mechanisms.</b> The role control gates the create form and swaps every live Edit button for a disabled twin carrying a reason; the state control swaps the table for skeletons, an empty state, or a failed load. Denied controls use <code>aria-disabled</code> with <code>aria-describedby</code> rather than the <code>disabled</code> attribute, so they stay in the tab order and announce why they are refused.</div>
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-org-statuses" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb" data-roles="SiteAdmin"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-statuses">All statuses</a> / <b>Acme Robotics</b></span>
      <span class="crumb" data-roles="OrgAdmin User ReadOnly"><a href="#" data-go="s-settings">Settings</a> / <b>Not available</b></span><span class="spacer"></span>
      <button class="btn pri" data-roles="SiteAdmin">Add status</button></div>
    <div class="work">
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Statuses</h1>
          <div class="sub">Acme Robotics &middot; the columns this organization&rsquo;s boards group ideas by.</div></div></div>
        @@SCOPEBAR:statuses:s-statuses@@
        @@EDITOR:st:org@@
        <div class="note"><b>The same screen, reached a different way.</b> This is the identical editor an Org Admin sees at <code>/settings/statuses</code> &mdash; the markup below is generated from one definition and rendered twice, so the two routes cannot drift apart. Only the banner and the breadcrumb differ, because only the way in differs.</div>
      </div>
      <div data-roles="OrgAdmin User ReadOnly">
        <div class="pgh"><div class="grow"><h1>Not available</h1>
          <div class="sub">Organization-scoped settings routes belong to Site Admins.</div></div></div>
        <div class="empty">
          <h3>This route is Site Admin only</h3>
          <p>The <code>/settings/organizations/{id}/statuses</code> route exists so a Site Admin can manage an organization they are not a member of. Your own organization&rsquo;s statuses live at <b>Settings &rsaquo; Manage Statuses</b>.</p>
          <a class="btn" href="#" data-go="s-statuses">Go to your statuses</a>
        </div>
      </div>
    </div>
  </div>
</div></section>

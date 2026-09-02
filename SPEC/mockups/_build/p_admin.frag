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
        <a class="card" href="comp-p-focus-roadmap.html#s-boards" data-roles="SiteAdmin" style="color:inherit;text-decoration:none">
          <b>Boards</b> <span class="tag">Workspace</span><div class="sub" style="margin-top:4px">View boards across every organization, then open one to work with it. This one leaves Settings &mdash; a Site Admin reads boards from the workspace list, not from board administration.</div></a>
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
        <a class="card" href="#" data-go="s-boards-admin" data-roles="OrgAdmin" style="color:inherit;text-decoration:none">
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
      <button class="btn pri" data-roles="OrgAdmin">Add status</button></div>
    <div class="work">
      <div class="pgh" data-roles="SiteAdmin"><div class="grow"><h1>All statuses</h1>
        <div class="sub">Workflow statuses across every organization. Open an organization to change its statuses.</div></div></div>
      <div class="pgh" data-roles="OrgAdmin"><div class="grow"><h1>Statuses</h1>
        <div class="sub">The columns your boards group ideas by. Order here is the order on every board.</div></div></div>

      <div class="filters" data-when="normal" data-roles="SiteAdmin OrgAdmin">
        <div class="fw wide"><label for="p-st-q">Search</label><input type="search" id="p-st-q" placeholder="Search statuses&hellip;"></div>
      </div>

      @@GUARD:ADMIN:statuses@@

      @@ROLLUP:st@@

      <div data-roles="OrgAdmin">
      @@EDITOR:st:own:rw@@
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
      <span class="tag" data-roles="SiteAdmin">Read-only</span></div>
    <div class="work">
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Statuses</h1>
          <div class="sub">Acme Robotics &middot; the columns this organization&rsquo;s boards group ideas by.</div></div></div>
        @@SCOPEBAR:statuses:s-statuses@@
        @@EDITOR:st:org:ro@@
        <div class="note"><b>The same screen, minus the ability to change it.</b> <code>StatusesAdmin.razor</code> computes <code>CanMutate</code> as <code>!isSiteAdmin</code>, so a Site Admin reads every organization&rsquo;s configuration and writes none of it. The table below is generated from the same definition as an Org Admin&rsquo;s <code>/settings/statuses</code>, rendered with mutation switched off &mdash; which is why the columns match and the controls do not.</div>
      </div>
      @@GUARD:SITE:statuses@@
    </div>
  </div>
</div></section>

<section class="screen" id="s-idea-types" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>Idea types</b></span><span class="spacer"></span>
      <button class="btn pri" data-roles="OrgAdmin">New idea type</button></div>
    <div class="work">
      <div class="pgh" data-roles="SiteAdmin"><div class="grow"><h1>All idea types</h1>
        <div class="sub">Idea types across every organization. Open an organization to change its types.</div></div></div>
      <div class="pgh" data-roles="OrgAdmin"><div class="grow"><h1>Idea types</h1>
        <div class="sub">Every idea is exactly one type, chosen at creation. A type carries its own selection of the organization&rsquo;s fields, so an idea shows only the fields that matter to it.</div></div></div>

      <div class="filters" data-when="normal" data-roles="SiteAdmin OrgAdmin">
        <div class="fw wide"><label for="p-it-q">Search</label><input type="search" id="p-it-q" placeholder="Search idea types&hellip;"></div>
      </div>

      @@GUARD:ADMIN:idea types@@

      @@ROLLUP:it@@

      <div data-roles="OrgAdmin">
      @@EDITOR:it:own:rw@@
      <div class="note"><b>Fields are chosen per type, not per idea.</b> The organization defines a catalogue of fields once; each type picks the ordered subset its ideas show, and marks which of them are required. That is why this screen and <a href="#" data-go="s-fields">Fields</a> are separate: one owns what exists, the other owns what each type uses.</div>
      <div class="note"><b>Archiving is a soft delete.</b> Ideas already carrying an archived type keep their badge and still resolve their fields &mdash; the type simply leaves the create picker. The last remaining active type cannot be archived, because every idea must have one.</div>
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-org-idea-types" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb" data-roles="SiteAdmin"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-idea-types">All idea types</a> / <b>Acme Robotics</b></span>
      <span class="crumb" data-roles="OrgAdmin User ReadOnly"><a href="#" data-go="s-settings">Settings</a> / <b>Not available</b></span><span class="spacer"></span>
      <span class="tag" data-roles="SiteAdmin">Read-only</span></div>
    <div class="work">
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Idea types</h1>
          <div class="sub">Acme Robotics &middot; the types this organization&rsquo;s ideas are created as.</div></div></div>
        @@SCOPEBAR:idea types:s-idea-types@@
        @@EDITOR:it:org:ro@@
        <div class="note"><b>The same screen, minus the ability to change it.</b> <code>IdeaTypesAdmin.razor</code> computes <code>CanMutate</code> as <code>!isSiteAdmin</code>, so this table is generated from the same definition as an Org Admin&rsquo;s <code>/settings/idea-types</code>, rendered with mutation switched off.</div>
      </div>
      @@GUARD:SITE:idea types@@
    </div>
  </div>
</div></section>

<section class="screen" id="s-fields" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>Fields</b></span><span class="spacer"></span>
      <button class="btn pri" data-roles="OrgAdmin">Add field</button></div>
    <div class="work">
      <div class="pgh" data-roles="SiteAdmin"><div class="grow"><h1>All fields</h1>
        <div class="sub">User-defined fields across every organization. Open an organization to change its fields.</div></div></div>
      <div class="pgh" data-roles="OrgAdmin"><div class="grow"><h1>Fields</h1>
        <div class="sub">The organization&rsquo;s catalogue of custom fields. Defining one here makes it available to idea types; nothing appears on an idea until a type picks it up.</div></div></div>

      <div class="filters" data-when="normal" data-roles="SiteAdmin OrgAdmin">
        <div class="fw wide"><label for="p-fd-q">Search</label><input type="search" id="p-fd-q" placeholder="Search fields&hellip;"></div>
        <div class="fw"><label class="chk" for="p-fd-arch"><input type="checkbox" id="p-fd-arch" checked> Show archived</label></div>
      </div>

      @@GUARD:ADMIN:fields@@

      @@ROLLUP:fd@@

      <div data-roles="OrgAdmin">
      @@EDITOR:fd:own:rw@@
      <div class="note"><b>Reordering uses buttons, not a drag handle.</b> Unlike statuses and idea types, this list reorders with paired arrows in the action cell &mdash; a difference inherited from <code>FieldDefinitionsAdmin.razor</code>, kept here because the comps are a port of what the product does, not a proposal to change it. Worth resolving one way or the other before the conversion builds it.</div>
      <div class="note"><b>A field&rsquo;s type is fixed once it holds values.</b> Changing Number to Text would have to reinterpret every value already stored against it, so the type control locks as soon as any idea uses the field. Archiving is the way out: the field leaves the picker but stays readable on ideas that already carry it.</div>
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-org-fields" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb" data-roles="SiteAdmin"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-fields">All fields</a> / <b>Acme Robotics</b></span>
      <span class="crumb" data-roles="OrgAdmin User ReadOnly"><a href="#" data-go="s-settings">Settings</a> / <b>Not available</b></span><span class="spacer"></span>
      <span class="tag" data-roles="SiteAdmin">Read-only</span></div>
    <div class="work">
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Fields</h1>
          <div class="sub">Acme Robotics &middot; the custom fields this organization&rsquo;s idea types draw from.</div></div></div>
        @@SCOPEBAR:fields:s-fields@@
        @@EDITOR:fd:org:ro@@
        <div class="note"><b>The same screen, minus the ability to change it.</b> Generated from the same definition as an Org Admin&rsquo;s <code>/settings/fields</code> with mutation switched off, so the columns match and the controls do not.</div>
      </div>
      @@GUARD:SITE:fields@@
    </div>
  </div>
</div></section>

<section class="screen" id="s-users" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>Users</b></span><span class="spacer"></span>
      <a class="btn" href="#" data-go="s-import" data-roles="OrgAdmin">Import CSV</a>
      <button class="btn pri" data-roles="OrgAdmin">Add user</button></div>
    <div class="work">
      <div class="pgh" data-roles="SiteAdmin"><div class="grow"><h1>All users</h1>
        <div class="sub">Every account across every organization. Open a person for their detail and password reset.</div></div></div>
      <div class="pgh" data-roles="OrgAdmin"><div class="grow"><h1>Users</h1>
        <div class="sub">Acme Robotics &middot; who can sign in, and what each of them may do.</div></div></div>

      <div class="filters" data-when="normal" data-roles="SiteAdmin OrgAdmin">
        <div class="fw wide"><label for="p-us-q">Search</label><input type="search" id="p-us-q" placeholder="Search name or email&hellip;"></div>
        <div class="fw"><label for="p-us-role">Role</label><select id="p-us-role"><option>Any role</option><option>Org Admin</option><option>User</option><option>Read Only</option></select></div>
        <div class="fw"><label for="p-us-st">Status</label><select id="p-us-st"><option>Any status</option><option>Active</option><option>Inactive</option></select></div>
      </div>

      @@GUARD:ADMIN:users@@

      @@ROLLUP:us@@

      <div data-roles="OrgAdmin">
      @@INVITE:own@@
      @@EDITOR:us:own:rw@@
      <div class="note"><b>Two ways in, and they are not equivalent.</b> Adding a person here creates the account and shows a generated password once; the invite code lets people create their own account against this organization. Regenerating the code does not affect anyone who already used it.</div>
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-org-users" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb" data-roles="SiteAdmin"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-users">All users</a> / <b>Acme Robotics</b></span>
      <span class="crumb" data-roles="OrgAdmin User ReadOnly"><a href="#" data-go="s-settings">Settings</a> / <b>Not available</b></span><span class="spacer"></span>
      <a class="btn" href="#" data-go="s-org-import" data-roles="SiteAdmin">Import CSV</a>
      <button class="btn pri" data-roles="SiteAdmin">Add user</button></div>
    <div class="work">
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Users</h1>
          <div class="sub">Acme Robotics &middot; who can sign in to this organization, and what each of them may do.</div></div></div>
        @@SCOPEBAR:users:s-users@@
        @@INVITE:org@@
        @@EDITOR:us:org:rw@@
        <div class="note"><b>This is the one org-scoped screen a Site Admin can change.</b> Statuses, idea types and fields are all read-only here &mdash; <code>SPEC/30-Contracts.md</code> refuses a Site Admin any mutation of organization-owned <em>content</em>. User and organization administration are the deliberate exception, because somebody has to be able to reset the password of an Org Admin who has locked themselves out. The server agrees: <code>UserService.AuthorizeOrganizationScopeAsync</code> admits a Site Admin to any organization.</div>
        <div class="note"><b>So the read-only banner is absent on purpose.</b> A reviewer arriving from Statuses &middot; org will expect one. Its absence is the product rule, not a missed screen.</div>
      </div>
      @@GUARD:SITE:users@@
    </div>
  </div>
</div></section>

<section class="screen" id="s-import" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-users">Users</a> / <b>Import</b></span><span class="spacer"></span></div>
    <div class="work">
      @@GUARD:ADMIN:the user import@@
      <div data-roles="SiteAdmin OrgAdmin">
        <div class="pgh"><div class="grow"><h1>Import users</h1>
          <div class="sub">Create many accounts at once from a CSV. Every new account gets a temporary password and must change it at first sign-in.</div></div></div>
        @@IMPORT:own@@
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-org-import" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb" data-roles="SiteAdmin"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-users">All users</a> / <a href="#" data-go="s-org-users">Acme Robotics</a> / <b>Import</b></span>
      <span class="crumb" data-roles="OrgAdmin User ReadOnly"><a href="#" data-go="s-settings">Settings</a> / <b>Not available</b></span><span class="spacer"></span></div>
    <div class="work">
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Import users</h1>
          <div class="sub">Acme Robotics &middot; create many accounts at once from a CSV.</div></div></div>
        @@SCOPEBAR:the user import:s-org-users@@
        @@IMPORT:org@@
      </div>
      @@GUARD:SITE:the user import@@
    </div>
  </div>
</div></section>

<section class="screen" id="s-boards-admin" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>Boards</b></span><span class="spacer"></span>
      <a class="btn pri" href="#" data-go="s-board-new" data-roles="OrgAdmin">New board</a></div>
    <div class="work">
      <div class="pgh" data-roles="OrgAdmin"><div class="grow"><h1>Boards</h1>
        <div class="sub">The boards your organization tracks ideas on. Each one picks its own swimlanes from the shared set of statuses.</div></div></div>

      <div class="filters" data-when="normal" data-roles="OrgAdmin">
        <div class="fw wide"><label for="p-bd-q">Search</label><input type="search" id="p-bd-q" placeholder="Search boards&hellip;"></div>
      </div>

      @@GUARD:ADMIN:boards@@

      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Boards</h1>
          <div class="sub">There is no cross-organization board view.</div></div></div>
        <div class="panel"><div class="in"><div class="empty">
          <h3>This route has no Site Admin story</h3>
          <p>Board administration is scoped to one organization, and a Site Admin belongs to none, so <code>/settings/boards</code> has no organization to list. The product agrees, and routes you elsewhere: the Settings hub sends a Site Admin to the workspace boards list rather than here.</p>
          <a class="btn" href="comp-p-focus-roadmap.html#s-boards">Go to the boards list</a>
          <a class="btn" href="#" data-go="s-org-boards">Open Acme Robotics&rsquo; boards</a>
        </div></div></div>
        <div class="note"><b>Shown because the route exists, not because it works.</b> Reaching this URL directly as a Site Admin renders an error in the product today &mdash; <code>BoardsAdmin.razor</code> reports &ldquo;Your account isn&rsquo;t associated with an organization.&rdquo; That is accurate but reads as a fault rather than a scoping rule, which is what this screen proposes replacing it with.</div>
      </div>

      <div data-roles="OrgAdmin">
      @@EDITOR:bd:own:rw@@
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-org-boards" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb" data-roles="SiteAdmin"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-boards-admin">Boards</a> / <b>Acme Robotics</b></span>
      <span class="crumb" data-roles="OrgAdmin User ReadOnly"><a href="#" data-go="s-settings">Settings</a> / <b>Not available</b></span><span class="spacer"></span>
      <span class="tag" data-roles="SiteAdmin">Read-only</span></div>
    <div class="work">
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Boards</h1>
          <div class="sub">Acme Robotics &middot; the boards this organization tracks ideas on.</div></div></div>
        @@SCOPEBAR:boards:s-boards-admin@@
        @@EDITOR:bd:org:ro@@
        <div class="note"><b>Read-only, unlike Users &middot; org.</b> A board is organization-owned content, so <code>SPEC/30-Contracts.md</code> refuses a Site Admin any change to it; user administration is the bootstrap exception and boards are not. <code>BoardsAdmin.razor</code> withholds both <b>New board</b> and the per-row <b>Edit</b> on both of its routes.</div>
      </div>
      @@GUARD:SITE:boards@@
    </div>
  </div>
</div></section>

<section class="screen" id="s-board-new" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-boards-admin">Boards</a> / <b>New</b></span><span class="spacer"></span></div>
    <div class="work">
      @@GUARD:ADMIN:board creation@@
      @@GUARD:REFUSED:board creation:s-boards-admin@@
      <div data-roles="OrgAdmin">
        <div class="pgh"><div class="grow"><h1>New board</h1>
          <div class="sub">Name it, then choose which of this organization&rsquo;s statuses become its columns.</div></div></div>
        @@BOARDFORM:new:new@@
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-board-edit" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-boards-admin">Boards</a> / <b>Product intake</b></span><span class="spacer"></span></div>
    <div class="work">
      @@GUARD:ADMIN:this board@@
      @@GUARD:REFUSED:this board:s-boards-admin@@
      <div data-roles="OrgAdmin">
        <div class="pgh"><div class="grow"><h1>Edit board</h1>
          <div class="sub">Product intake &middot; 4 swimlanes, drawn from this organization&rsquo;s statuses.</div></div></div>
        @@BOARDFORM:edit:edit@@
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-org-board-new" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb" data-roles="SiteAdmin"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-org-boards">Acme Robotics</a> / <b>New</b></span>
      <span class="crumb" data-roles="OrgAdmin User ReadOnly"><a href="#" data-go="s-settings">Settings</a> / <b>Not available</b></span><span class="spacer"></span></div>
    <div class="work">
      @@GUARD:REFUSED:board creation:s-org-boards@@
      @@GUARD:SITE:board creation@@
    </div>
  </div>
</div></section>

<section class="screen" id="s-org-board-edit" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb" data-roles="SiteAdmin"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-org-boards">Acme Robotics</a> / <b>Product intake</b></span>
      <span class="crumb" data-roles="OrgAdmin User ReadOnly"><a href="#" data-go="s-settings">Settings</a> / <b>Not available</b></span><span class="spacer"></span></div>
    <div class="work">
      @@GUARD:REFUSED:this board:s-org-boards@@
      @@GUARD:SITE:this board@@
    </div>
  </div>
</div></section>

<section class="screen" id="s-orgs" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>Organizations</b></span><span class="spacer"></span></div>
    <div class="work">
      @@GUARD:SITE:organizations@@
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Organizations</h1>
          <div class="sub">Manage organizations across the platform.</div></div></div>

        <div class="filters" data-when="normal">
          <div class="fw wide"><label for="p-or-q">Search</label><input type="search" id="p-or-q" placeholder="Search organizations&hellip;"></div>
          <div class="fw"><label for="p-or-st">Status</label><select id="p-or-st"><option>Active only</option><option>Active and archived</option><option>Archived only</option></select></div>
        </div>

        @@EDITOR:or:list:rw@@

        <div class="note"><b>This is the one page a Site Admin can change.</b> Every other organization-scoped settings screen refuses them, because the content belongs to the organization. Organizations themselves belong to the platform, and someone has to be able to create the first one &mdash; so this page, user administration, and the AI prompt are the three exceptions.</div>
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-org-detail" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <a href="#" data-go="s-orgs">Organizations</a> / <b>Acme Robotics</b></span><span class="spacer"></span></div>
    <div class="work">
      @@GUARD:SITE:organizations@@
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>Organizations</h1>
          <div class="sub">Manage organizations across the platform.</div></div></div>

        <div class="filters" data-when="normal">
          <div class="fw wide"><label for="p-od-q">Search</label><input type="search" id="p-od-q" placeholder="Search organizations&hellip;"></div>
          <div class="fw"><label for="p-od-st">Status</label><select id="p-od-st"><option>Active only</option><option>Active and archived</option><option>Archived only</option></select></div>
        </div>

        @@EDITOR:od:detail:rw@@

        <div class="note"><b>The same list, with one organization open.</b> <code>/settings/organizations/{id}</code> is not a second page &mdash; <code>Settings.razor</code> renders the identical list and opens a panel over it, which is why the list above is still live and still filterable. The panel is docked rather than overlaid, per the locked direction, so nothing is covered and there is no focus trap.</div>
        <div class="note" style="border-left-color:var(--orange)"><b>One deviation: the scoped jumps moved into the panel.</b> <code>Settings.razor</code> puts Users, Statuses and Fields in every row, which works beside a drawer that covers the table. Beside a docked panel the table is 700px narrower and four controls per row either clip or stack four deep &mdash; both measured, neither acceptable. The panel is the better home for them anyway: it names the organization the jump applies to, and it can carry all five scoped pages rather than the three that fit in a row.</div>
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-ai-assist" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>AI Assist</b></span><span class="spacer"></span></div>
    <div class="work">
      @@GUARD:ADMIN:the assistant settings@@
      <div class="pgh" data-roles="OrgAdmin"><div class="grow"><h1>AI Assist</h1>
        <div class="sub">Tell the assistant what Acme Robotics wants ideas about, so it can stay on subject.</div></div></div>
      @@AIASSIST@@
    </div>
  </div>
</div></section>

<section class="screen" id="s-ai-prompt" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>AI Prompt</b></span><span class="spacer"></span>
      <span class="tag" data-roles="SiteAdmin">Affects every organization</span></div>
    <div class="work">
      @@GUARD:SITE:the assistant instructions@@
      <div data-roles="SiteAdmin">
        <div class="pgh"><div class="grow"><h1>AI Prompt</h1>
          <div class="sub">The instructions every organization&rsquo;s assistant runs under, with safety probes and version history.</div></div></div>
        @@AIPROMPT@@
      </div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-api" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#" data-go="s-settings">Settings</a> / <b>API</b></span><span class="spacer"></span>
      <span class="tag">Read-only</span></div>
    <div class="work">
      @@GUARD:ADMIN:API usage@@
      <div class="pgh" data-roles="SiteAdmin OrgAdmin"><div class="grow"><h1>API usage</h1>
        <div class="sub">AI assist token consumption and estimated cost for today.</div></div></div>
      @@USAGE@@
      <div class="note" data-roles="SiteAdmin OrgAdmin"><b>A meter, not a management surface.</b> There is nothing to change here and no per-organization limit to set &mdash; the page exists to answer &ldquo;how much are we using, and is it about to stop?&rdquo; That is why it carries no denied controls: an absent action needs no explanation.</div>
    </div>
  </div>
</div></section>

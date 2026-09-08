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
      <div class="alert" role="alert" data-when="error"><span><b>Incorrect email or password.</b> Five failed attempts within 15 minutes lock the account for 15 minutes.</span></div>
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
        <button type="submit" class="btn pri" style="width:100%;justify-content:center" data-when="normal empty error">Sign in</button>
        <button type="submit" class="btn pri" style="width:100%;justify-content:center" aria-disabled="true" aria-busy="true" data-when="loading">Signing in&hellip;</button>
      </form>
      <p class="foot2">Have an invite code? <a href="#" data-go="s-register">Create an account</a>.<br>
      Forgot your password? Ask your organization admin to reset it.</p>
      <div class="note"><b>Accessibility carried over unchanged.</b> Native <code>&lt;button type="submit"&gt;</code> so Enter submits; <code>autocomplete="username"</code> paired with the password field so password managers work; a real <code>&lt;label for&gt;</code> bound to a real <code>&lt;input&gt;</code>. The error names neither credential, and &ldquo;forgot your password&rdquo; is a sentence rather than a link that goes nowhere &mdash; there is no self-service reset, so nothing should pretend to be one.</div>
    </div></div>
  </div>
</section>

<!-- ==================== LOCKED / INACTIVE ==================== -->

<section class="screen" id="s-locked" data-on="0">
  <div class="authwrap">
    <div class="authpitch">
      <div class="mark">CG</div>
      <h2>Five tries, then a pause.</h2>
      <p>A lock is a fixed 15-minute window, not a sliding one: it lifts on its own, and an administrator can issue a one-time temporary password if you cannot wait.</p>
    </div>
    <div class="authform"><div class="in">
      <h1>Sign in</h1>
      <p class="sub">One email, one account. We&rsquo;ll take you straight to your organization.</p>
      <div class="alert" role="alert" data-when="normal empty loading"><span><b>Account locked.</b> Five failed attempts within 15 minutes lock the account for 15 minutes &mdash; <span class="num">12:41</span> remaining, or your organization admin can issue a one-time temporary password.</span></div>
      <div class="alert" role="alert" data-when="error"><span><b>This account is inactive.</b> Contact your organization admin to restore access.</span></div>
      <form>
        <div class="field">
          <label for="p-lk-email">Email</label>
          <input type="text" inputmode="email" id="p-lk-email" name="email" autocomplete="username" value="umar@acmerobotics.com">
        </div>
        <div class="field">
          <label for="p-lk-pw">Password</label>
          <input type="password" id="p-lk-pw" name="password" autocomplete="current-password">
        </div>
        <button type="submit" class="btn pri" style="width:100%;justify-content:center">Sign in</button>
      </form>
      <p class="foot2">Have an invite code? <a href="#" data-go="s-register">Create an account</a>.</p>
      <div class="note"><b>Two refusals, one form.</b> The lock (<code>429</code>) and an inactive account (<code>403</code>) both leave the form in place, because the server is the thing refusing and the form is how you find out it has stopped. The fifth bad attempt answers <code>429</code> directly rather than <code>401</code>-then-<code>429</code>, so a user never sees &ldquo;incorrect password&rdquo; on the try that locked them. Use the state control: <b>error</b> shows the inactive-account message.</div>
    </div></div>
  </div>
</section>

<!-- ==================== RETURNED TO SIGN-IN ==================== -->

<section class="screen" id="s-returned" data-on="0">
  <div class="authwrap">
    <div class="authpitch">
      <div class="mark">CG</div>
      <h2>Back to sign in, and told why.</h2>
      <p>Every route back to this page carries its reason: an expired session, a changed password, or a freshly created account. A deliberate sign-out carries none &mdash; it is not an event you need explained.</p>
    </div>
    <div class="authform"><div class="in">
      <h1>Sign in</h1>
      <p class="sub">One email, one account. We&rsquo;ll take you straight to your organization.</p>
      <div class="authnote" role="status" data-when="normal loading"><span>Your session expired. Sign in again to continue.</span></div>
      <div class="authnote" role="status" data-when="empty"><span>Your password was changed. Please sign in with your new password.</span></div>
      <div class="alert" role="alert" data-when="error"><span><b>Incorrect email or password.</b> Five failed attempts within 15 minutes lock the account for 15 minutes.</span></div>
      <form>
        <div class="field">
          <label for="p-rt-email">Email</label>
          <input type="text" inputmode="email" id="p-rt-email" name="email" autocomplete="username" value="olivia@acmerobotics.com">
        </div>
        <div class="field">
          <label for="p-rt-pw">Password</label>
          <input type="password" id="p-rt-pw" name="password" autocomplete="current-password">
        </div>
        <button type="submit" class="btn pri" style="width:100%;justify-content:center" data-when="normal empty error">Sign in</button>
        <button type="submit" class="btn pri" style="width:100%;justify-content:center" aria-disabled="true" aria-busy="true" data-when="loading">Signing in&hellip;</button>
      </form>
      <p class="foot2">Have an invite code? <a href="#" data-go="s-register">Create an account</a>.<br>
      Forgot your password? Ask your organization admin to reset it.</p>
      <div class="note"><b>Three notices, one shape.</b> The session notice appears after 30 idle minutes, after the 8-hour absolute limit, or when the API rejects a stale token &mdash; and never after choosing Sign Out. The third string, shown after registering, reads <em>Your account was created. Sign in to get started.</em> All three are <code>role="status"</code>, not alerts: nothing went wrong.</div>
    </div></div>
  </div>
</section>

<!-- ==================== REGISTER ==================== -->

<section class="screen" id="s-register" data-on="0">
  <div class="authwrap">
    <div class="authpitch">
      <div class="mark">CG</div>
      <h2>Your invite code is your organization.</h2>
      <p>There is no organization picker. The code your administrator gave you decides where your account lives, and it lands you in that organization as a member.</p>
      <ul>
        <li><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"/></svg><span>One email per account, across every organization</span></li>
        <li><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"/></svg><span>A code can be regenerated by your admin at any time</span></li>
      </ul>
    </div>
    <div class="authform"><div class="in">
      <h1>Create your account</h1>
      <p class="sub">Enter the invite code from your organization admin. It decides which organization you join.</p>
      <div class="alert" role="alert" data-when="error"><span><b>Registration failed.</b> Check your invite code and try again.</span></div>
      <form>
        <div class="field" data-when="normal empty loading">
          <label for="p-rg-code">Invite code</label>
          <input type="text" id="p-rg-code" name="inviteCode" class="mono" autocomplete="off" spellcheck="false" placeholder="ACME-7Q2K-9XZ4">
        </div>
        <div class="field bad" data-when="error">
          <label for="p-rg-code-e">Invite code</label>
          <input type="text" id="p-rg-code-e" name="inviteCode" class="mono" autocomplete="off" spellcheck="false" value="ACME-7Q2K-9XZ5" aria-describedby="p-rg-code-msg">
          <span class="msg" id="p-rg-code-msg">This code isn&rsquo;t valid. Codes come from your organization admin and are case-sensitive.</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-md)">
          <div class="field"><label for="p-rg-first">First name</label><input type="text" id="p-rg-first" name="firstName" autocomplete="given-name"></div>
          <div class="field"><label for="p-rg-last">Last name</label><input type="text" id="p-rg-last" name="lastName" autocomplete="family-name"></div>
        </div>
        <div class="field">
          <label for="p-rg-email">Email</label>
          <input type="text" inputmode="email" id="p-rg-email" name="email" autocomplete="username" placeholder="you@yourcompany.com">
        </div>
        <div class="field">
          <label for="p-rg-pw">Password</label>
          <input type="password" id="p-rg-pw" name="password" autocomplete="new-password">
          <div class="hint">At least 6 characters, with an uppercase letter, a lowercase letter, a number and a symbol.</div>
        </div>
        <button type="submit" class="btn pri" style="width:100%;justify-content:center" data-when="normal empty error">Create account</button>
        <button type="submit" class="btn pri" style="width:100%;justify-content:center" aria-disabled="true" aria-busy="true" data-when="loading">Creating account&hellip;</button>
      </form>
      <p class="foot2">Already have an account? <a href="#" data-go="s-login">Sign in</a>.</p>
      <div class="note"><b>The code never says which organization.</b> A wrong code, an archived organization, and an expired code all answer the same way, because the code is the only thing a stranger holds and the response must not confirm what it unlocks. An email already in use is the one distinct refusal (<code>409</code>). On success the page returns to Sign in carrying <em>Your account was created</em>.</div>
    </div></div>
  </div>
</section>

<!-- ==================== FIRST SIGN-IN: FORCED PASSWORD CHANGE ==================== -->

<section class="screen" id="s-first-signin" data-on="0">
  <div class="authwrap">
    <div class="authpitch">
      <div class="mark">CG</div>
      <h2>Choose your own password.</h2>
      <p>You signed in with a temporary password issued by an administrator. It works exactly once and expires 24 hours after it was issued. Until you replace it, nothing else in Collega will open &mdash; the server refuses every other request, not just this page.</p>
    </div>
    <div class="authform"><div class="in">
      <h1>Change your password</h1>
      <p class="sub">For security, choose a new password before continuing.</p>
      <div class="alert" role="alert" data-when="error"><span><b>The new password and confirmation don&rsquo;t match.</b> Nothing has been changed.</span></div>
      <form>
        <div class="field">
          <label for="p-fs-cur">Current password</label>
          <input type="password" id="p-fs-cur" name="currentPassword" autocomplete="current-password">
          <div class="hint">The temporary password you just signed in with.</div>
        </div>
        <div class="field">
          <label for="p-fs-new">New password</label>
          <input type="password" id="p-fs-new" name="newPassword" autocomplete="new-password">
          <div class="hint">At least 6 characters, with an uppercase letter, a lowercase letter, a number and a symbol.</div>
        </div>
        <div class="field" data-when="normal empty loading">
          <label for="p-fs-conf">Confirm new password</label>
          <input type="password" id="p-fs-conf" name="confirmPassword" autocomplete="new-password">
        </div>
        <div class="field bad" data-when="error">
          <label for="p-fs-conf-e">Confirm new password</label>
          <input type="password" id="p-fs-conf-e" name="confirmPassword" autocomplete="new-password" value="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" aria-describedby="p-fs-conf-msg">
          <span class="msg" id="p-fs-conf-msg">Must match the new password exactly.</span>
        </div>
        <button type="submit" class="btn pri" style="width:100%;justify-content:center" data-when="normal empty error">Update password</button>
        <button type="submit" class="btn pri" style="width:100%;justify-content:center" aria-disabled="true" aria-busy="true" data-when="loading">Saving&hellip;</button>
      </form>
      <p class="foot2">Saving signs you out. Sign in again with the new password and you will land on Home.</p>
      <div class="note"><b>No sidebar, on purpose.</b> This is the one authenticated screen with no way out but through: the API refuses everything except <code>/auth/me</code> and this change while the flag is set, so a navigation rail here would be a rail of dead ends. It is also a new user&rsquo;s second interaction with the product, which is why Enter submitting matters more here than anywhere. The voluntary change lives under Settings &rsaquo; Profile and is a different screen.</div>
    </div></div>
  </div>
</section>

<!-- ==================== SESSION EXPIRING ==================== -->

<section class="screen" id="s-expiring" data-on="0">
  <div class="shell" style="filter:blur(1.5px);opacity:.6" aria-hidden="true">
@@DESK:home@@
    <div class="main"><div class="topbar"><span class="crumb"><b>Home</b></span></div>
      <div class="work"><div class="pgh"><h1>Good afternoon, Olivia</h1></div><div class="kpis"><div class="kpi" style="height:120px"></div><div class="kpi"></div><div class="kpi"></div><div class="kpi"></div></div><div class="panel" style="height:280px"></div></div></div>
  </div>
  <div class="cp-back">
    <div class="gate" role="alertdialog" aria-modal="true" aria-labelledby="p-ex-title" aria-describedby="p-ex-body">
      <div class="insp-head" style="padding-left:0;padding-right:0">
        <div class="eyebrow">Still there?</div>
        <h2 id="p-ex-title">Your session is about to expire</h2>
      </div>
      <p class="sm sec" id="p-ex-body" style="margin:var(--s-md) 0">You will be signed out in <strong class="count" aria-live="polite">1:58</strong> due to inactivity.</p>
      <p class="cap muted" style="margin:0 0 var(--s-md)">Any click, key, scroll or touch counts as activity, in this tab or another. Staying signed in resets the idle clock; it does not extend the eight-hour limit on a session.</p>
      <div style="display:flex;gap:var(--s-xs);justify-content:flex-end">
        <button class="btn" data-go="s-returned">Sign out</button>
        <button class="btn pri" data-go="comp-p-focus-roadmap.html#s-home">Stay signed in</button>
      </div>
    </div>
  </div>
</section>

<!-- ==================== VIEW AS: PICKER ==================== -->

<section class="screen" id="s-viewas" data-on="0">
  <div class="shell insp" data-roles="SiteAdmin OrgAdmin">
@@DESK:home@@
    <div class="main">
      <div class="topbar"><span class="crumb"><b>Home</b></span><span class="spacer"></span>
        <button class="btn" aria-pressed="true">View as&hellip;</button><button class="btn pri">New idea</button></div>
      <div class="work">
        <div class="pgh" data-roles="SiteAdmin"><div class="grow"><h1>Good afternoon, Sam</h1>
          <div class="sub">Two organizations, 41 ideas, 16 delivery issues. You are not a member of any of them &mdash; to change what they own, act as one of their administrators.</div></div></div>
        <div class="pgh" data-roles="OrgAdmin"><div class="grow"><h1>Good afternoon, Olivia</h1>
          <div class="sub">Here&rsquo;s what needs you today. Acme Robotics has 22 ideas across 2 boards and 16 delivery issues in flight.</div></div></div>
        <div class="note"><b>Two entry points, one surface.</b> The <em>View as&hellip;</em> control sits in the page header on every signed-in screen and again in the avatar menu; both open this docked picker. The list is server-filtered, so the client never reproduces the rule about who may act as whom: a Site Admin is offered every active user in every organization except other Site Admins, an Org Admin only their own organization. Inactive accounts stay visible and cannot be chosen.</div>
      </div>
    </div>
    <aside class="inspector" aria-label="View as another user">
      <div class="insp-head">
        <div class="eyebrow">View as</div>
        <h2>View as another user</h2>
        <div class="meta">Browse Collega exactly as they see it. A banner stays on screen the whole time; exit in one click.</div>
      </div>
      <div class="insp-body">
        <div class="field" style="margin:0">
          <label for="p-va-q">Search users</label>
          <input type="search" id="p-va-q" placeholder="Search by name or email" autocomplete="off">
        </div>
        <div data-when="loading" aria-busy="true"><span class="skel w60"></span><span class="skel w80"></span><span class="skel w40"></span><span class="skel w80"></span></div>
        <div data-when="error"><div class="alert" role="alert"><span><b>Could not load users.</b> Retrying is safe.</span></div></div>
        <p class="sm muted" data-when="empty" style="margin:0">No users match that search.</p>
        <div data-when="normal">
          <div class="vaorg">Acme Robotics</div>
          <button class="cand"><span class="av s">OA</span><span class="grow"><b>Olivia Administer</b><span class="em">olivia@acmerobotics.com</span></span><span class="cap faint">Org Admin</span></button>
          <button class="cand" data-go="s-viewing"><span class="av s">NC</span><span class="grow"><b>Noah Contributor</b><span class="em">noah@acmerobotics.com</span></span><span class="cap faint">User</span></button>
          <button class="cand"><span class="av s">MC</span><span class="grow"><b>Maya Collaborator</b><span class="em">maya@acmerobotics.com</span></span><span class="cap faint">User</span></button>
          <button class="cand"><span class="av s">UM</span><span class="grow"><b>Umar Mensah</b><span class="em">umar@acmerobotics.com</span></span><span class="cap faint">User</span></button>
          <button class="cand"><span class="av s">RV</span><span class="grow"><b>Rae Vance</b><span class="em">rae@acmerobotics.com</span></span><span class="cap faint">Read Only</span></button>
          <button class="cand" aria-disabled="true" title="This account is inactive and cannot be viewed as."><span class="av s">JP</span><span class="grow"><b>Jordan Park</b><span class="em">jordan@acmerobotics.com</span></span><span class="cap faint">User &middot; inactive</span></button>
          <div data-roles="SiteAdmin">
            <div class="vaorg">Globex Industrial</div>
            <button class="cand"><span class="av s">LT</span><span class="grow"><b>Lena Torres</b><span class="em">lena@globex.example</span></span><span class="cap faint">Org Admin</span></button>
            <button class="cand"><span class="av s">DK</span><span class="grow"><b>Dev Kapoor</b><span class="em">dev@globex.example</span></span><span class="cap faint">User</span></button>
            <button class="cand"><span class="av s">PS</span><span class="grow"><b>Priya Shah</b><span class="em">priya@globex.example</span></span><span class="cap faint">Read Only</span></button>
          </div>
        </div>
      </div>
      <div class="insp-foot" style="align-items:center">
        <span class="cap faint grow" data-roles="SiteAdmin">Every organization, active users only. Other Site Admins are not offered.</span>
        <span class="cap faint grow" data-roles="OrgAdmin">Acme Robotics only, active users.</span>
        <button class="btn">Close</button>
      </div>
    </aside>
  </div>
  <div class="shell" data-roles="User ReadOnly">
@@DESK:home@@
    <div class="main">
      <div class="topbar"><span class="crumb"><b>Home</b></span><span class="spacer"></span><button class="btn pri" data-roles="User">New idea</button></div>
      <div class="work">
        <div class="pgh"><div class="grow"><h1>Not available</h1><div class="sub">View As is not offered to members.</div></div></div>
        <div class="empty">
          <h3>Acting as someone else is an administrator&rsquo;s tool</h3>
          <p>Only a Site Admin or an Org Admin can browse Collega as another user. For your role the control is hidden <em>and</em> the route is refused &mdash; both, not either &mdash; so there is nothing here to find.</p>
          <a class="btn" href="#" data-go="comp-p-focus-roadmap.html#s-home">Back to Home</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ==================== VIEWING AS: THE BANNER ==================== -->

<section class="screen" id="s-viewing" data-on="0">
  <div class="shell" data-roles="SiteAdmin OrgAdmin">
@@DESKAS:home@@
    <div class="main">
      <div class="banner" role="status" aria-live="polite" data-roles="OrgAdmin"><span><b>Viewing as Noah Contributor</b> &mdash; you&rsquo;re seeing exactly what they see. Anything you do is recorded as Olivia Administer acting as them.</span><button class="btn">Exit view-as</button></div>
      <div class="banner" role="status" aria-live="polite" data-roles="SiteAdmin"><span><b>Viewing as Noah Contributor</b> &mdash; you&rsquo;re seeing exactly what they see. Anything you do is recorded as Sam Aldridge acting as them.</span><button class="btn">Exit view-as</button></div>
      <div class="topbar"><span class="crumb"><b>Home</b></span><span class="spacer"></span><button class="btn pri">New idea</button></div>
      <div class="work">
        <div class="pgh"><div class="grow"><h1>Good afternoon, Noah</h1>
          <div class="sub">Here&rsquo;s what needs you today. Acme Robotics has 22 ideas across 2 boards and 16 delivery issues in flight &mdash; press <span class="kbd">Ctrl K</span> to jump straight to any of them.</div></div></div>
        <div class="kpis">
          <div class="kpi"><div class="k">Open ideas</div><div class="v num">14</div><div class="d">of 22 total</div><div class="why">Anything not yet Complete or Archived, on any board you can see.</div></div>
          <div class="kpi"><div class="k">Awaiting review</div><div class="v num">4</div><div class="d">2 over 7 days</div><div class="why">Sitting in In Review, waiting on a decision from a person.</div></div>
          <div class="kpi"><div class="k">Assigned to me</div><div class="v num">3</div><div class="d">none critical</div><div class="why">Open ideas with your name in the Assigned field.</div></div>
          <div class="kpi"><div class="k">Completed &middot; 30d</div><div class="v num">6</div><div class="d">+2 vs prior</div><div class="why">Reached Complete in the last 30 days, against the 30 days before it.</div></div>
        </div>
        <div class="note"><b>Act-as, not preview.</b> Every control on this page is live, because View As is the Site Admin&rsquo;s only way to change organization content. The rail shows Noah, the header&rsquo;s own <em>View as&hellip;</em> control is gone (a session cannot be nested), and role-gated surfaces render for Noah&rsquo;s role &mdash; which is why <em>Settings</em> would show him only his profile. The banner is drawn from the server&rsquo;s answer to <code>/auth/me</code>, never from remembered state, so an expired View As session (30 minutes idle, 2 hours absolute &mdash; the sign-in itself keeps its own 8-hour limit) cannot leave a stale banner behind. Authorship on anything saved is Noah&rsquo;s; the audit row names both people.</div>
      </div>
    </div>
  </div>
  <div class="shell" data-roles="User ReadOnly">
@@DESK:home@@
    <div class="main">
      <div class="topbar"><span class="crumb"><b>Home</b></span><span class="spacer"></span><button class="btn pri" data-roles="User">New idea</button></div>
      <div class="work">
        <div class="pgh"><div class="grow"><h1>Not available</h1><div class="sub">View As is not offered to members.</div></div></div>
        <div class="empty">
          <h3>Acting as someone else is an administrator&rsquo;s tool</h3>
          <p>Only a Site Admin or an Org Admin can browse Collega as another user. For your role the control is hidden <em>and</em> the route is refused &mdash; both, not either &mdash; so there is nothing here to find.</p>
          <a class="btn" href="#" data-go="comp-p-focus-roadmap.html#s-home">Back to Home</a>
        </div>
      </div>
    </div>
  </div>
</section>

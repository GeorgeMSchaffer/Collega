<section class="screen" id="s-settings" data-on="0"><div class="shell">
@@DESK:settings@@
  <div class="main">
    <div class="topbar"><span class="crumb"><a href="#">Settings</a> / <b>Statuses</b></span><span class="spacer"></span>
      <button class="btn pri" data-roles="SiteAdmin OrgAdmin">Add status</button>
      <span class="deniedwrap" data-roles="User ReadOnly">
        <button class="btn pri" aria-disabled="true" aria-describedby="p-why-add">Add status</button>
        <span class="denied" id="p-why-add">Administrators only</span>
      </span></div>
    <div class="work">
      <div class="pgh"><div class="grow"><h1>Statuses</h1>
        <div class="sub">The columns your boards group ideas by. Order here is the order on every board.</div></div></div>
      <div class="cols" style="grid-template-columns:minmax(0,1fr) auto">
        <div class="panel">
          <table data-when="normal">
            <thead><tr><th style="width:36px"><span class="faint">Drag</span></th><th>Name</th><th style="width:168px">Colour</th><th style="width:74px">Ideas</th><th style="width:74px">Order</th><th style="width:66px"></th></tr></thead>
            <tbody>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>New / Pending</b></td><td><span class="marker"><span class="dot" style="background:var(--sky)"></span>Sky</span></td><td class="num">6</td><td class="num">1</td><td><button class="btn ghost sm2" data-roles="SiteAdmin OrgAdmin">Edit</button><button class="btn ghost sm2" data-roles="User ReadOnly" aria-disabled="true" aria-describedby="p-why-add">Edit</button></td></tr>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>In Review</b></td><td><span class="marker"><span class="dot" style="background:var(--purple)"></span>Purple</span></td><td class="num">4</td><td class="num">2</td><td><button class="btn ghost sm2" data-roles="SiteAdmin OrgAdmin">Edit</button><button class="btn ghost sm2" data-roles="User ReadOnly" aria-disabled="true" aria-describedby="p-why-add">Edit</button></td></tr>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>In Progress</b></td><td><span class="marker"><span class="dot" style="background:var(--orange)"></span>Orange</span></td><td class="num">4</td><td class="num">3</td><td><button class="btn ghost sm2" data-roles="SiteAdmin OrgAdmin">Edit</button><button class="btn ghost sm2" data-roles="User ReadOnly" aria-disabled="true" aria-describedby="p-why-add">Edit</button></td></tr>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>Client Review</b></td><td><span class="marker"><span class="dot" style="background:var(--pink)"></span>Pink</span></td><td class="num">2</td><td class="num">4</td><td><button class="btn ghost sm2" data-roles="SiteAdmin OrgAdmin">Edit</button><button class="btn ghost sm2" data-roles="User ReadOnly" aria-disabled="true" aria-describedby="p-why-add">Edit</button></td></tr>
              <tr><td><span class="hnd" aria-hidden="true">&#8942;&#8942;</span></td><td><b>Complete</b></td><td><span class="marker"><span class="dot" style="background:var(--green)"></span>Green</span></td><td class="num">6</td><td class="num">5</td><td><button class="btn ghost sm2" data-roles="SiteAdmin OrgAdmin">Edit</button><button class="btn ghost sm2" data-roles="User ReadOnly" aria-disabled="true" aria-describedby="p-why-add">Edit</button></td></tr>
            </tbody>
          </table>
          <div class="pgfoot" data-when="normal"><span>Reorder by dragging, or focus a row and press <span class="kbd">Alt &uarr;</span> / <span class="kbd">Alt &darr;</span>.</span></div>

          <table data-when="loading" aria-busy="true">
            <thead><tr><th style="width:36px"></th><th>Name</th><th style="width:168px">Colour</th><th style="width:74px">Ideas</th><th style="width:74px">Order</th><th style="width:66px"></th></tr></thead>
            <tbody>
              <tr><td></td><td><span class="skel w60"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td></td></tr>
              <tr><td></td><td><span class="skel w80"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td></td></tr>
              <tr><td></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td></td></tr>
              <tr><td></td><td><span class="skel w60"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td></td></tr>
              <tr><td></td><td><span class="skel w80"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td><span class="skel w40"></span></td><td></td></tr>
            </tbody>
          </table>

          <div data-when="empty" style="padding:var(--s-lg)">
            <div class="empty">
              <h3>No statuses yet</h3>
              <p>Statuses are the columns your boards group ideas by. Add the first one and every board in Acme Robotics gets that lane.</p>
              <button class="btn pri" data-roles="SiteAdmin OrgAdmin">Add the first status</button>
              <button class="btn" data-roles="SiteAdmin OrgAdmin">Use the five defaults</button>
              <span class="denied" data-roles="User ReadOnly">An administrator sets these up.</span>
            </div>
          </div>

          <div data-when="error" style="padding:var(--s-lg)">
            <div class="alert" role="alert"><span><b>Couldn&rsquo;t load statuses.</b> The request failed before anything was returned, so nothing here is out of date &mdash; it is simply absent. Retrying is safe.</span></div>
            <div style="margin-top:var(--s-md)"><button class="btn">Retry</button></div>
          </div>
        </div>

        <div class="card" data-roles="SiteAdmin OrgAdmin" style="width:356px">
          <h3 style="font-size:20px;font-weight:600;letter-spacing:-.125px;line-height:1.4;margin:0 0 var(--s-md)">Add status</h3>
          <form>
            <div class="field" data-when="normal empty loading"><label for="p-sname">Name <span class="req" aria-hidden="true">*</span></label><input type="text" id="p-sname" required><div class="hint">Shown as a lane header on every board.</div></div>
            <div class="field bad" data-when="error"><label for="p-sname2">Name <span class="req" aria-hidden="true">*</span></label><input type="text" id="p-sname2" value="In Review" aria-describedby="p-sname2-msg" aria-invalid="true"><span class="msg" id="p-sname2-msg">A status called &ldquo;In Review&rdquo; already exists. Names are unique within an organization.</span></div>
            <div class="field"><label for="p-shex">Colour</label>
              <div style="display:flex;gap:var(--s-xs)"><input type="text" id="p-shex" value="#62aef0" style="flex:1"><input type="color" value="#62aef0" aria-label="Pick colour visually" style="width:44px;padding:2px;height:36px;flex:none"></div>
              <div class="hint">Colour is decoration &mdash; the status name always shows beside it.</div></div>
            <div class="field"><label for="p-sord">Position</label><select id="p-sord"><option>Last</option><option>First</option><option>After New / Pending</option></select></div>
            <button type="submit" class="btn pri" style="width:100%;justify-content:center">Add status</button>
          </form>
        </div>
      </div>
      <div class="note"><b>Create is inline, not a drawer.</b> A short create form sits beside the list it adds to, so the list stays visible for reference and there is no overlay to trap focus in. Longer edits still open the docked inspector. The swatch picker offers the DESIGN.md sticker palette by name, which is why the Colour column reads &ldquo;Sky&rdquo; rather than a hex value.</div>
      <div class="note"><b>This screen is the worked example for the shared mechanisms.</b> The role control gates the create form and swaps every live Edit button for a disabled twin carrying a reason; the state control swaps the table for skeletons, an empty state, or a failed load. Denied controls use <code>aria-disabled</code> with <code>aria-describedby</code> rather than the <code>disabled</code> attribute, so they stay in the tab order and announce why they are refused.</div>
    </div>
  </div>
</div></section>

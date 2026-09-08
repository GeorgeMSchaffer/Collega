<nav class="switch" aria-label="Comp screens">
  <b>Comp O-1</b><span class="lbl">Board · DESIGN.md applied</span>
  <button data-go="s-board" aria-current="true">Swimlanes</button>
  <button data-go="s-list">List</button>
  <button data-go="s-empty">Empty state</button>
</nav>
<div class="explore"><b>Direction probe</b><span>Built on <b>DESIGN.md</b> (Notion analysis) — Inter, #0075de, pill CTAs, 12px cards. This <b>contradicts</b> locked Collega canon (Geist, #527292, 2px radii) and changes nothing in <code>SPEC/</code>. For comparison only.</span></div>

<section class="screen" id="s-board" data-on="1"><div class="shell">
@@SIDE:boards@@
  <div class="main">
    <div class="topbar"><span class="crumb">Boards / <b>Product Ideas</b></span><span class="spacer"></span>
      <div class="seg"><button aria-pressed="true">Swimlanes</button><button aria-pressed="false" data-go="s-list">List</button></div>
      <button class="btn">Configure</button><button class="btn pri">New idea</button></div>
    <div class="body" style="max-width:none">
      <div class="pagehead"><div class="grow"><h1>Product Ideas</h1>
        <p>48 ideas, sorted by upvotes within each status. You are signed in as <b>User</b> — you can create ideas and move any idea on this board.</p></div></div>
      <div class="cmdbar">
        <input type="text" placeholder="Filter ideas…" style="width:260px">
        <select><option>Priority: All</option></select>
        <select><option>Tag: All</option></select>
        <span class="spacer"></span><span class="cap faint">Drag a card to change its status</span>
      </div>
      <div class="lanes">
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--sky)"></span><span class="t">New / Pending</span><span class="ct">4</span></div>
          <div class="kcard"><span class="t">Dark mode support</span>
            <p class="d">Users working late want a dark theme that respects the OS preference by default.</p>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span><span class="tag">ui</span><span class="av s">MP</span><button class="up mine">▲ 24</button></div></div>
          <div class="kcard"><span class="t">Bulk import from CSV</span>
            <p class="d">Bring an existing backlog in without re-typing every row.</p>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="tag">data</span><span class="av s">TD</span><button class="up">▲ 17</button></div></div>
          <div class="kcard"><span class="t">Keyboard shortcuts cheat sheet</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="tag">docs</span><span class="av s">—</span><button class="up">▲ 6</button></div></div>
          <div class="kcard"><span class="t">Export board to PDF</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="tag">reporting</span><span class="av s">JR</span><button class="up">▲ 5</button></div></div>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--purple)"></span><span class="t">In Review</span><span class="ct">1</span></div>
          <div class="kcard"><span class="t">Mobile responsive board</span>
            <p class="d">Swimlanes collapse to a single scrollable column below 600px.</p>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span><span class="tag">ui</span><span class="av s">TD</span><button class="up">▲ 20</button></div></div>
          <div class="emptylane">Drop here to move an idea into review</div>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--orange)"></span><span class="t">In Progress</span><span class="ct">3</span></div>
          <div class="kcard"><span class="t">SSO via SAML</span>
            <p class="d">Enterprise pilots are blocked without it.</p>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span><span class="tag">auth</span><span class="av s">AL</span><button class="up">▲ 31</button></div></div>
          <div class="kcard"><span class="t">Notification digest email</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="tag">notify</span><span class="av s">JR</span><button class="up mine">▲ 12</button></div></div>
          <div class="kcard"><span class="t">Mention autocomplete</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="tag">ui</span><span class="av s">MP</span><button class="up">▲ 9</button></div></div>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--pink)"></span><span class="t">Client Review</span><span class="ct">1</span></div>
          <div class="kcard"><span class="t">Org-scoped user search</span>
            <div class="ft"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="av s">AL</span><button class="up">▲ 14</button></div></div>
          <div class="emptylane">Nothing awaiting the client</div>
        </div>
        <div class="lane">
          <div class="lanehd"><span class="dot" style="background:var(--green)"></span><span class="t">Complete</span><span class="ct">1</span></div>
          <div class="kcard" style="background:var(--canvas-soft)"><span class="t">Audit log for admin actions</span>
            <div class="ft"><span class="marker"><span class="dot"></span>Low</span><span class="av s">JR</span><button class="up">▲ 8</button></div></div>
        </div>
      </div>
      <div class="note"><b>Where the two systems meet.</b> DESIGN.md forbids colour that structures a layout, but explicitly permits the sticker palette as <i>category dots</i>. Status therefore lives in an 8px dot with the status name always written beside it — which also satisfies Collega&rsquo;s rule that colour never carries meaning alone. Lane headers are plain type on the warm canvas rather than the tinted bands used in comps A&ndash;N.</div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-list" data-on="0"><div class="shell">
@@SIDE:boards@@
  <div class="main">
    <div class="topbar"><span class="crumb">Boards / <b>Product Ideas</b></span><span class="spacer"></span>
      <div class="seg"><button aria-pressed="false" data-go="s-board">Swimlanes</button><button aria-pressed="true">List</button></div>
      <button class="btn">Configure</button><button class="btn pri">New idea</button></div>
    <div class="body">
      <div class="pagehead"><div class="grow"><h1>Product Ideas</h1>
        <p>The same 10 ideas as a document rather than a board. This is the layout Notion&rsquo;s system is happiest with.</p></div></div>
      <div class="lanesec"><div class="hd"><span class="dot" style="background:var(--sky)"></span><span class="t">New / Pending</span><span class="ct">4 ideas</span></div>
        <div class="card flush">
          <div class="rowcard"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span><span class="t grow">Dark mode support</span><span class="tag">ui</span><span class="tag">theme</span><span class="av s">MP</span><button class="up mine">▲ 24</button></div>
          <div class="rowcard"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="t grow">Bulk import from CSV</span><span class="tag">data</span><span class="av s">TD</span><button class="up">▲ 17</button></div>
          <div class="rowcard"><span class="marker"><span class="dot"></span>Low</span><span class="t grow">Keyboard shortcuts cheat sheet</span><span class="tag">docs</span><span class="av s">—</span><button class="up">▲ 6</button></div>
          <div class="rowcard"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="t grow">Export board to PDF</span><span class="tag">reporting</span><span class="av s">JR</span><button class="up">▲ 5</button></div>
        </div></div>
      <div class="lanesec"><div class="hd"><span class="dot" style="background:var(--orange)"></span><span class="t">In Progress</span><span class="ct">3 ideas</span></div>
        <div class="card flush">
          <div class="rowcard"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span><span class="t grow">SSO via SAML</span><span class="tag">auth</span><span class="av s">AL</span><button class="up">▲ 31</button></div>
          <div class="rowcard"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="t grow">Notification digest email</span><span class="tag">notify</span><span class="av s">JR</span><button class="up mine">▲ 12</button></div>
          <div class="rowcard"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="t grow">Mention autocomplete</span><span class="tag">ui</span><span class="av s">MP</span><button class="up">▲ 9</button></div>
        </div></div>
      <div class="lanesec"><div class="hd"><span class="dot" style="background:var(--green)"></span><span class="t">Complete</span><span class="ct">1 idea</span></div>
        <div class="card flush" style="background:var(--canvas-soft)">
          <div class="rowcard"><span class="marker"><span class="dot"></span>Low</span><span class="t grow">Audit log for admin actions</span><span class="av s">JR</span><button class="up">▲ 8</button></div>
        </div></div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-empty" data-on="0"><div class="shell">
@@SIDE:boards@@
  <div class="main">
    <div class="topbar"><span class="crumb">Acme Robotics / <b>Boards</b></span><span class="spacer"></span><button class="btn pri">New board</button></div>
    <div class="body">
      <div class="hero">
        <span class="star" style="width:6px;height:6px;background:var(--pink);left:12%;top:22%"></span>
        <span class="star" style="width:10px;height:10px;background:var(--sky);left:22%;top:64%"></span>
        <span class="star" style="width:7px;height:7px;background:var(--purple);left:80%;top:28%"></span>
        <span class="star" style="width:5px;height:5px;background:var(--green);left:88%;top:70%"></span>
        <span class="star" style="width:8px;height:8px;background:var(--orange);left:70%;top:80%"></span>
        <h1>A blank board</h1>
        <p>Acme Robotics has no boards yet. A board holds ideas and arranges them by status — start with one and add swimlanes as the work takes shape.</p>
        <div class="ctas"><button class="btn pri">Create your first board</button><button class="btn sec2">Import from CSV</button></div>
      </div>
      <div class="note"><b>The one dark island.</b> DESIGN.md reserves the deep indigo <code>#213183</code> band for a single hero moment per page, never a repeated rhythm. In a marketing site that is the homepage hero; in Collega the honest equivalent is the first-run empty state — the only screen in the app with nothing to structure. Every other screen stays on the warm canvas.</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s-md);margin-top:var(--s-lg)">
        <div class="card"><h3 style="margin-bottom:var(--s-xs)">Ideas</h3><p class="sm muted" style="margin:0">Anyone in the org can propose one. Upvotes decide the order inside a lane.</p></div>
        <div class="card"><h3 style="margin-bottom:var(--s-xs)">Statuses</h3><p class="sm muted" style="margin:0">Org-wide, reused across boards. Pick which appear here and in what order.</p></div>
        <div class="card"><h3 style="margin-bottom:var(--s-xs)">Delivery</h3><p class="sm muted" style="margin:0">Promote an idea to an issue when it is ready to be worked.</p></div>
      </div>
    </div>
  </div>
</div></section>

<nav class="switch" aria-label="Comp screens">
  <b>Comp O-2</b><span class="lbl">Idea detail · DESIGN.md applied</span>
  <button data-go="s-idea" aria-current="true">Idea detail</button>
  <button data-go="s-new">New idea (slideout)</button>
  <button data-go="s-confirm">Modal &amp; toast</button>
</nav>
<div class="explore"><b>Direction probe</b><span>Built on <b>DESIGN.md</b> (Notion analysis) — Inter, #0075de, pill CTAs, 12px cards, 4px inputs. This <b>contradicts</b> locked Collega canon and changes nothing in <code>SPEC/</code>. For comparison only.</span></div>

<section class="screen" id="s-idea" data-on="1"><div class="shell">
@@SIDE:ideas@@
  <div class="main">
    <div class="topbar"><span class="crumb">Boards / Product Ideas / <b>IDEA-128</b></span><span class="spacer"></span>
      <button class="up mine" style="margin:0">▲ Upvoted · 24</button><button class="btn">Close idea</button></div>
    <div class="body">
      <div style="margin-bottom:var(--s-lg)">
        <div class="chipbar" style="margin-bottom:var(--s-sm)">
          <span class="marker"><span class="dot" style="background:var(--orange)"></span>In Progress</span>
          <span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium priority</span>
          <span class="badge">IDEA-128</span>
        </div>
        <h1 style="max-width:22ch">Dark mode support</h1>
        <p class="sm muted" style="margin-top:var(--s-sm)">Proposed by <b class="sec">Tom Diaz</b> on 2 July · updated 20 minutes ago</p>
      </div>
      <div class="ideabody">
        <div>
          <div style="margin-bottom:var(--s-lg)">
            <label>Title</label>
            <input type="text" style="width:100%;font-size:16px" value="Dark mode support">
            <div class="charcount">18 / 150</div>
          </div>
          <div style="margin-bottom:var(--s-xxl)">
            <label>Description</label>
            <textarea style="width:100%;min-height:104px" class="prose">Users working late hours have asked for a dark theme. It should respect the operating-system preference by default and allow a manual override from the profile menu.</textarea>
            <div class="charcount">142 / 4000</div>
          </div>
          <h2 style="margin-bottom:var(--s-xs)">Discussion</h2>
          <p class="cap faint" style="margin-bottom:var(--s-xs)">4 comments</p>
          <div class="comment"><div class="by"><span class="av s">MP</span><span class="who">Mia Park</span><span class="when">2 hours ago</span></div>
            <p><span class="mention">@Jordan Reyes</span> can we scope this to the board view first? Full app theming is a bigger lift.</p></div>
          <div class="comment"><div class="by"><span class="av s">TD</span><span class="who">Tom Diaz</span><span class="when">1 hour ago</span></div>
            <p>+1 — the design tokens should make this straightforward.</p></div>
          <div class="comment"><div class="by"><span class="av s">AL</span><span class="who">Ana Lopez</span><span class="when">40 minutes ago</span></div>
            <p>Worth checking contrast on the status dots before we commit — the pastel end of the palette will not survive an inverted canvas.</p></div>
          <div style="display:flex;gap:var(--s-sm);padding-top:var(--s-md);border-top:1px solid var(--hairline)">
            <span class="av s">JR</span>
            <div style="flex:1">
              <textarea style="width:100%;min-height:76px" placeholder="Join the discussion… type @ to mention someone in Acme Robotics">Agreed — </textarea>
              <div class="charcount">9 / 2000</div>
              <button class="btn pri" style="margin-top:6px">Post comment</button>
            </div>
          </div>
        </div>
        <aside class="facts">
          <div class="fact"><div class="k">Status</div><div class="v"><select><option>New</option><option selected>In Progress</option><option>Blocked</option><option>Done</option></select></div></div>
          <div class="fact"><div class="k">Priority</div><div class="v"><select><option>High</option><option selected>Medium</option><option>Low</option></select></div></div>
          <div class="fact"><div class="k">Assignee</div><div class="v"><select><option>Unassigned</option><option selected>Mia Park</option><option>Jordan Reyes</option></select></div></div>
          <div class="fact"><div class="k">Due date</div><div class="v"><input type="text" value="15 Aug 2026"></div></div>
          <div class="fact"><div class="k">Tags · 2 of 10</div><div class="v chipbar"><span class="tag">ui</span><span class="tag">theme</span><button class="btn sm2">+ add</button></div></div>
          <div class="fact"><div class="k">Upvotes</div><div class="v">24 people <span class="avstack" style="vertical-align:middle;margin-left:6px"><span class="av s">MP</span><span class="av s">TD</span><span class="av s">AL</span><span class="av s">+21</span></span></div></div>
          <div class="fact"><div class="k">Board</div><div class="v">Product Ideas</div></div>
        </aside>
      </div>
      <div class="note"><b>The best fit of the three.</b> A single idea is a document, which is exactly what this system was drawn for: warm canvas, white fields, 16px body at 1.5, and heavy tightly-tracked headings. The 40px <code>heading-1</code> with &minus;1px tracking does real work here — it is the first screen where Notion&rsquo;s type voice reads as an improvement rather than a translation.</div>
    </div>
  </div>
</div></section>

<section class="screen" id="s-new" data-on="0"><div class="shell">
@@SIDE:ideas@@
  <div class="main">
    <div class="topbar"><span class="crumb">Boards / <b>Product Ideas</b></span><span class="spacer"></span><button class="btn">Configure</button><button class="btn pri">New idea</button></div>
    <div class="body">
      <div class="pagehead"><div class="grow"><h1>Product Ideas</h1><p>The slideout keeps the board in view behind it, so an author can see where their idea will land.</p></div></div>
      <div class="lanesec"><div class="hd"><span class="dot" style="background:var(--sky)"></span><span class="t">New / Pending</span><span class="ct">4 ideas</span></div>
        <div class="card flush">
          <div class="rowcard"><span class="marker"><span class="dot" style="background:var(--orange)"></span>High</span><span class="t grow">Dark mode support</span><span class="av s">MP</span><button class="up mine">▲ 24</button></div>
          <div class="rowcard"><span class="marker"><span class="dot" style="background:var(--sky)"></span>Medium</span><span class="t grow">Bulk import from CSV</span><span class="av s">TD</span><button class="up">▲ 17</button></div>
          <div class="rowcard"><span class="marker"><span class="dot"></span>Low</span><span class="t grow">Keyboard shortcuts cheat sheet</span><span class="av s">—</span><button class="up">▲ 6</button></div>
        </div></div>
    </div>
  </div>
</div>
<div class="scrim"></div>
<aside class="drawer">
  <div style="display:flex;align-items:flex-start;gap:var(--s-md);margin-bottom:var(--s-lg)">
    <div class="grow"><h2>New idea</h2><p class="sm muted" style="margin:6px 0 0">It will land in <b class="sec">New / Pending</b> on Product Ideas.</p></div>
    <button class="iconbtn" data-go="s-idea">✕</button>
  </div>
  <div style="margin-bottom:var(--s-md)"><label>Title</label>
    <input type="text" style="width:100%" placeholder="One line — what should change?" value="Saved filter views">
    <div class="charcount">18 / 150</div></div>
  <div style="margin-bottom:var(--s-md)"><label>Description</label>
    <textarea style="width:100%;min-height:120px" placeholder="What problem does this solve, and for whom?">People rebuild the same three filters every morning. Let them save a filter set and pin it to the board header.</textarea>
    <div class="charcount">108 / 4000</div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-md);margin-bottom:var(--s-md)">
    <div><label>Priority</label><select style="width:100%"><option>High</option><option selected>Medium</option><option>Low</option></select></div>
    <div><label>Assignee</label><select style="width:100%"><option selected>Unassigned</option><option>Mia Park</option></select></div>
  </div>
  <div style="margin-bottom:var(--s-lg)"><label>Tags · 1 of 10</label>
    <div class="chipbar"><span class="tag">ui</span><button class="btn sm2">+ add</button></div></div>
  <div style="display:flex;gap:var(--s-sm);padding-top:var(--s-md);border-top:1px solid var(--hairline)">
    <button class="btn pri">Create idea</button><button class="btn sec2" data-go="s-idea">Cancel</button>
    <span class="spacer"></span><span class="cap faint" style="align-self:center">Esc to close</span></div>
  <div class="note" style="margin-top:var(--s-lg)"><b>Inputs stay tight.</b> DESIGN.md is explicit that pill radii never go on form fields — 4px here against the fully-pill <b>Create idea</b> button. That contrast is the system&rsquo;s signature and it survives the move into an app unchanged.</div>
</aside></section>

<section class="screen" id="s-confirm" data-on="0"><div class="shell">
@@SIDE:ideas@@
  <div class="main">
    <div class="topbar"><span class="crumb">Boards / Product Ideas / <b>IDEA-128</b></span><span class="spacer"></span><button class="btn">Close idea</button></div>
    <div class="body">
      <div class="pagehead"><div class="grow"><h1>Dark mode support</h1><p>Elevation levels 1 and 2, and the two feedback surfaces the app needs.</p></div></div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s-lg);align-items:start">
        <div>
          <p class="eyebrow muted" style="margin-bottom:var(--s-xs)">LEVEL 2 — MODAL</p>
          <div class="modal">
            <h3 style="margin-bottom:var(--s-xs)">Move to Complete?</h3>
            <p class="sm muted">This idea has 3 open tasks. Moving it to <b class="sec">Complete</b> will not close them — tasks never block a status change.</p>
            <ul class="tasks" style="margin-bottom:var(--s-md)">
              <li><span class="box on"></span><span class="done grow">Audit token contrast</span><span class="av s">MP</span></li>
              <li><span class="box"></span><span class="grow">Wire the OS preference listener</span><span class="av s">TD</span></li>
              <li><span class="box"></span><span class="grow">Update the screenshots in docs</span><span class="av s">—</span></li>
            </ul>
            <div style="display:flex;gap:var(--s-sm)"><button class="btn pri">Move to Complete</button><button class="btn sec2">Keep In Progress</button></div>
          </div>
          <p class="eyebrow muted" style="margin:var(--s-lg) 0 var(--s-xs)">LEVEL 2 — TOAST</p>
          <div class="toast"><span class="dot" style="background:var(--green)"></span><span class="grow">Moved to <b>Complete</b>.</span><a href="#">Undo</a></div>
        </div>
        <div>
          <p class="eyebrow muted" style="margin-bottom:var(--s-xs)">LEVEL 0 — FLAT (HAIRLINE ONLY)</p>
          <div class="card"><h3 style="margin-bottom:var(--s-xs)">Default card</h3>
            <p class="sm muted" style="margin:0">Most surfaces sit flat on the warm canvas with a hairline and no shadow at all. This is the default, not the exception.</p></div>
          <p class="eyebrow muted" style="margin:var(--s-lg) 0 var(--s-xs)">LEVEL 1 — SOFT</p>
          <div class="card raised"><h3 style="margin-bottom:var(--s-xs)">Raised card</h3>
            <p class="sm muted" style="margin:0">Four near-transparent layers, the deepest at 4% over 18px. Gently lifted off the paper rather than dropped onto it.</p></div>
          <div class="note" style="margin-top:var(--s-lg)"><b>Elevation is barely there.</b> All three levels use stacked sub-5% shadows. On a dense internal screen the level-0/level-1 difference is close to invisible — which is the point in a marketing page and a genuine open question for an app that needs to signal what is draggable.</div>
        </div>
      </div>
    </div>
  </div>
</div></section>

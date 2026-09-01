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

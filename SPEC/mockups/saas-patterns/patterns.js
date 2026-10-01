(() => {
  const $ = (id) => document.getElementById(id);
  const text = (input) => input.value.trim();
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('collega-study-theme', theme);
    for (const button of document.querySelectorAll('[data-set-theme]')) {
      button.setAttribute('aria-pressed', String(button.dataset.setTheme === theme));
    }
  }
  for (const button of document.querySelectorAll('[data-set-theme]')) {
    button.addEventListener('click', () => setTheme(button.dataset.setTheme));
  }
  for (const button of document.querySelectorAll('[data-set-theme]')) {
    button.setAttribute('aria-pressed', String(button.dataset.setTheme === document.documentElement.dataset.theme));
  }
  const errors = {
    title: 'Add a title so teammates can recognize this idea.',
    problem: 'Describe what is going wrong and who it affects.',
    solution: 'Add at least one proposed solution.',
    impact: 'Explain why solving this matters.'
  };
  function validate(input, prefix) {
    const message = text(input) ? '' : errors[input.name];
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const output = $(prefix + input.name[0].toUpperCase() + input.name.slice(1) + '-error');
    if (output) output.textContent = message;
    return !message;
  }
  const backdrop = document.querySelector('.drawer-backdrop');
  function openDrawer(drawer, focus) {
    backdrop.hidden = false;
    drawer.hidden = false;
    document.querySelector('.shell').inert = true;
    document.querySelector('.review').inert = true;
    focus.focus();
  }
  async function closeDrawer(drawer, origin) {
    if (drawer.dataset.closing) return;
    drawer.dataset.closing = 'true';
    backdrop.classList.add('leaving');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await drawer.animate([
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: 'translateX(48px)' }
      ], { duration: 260, easing: 'cubic-bezier(.32,.72,0,1)' }).finished;
    }
    drawer.hidden = true;
    backdrop.hidden = true;
    backdrop.classList.remove('leaving');
    delete drawer.dataset.closing;
    document.querySelector('.shell').inert = false;
    document.querySelector('.review').inert = false;
    origin.focus();
  }
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const reveals = document.querySelectorAll('.stage > .opening, .stage > .inbox-head, .blueprint .stage > h1');
    for (const node of reveals) node.classList.add('reveal');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    }, { threshold: .08 });
    document.body.classList.add('motion-ready');
    for (const node of reveals) observer.observe(node);
  }
  if (document.body.dataset.flow === 'board') {
    const drawer = $('boardDrawer');
    const form = $('quickForm');
    let origin = $('startIdea');
    for (const id of ['startIdea', 'emptyAdd']) $(id).addEventListener('click', () => {
      origin = $(id);
      openDrawer(drawer, $('quickTitle'));
    });
    for (const id of ['closeBoard', 'cancelBoard']) $(id).addEventListener('click', () => closeDrawer(drawer, origin));
    drawer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDrawer(drawer, origin);
    });
    for (const input of form.querySelectorAll('[required]')) {
      input.addEventListener('blur', () => validate(input, 'quick'));
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true') validate(input, 'quick');
      });
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fields = [...form.querySelectorAll('[required]')];
      if (!fields.map((input) => validate(input, 'quick')).every(Boolean)) {
        fields.find((input) => input.getAttribute('aria-invalid') === 'true').focus();
        return;
      }
      const card = document.createElement('article');
      card.className = 'idea-card';
      const title = document.createElement('b');
      title.textContent = text($('quickTitle'));
      const meta = document.createElement('small');
      meta.textContent = 'New / Pending · Continuous Improvement · Medium priority';
      card.append(title, meta);
      $('board-empty').hidden = true;
      $('first-lane').append(card);
      const count = $('first-lane').querySelectorAll('.idea-card').length;
      $('new-count').textContent = String(count);
      $('board-count').textContent = count === 1 ? '1 idea' : `${count} ideas`;
      $('progress-idea').classList.add('done');
      $('progress-idea').querySelector('span').textContent = `${count} idea${count === 1 ? '' : 's'} added in this example`;
      form.reset();
      for (const input of fields) input.setAttribute('aria-invalid', 'false');
      closeDrawer(drawer, origin);
      $('board-announcement').textContent = 'Idea added to this prototype board only.';
    });
  }
  if (document.body.dataset.flow === 'idea') {
    const form = $('ideaForm');
    const required = [...form.querySelectorAll('input[required], textarea[required]')];
    function updatePreview() {
      $('preview-title').textContent = text($('ideaTitle')) || 'Your idea title will appear here.';
      $('preview-problem').textContent = text($('ideaProblem')) || 'The problem you describe will become the opening context.';
      $('preview-solution').textContent = text($('ideaSolution')) || 'Your proposed solution will appear here.';
      const ready = required.filter((input) => text(input)).length;
      $('progress-label').textContent = `${ready} of ${required.length} required text fields ready`;
      $('progress-fill').style.transform = `scaleX(${ready / required.length})`;
    }
    for (const input of required) {
      input.addEventListener('blur', () => validate(input, 'idea'));
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true') validate(input, 'idea');
        $('ideaSuccess').hidden = true;
        updatePreview();
      });
    }
    for (const button of document.querySelectorAll('.help')) button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      $(button.getAttribute('aria-controls')).hidden = expanded;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!required.map((input) => validate(input, 'idea')).every(Boolean)) {
        required.find((input) => input.getAttribute('aria-invalid') === 'true').focus();
        return;
      }
      $('ideaSuccess').hidden = false;
      $('ideaSuccess').scrollIntoView({ block: 'nearest' });
    });
    updatePreview();
  }
  if (document.body.dataset.flow === 'inbox') {
    const entries = [
      { actor: 'Noah Contributor', action: 'commented on', idea: 'Field service enablement: Reduce manual handoffs', time: 'Today', detail: 'A new comment was added to this idea.', read: false, following: true },
      { actor: 'Olivia Administer', action: 'moved to In Review', idea: 'Field service enablement: Pilot a faster review path', time: 'Yesterday', detail: 'This idea moved into the In Review lane.', read: false, following: true },
      { actor: 'Olivia Administer', action: 'mentioned you on', idea: 'Field service enablement: Improve exception visibility', time: 'Earlier', detail: 'You were mentioned in a comment on this idea.', read: true, following: false }
    ];
    let filter = 'all';
    let selected = -1;
    let loadingTimer;
    const drawer = $('inboxDrawer');
    function render() {
      $('inbox-entries').replaceChildren();
      const visible = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => filter === 'all' || !entry.read);
      $('inbox-entries').hidden = visible.length === 0;
      $('inbox-empty').hidden = visible.length !== 0;
      const unread = entries.filter((entry) => !entry.read).length;
      $('nav-unread').textContent = unread ? `· ${unread} unread` : '';
      $('markAll').disabled = unread === 0;
      $('filterAll').setAttribute('aria-pressed', String(filter === 'all'));
      $('filterUnread').setAttribute('aria-pressed', String(filter === 'unread'));
      for (const { entry, index } of visible) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `entry${entry.read ? '' : ' unread'}`;
        const stamp = document.createElement('span');
        stamp.className = 'stamp';
        stamp.setAttribute('aria-hidden', 'true');
        stamp.textContent = entry.read ? '○' : '•';
        const body = document.createElement('span');
        body.className = 'bodytext';
        body.textContent = `${entry.actor} ${entry.action} “${entry.idea}”`;
        const sub = document.createElement('small');
        sub.textContent = entry.read ? 'Read · open idea' : 'Unread · open idea';
        body.append(sub);
        const time = document.createElement('time');
        time.textContent = entry.time;
        button.append(stamp, body, time);
        button.addEventListener('click', () => {
          entry.read = true;
          selected = index;
          $('drawer-idea').textContent = entry.idea;
          $('drawer-message').textContent = `${entry.actor} · ${entry.detail}`;
          $('followToggle').setAttribute('aria-pressed', String(entry.following));
          $('followToggle').textContent = entry.following ? 'Following' : 'Follow idea';
          $('followStatus').textContent = entry.following ? 'Following this idea in the example state.' : 'Not following this idea in the example state.';
          render();
          openDrawer(drawer, $('closeInbox'));
          $('inbox-announcement').textContent = 'Notification marked read in this prototype.';
        });
        $('inbox-entries').append(button);
      }
    }
    $('filterAll').addEventListener('click', () => { filter = 'all'; render(); });
    $('filterUnread').addEventListener('click', () => { filter = 'unread'; render(); });
    $('showAll').addEventListener('click', () => { filter = 'all'; render(); $('filterAll').focus(); });
    $('markAll').addEventListener('click', () => {
      for (const entry of entries) entry.read = true;
      render();
      $('inbox-announcement').textContent = 'All example notifications marked read.';
    });
    $('followToggle').addEventListener('click', () => {
      const entry = entries[selected];
      entry.following = !entry.following;
      $('followToggle').setAttribute('aria-pressed', String(entry.following));
      $('followToggle').textContent = entry.following ? 'Following' : 'Follow idea';
      $('followStatus').textContent = entry.following ? 'Following this idea in the example state.' : 'Not following this idea in the example state.';
    });
    function close() {
      const current = [...$('inbox-entries').querySelectorAll('.entry')].find((button) => button.textContent.includes(entries[selected].idea));
      closeDrawer(drawer, current || $(filter === 'unread' ? 'filterUnread' : 'filterAll'));
    }
    $('closeInbox').addEventListener('click', close);
    drawer.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    $('previewLoad').addEventListener('click', () => {
      clearTimeout(loadingTimer);
      $('inbox-entries').hidden = true;
      $('inbox-empty').hidden = true;
      $('inbox-loading').hidden = false;
      $('previewLoad').disabled = true;
      loadingTimer = setTimeout(() => {
        $('inbox-loading').hidden = true;
        $('previewLoad').disabled = false;
        render();
        $('inbox-announcement').textContent = 'Example inbox ready.';
      }, 650);
    });
    render();
  }
  if (document.body.dataset.flow === 'sprint') {
    const drawer = $('sprintDrawer');
    const confirm = $('sprintConfirm');
    const plan = $('planDialog');
    let origin;
    for (const card of document.querySelectorAll('[data-issue]')) {
      card.addEventListener('click', () => {
        origin = card;
        $('sprintContext').textContent = `${card.querySelector('.issue-meta').textContent.trim()} · September Product Sprint`;
        $('sprintIssueTitle').textContent = card.querySelector('b').textContent;
        $('sprintIssueInfo').textContent = `${card.closest('.lane').querySelector('.lanehead').textContent.trim()} · ${card.querySelector('small').textContent}`;
        openDrawer(drawer, $('closeSprintDrawer'));
      });
    }
    $('closeSprintDrawer').addEventListener('click', () => closeDrawer(drawer, origin));
    backdrop.addEventListener('click', () => closeDrawer(drawer, origin));
    drawer.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(drawer, origin); });
    $('completeSprint').addEventListener('click', () => confirm.showModal());
    confirm.addEventListener('close', () => {
      if (confirm.returnValue !== 'complete') return;
      $('sprint-active').hidden = true;
      $('sprint-finished').hidden = false;
      $('sprint-finished').querySelector('h1').tabIndex = -1;
      $('sprint-finished').querySelector('h1').focus();
      $('sprintAnnouncement').textContent = 'Sprint completed in this preview. Three issues returned to the backlog.';
    });
    $('planSprint').addEventListener('click', () => plan.showModal());
    $('cancelPlan').addEventListener('click', () => plan.close());
    const end = $('sprintEnd');
    for (const input of [$('sprintStart'), end]) input.addEventListener('input', () => {
      end.setCustomValidity('');
      $('dateError').textContent = '';
    });
    $('planForm').addEventListener('submit', (event) => {
      event.preventDefault();
      if (end.value < $('sprintStart').value) {
        end.setCustomValidity('End must be on or after the start.');
        $('dateError').textContent = end.validationMessage;
        end.focus();
        return;
      }
      const name = text($('sprintName'));
      if (!name) { $('sprintName').focus(); return; }
      plan.close();
      $('sprintNotice').textContent = `“${name}” planned in this preview only.`;
      $('sprintAnnouncement').textContent = $('sprintNotice').textContent;
      $('planForm').reset();
    });
  }
  if (document.body.dataset.flow === 'settings') {
    const form = $('profileForm');
    $('editProfile').addEventListener('click', () => { form.hidden = false; $('editProfile').hidden = true; $('firstName').focus(); });
    $('cancelProfile').addEventListener('click', () => { form.hidden = true; $('editProfile').hidden = false; form.reset(); $('editProfile').focus(); });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      let valid = true;
      for (const id of ['firstName', 'lastName']) {
        const input = $(id);
        const message = text(input) ? '' : 'Enter a name to continue.';
        $(id + 'Error').textContent = message;
        input.setAttribute('aria-invalid', String(Boolean(message)));
        if (message) { if (valid) input.focus(); valid = false; }
      }
      if (!valid) return;
      $('profileName').textContent = `${text($('firstName'))} ${text($('lastName'))}`;
      document.querySelector('.account b').textContent = $('profileName').textContent;
      form.hidden = true;
      $('editProfile').hidden = false;
      $('editProfile').focus();
      $('profileNotice').textContent = 'Profile updated in this preview only.';
    });
    const previews = {
      users: ['Users', 'Manage teammates and permissions in Acme Robotics. This preview does not open an admin route or change membership.'],
      boards: ['Boards & Statuses', 'Organize boards and map status lanes for this organization. This preview does not edit a board.'],
      tags: ['Tags', 'Manage labels and colours for ideas in this organization. This preview does not edit tags.']
    };
    for (const button of document.querySelectorAll('[data-settings-panel]')) {
      button.addEventListener('click', () => {
        for (const choice of document.querySelectorAll('[data-settings-panel]')) choice.setAttribute('aria-pressed', String(choice === button));
        $('adminDetail').replaceChildren();
        const title = document.createElement('b');
        title.textContent = previews[button.dataset.settingsPanel][0];
        const detail = document.createElement('span');
        detail.textContent = previews[button.dataset.settingsPanel][1];
        $('adminDetail').append(title, detail);
      });
    }
  }
})();

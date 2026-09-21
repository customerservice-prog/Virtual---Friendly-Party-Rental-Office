/* Presentation-only controls. No provider connections or business permissions. */
{
  const body = document.body;
  const toolbar = $('.scene-bottom');
  const watch = document.createElement('button');
  watch.id = 'watch-office'; watch.type = 'button';
  watch.className = 'watch-office'; watch.textContent = '⛶ Watch office';
  watch.setAttribute('aria-pressed', 'false');
  watch.setAttribute('aria-label', 'Expand the office viewing area');
  toolbar.append(watch);
  const exit = document.createElement('button');
  exit.id = 'exit-watch'; exit.type = 'button'; exit.className = 'button secondary exit-watch';
  exit.textContent = '↙ Exit watch view'; exit.hidden = true;
  $('.topbar').append(exit);
  const mobileViews = document.createElement('label');
  mobileViews.className = 'mobile-room-picker';
  mobileViews.innerHTML = '<span>Room view</span><select id="room-select" aria-label="Choose a showroom viewpoint"><option value="overview">Showroom</option><option value="door">Front door</option><option value="concessions">Concessions</option><option value="storage">Storage & linens</option></select>';
  $('.scene-area').before(mobileViews);
  const reset = document.createElement('button');
  reset.id = 'reset-room'; reset.type = 'button'; reset.className = 'reset-room';
  reset.textContent = '↶ Whole showroom'; reset.hidden = true;
  reset.setAttribute('aria-label', 'Return to the whole showroom');
  toolbar.insertBefore(reset, watch);
  const hint = document.createElement('span');
  hint.className = 'desk-shortcuts'; hint.textContent = 'Desks 1 · 2 · 3';
  hint.title = 'Press 1 for Morgan, 2 for Avery, or 3 for Alex. Shortcuts are inactive while typing.';
  toolbar.append(hint);
  function setWatch(enabled, restoreFocus = true) {
    enabled = Boolean(enabled && state && !$('#shell').hidden && body.dataset.hqView === 'office');
    body.classList.toggle('watch-mode', enabled);
    watch.setAttribute('aria-pressed', String(enabled));
    watch.textContent = enabled ? '↙ Normal view' : '⛶ Watch office';
    exit.hidden = !enabled;
    if (restoreFocus) (enabled ? exit : watch).focus({preventScroll:true});
    window.dispatchEvent(new Event('resize'));
  }
  watch.addEventListener('click', () => setWatch(!body.classList.contains('watch-mode')));
  exit.addEventListener('click', () => setWatch(false));
  const chooseRoom = room => $('.room-view[data-room="' + room + '"]')?.click();
  $('#room-select').addEventListener('change', e => chooseRoom(e.target.value));
  reset.addEventListener('click', () => { chooseRoom('overview'); watch.focus({preventScroll:true}); });
  function syncPresentation() {
    const room = body.dataset.room || 'overview';
    $('#room-select').value = room;
    reset.hidden = room === 'overview' || body.dataset.sceneMode !== 'showroom';
    mobileViews.hidden = body.dataset.sceneMode !== 'showroom';
    if (body.dataset.hqView !== 'office' || $('#shell').hidden) {
      if (body.classList.contains('watch-mode')) setWatch(false, false);
    }
    if (!state) return;
    for (const a of state.agents) {
      const label = $('.monitor-' + a.id + ' span');
      if (label) label.textContent = connected ? agentStatus(a) : 'Connection lost';
    }
  }
  const renderBeforeControls = render;
  render = function () { renderBeforeControls(); syncPresentation(); };
  const networkBeforeControls = network;
  network = function (ok) { networkBeforeControls(ok); syncPresentation(); };
  new MutationObserver(syncPresentation).observe(body, {attributes:true,attributeFilter:['data-hq-view','data-room','data-scene-mode']});
  new MutationObserver(syncPresentation).observe($('#shell'), {attributes:true,attributeFilter:['hidden']});
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.querySelector('dialog[open]') && body.classList.contains('watch-mode')) {
      setWatch(false); return;
    }
    if (!state || $('#shell').hidden || body.dataset.hqView !== 'office' || body.dataset.sceneMode !== 'showroom') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || document.querySelector('dialog[open]')) return;
    if (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"],canvas')) return;
    const role = ({'1':'office','2':'email','3':'tech'})[e.key];
    if (role) { e.preventDefault(); openAgent(role); }
  });
  syncPresentation();
}

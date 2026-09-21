import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Explicitly enabled, bounded practice-only hosting checks. No credentials,
// customer content, cookies or CSRF tokens may be written to logs or files.
export async function verifyHostedStartup(env = process.env) {
  const checks = {};
  let cookie = '', csrf = '', phase = 'not_started';
  const local = `http://127.0.0.1:${Number(env.PORT) || 3000}`;
  const origin = env.PUBLIC_ORIGIN;
  const markerPath = resolve(env.DATA_DIR || '/app/data', '.hosted-check.json');
  const request = (path, { body, auth = false, useCsrf = true, requestOrigin = origin } = {}) => fetch(local + path, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error',
    signal: AbortSignal.timeout(5000),
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json', origin: requestOrigin }),
      ...(auth ? { cookie } : {}), ...(auth && useCsrf ? { 'x-csrf-token': csrf } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const report = () => console.log('OFFICE_HOSTED_CHECK ' + JSON.stringify({
    phase, checks, allCheckedPassed: Object.values(checks).every(v => v === true || v === 'awaiting_redeploy')
  }));
  try {
    if (!env.OWNER_PASSWORD || !/^https:\/\/[^/]+$/.test(origin || '')) throw new Error('configuration');
    checks.health = (await request('/healthz')).status === 200;
    checks.unauthenticatedStateDenied = (await request('/api/state')).status === 401;
    checks.unauthenticatedExportDenied = (await request('/api/export')).status === 401;
    checks.unauthenticatedEventsDenied = (await request('/api/events')).status === 401;
    const wrong = await request('/api/login', { body: { password: 'invalid-hosting-check-password' } });
    checks.wrongPasswordDenied = wrong.status === 401;
    const login = await request('/api/login', { body: { password: env.OWNER_PASSWORD } });
    checks.ownerLogin = login.status === 200;
    const setCookie = login.headers.get('set-cookie') || '';
    checks.secureCookie = /;\s*Secure(?:;|$)/i.test(setCookie) && /;\s*HttpOnly(?:;|$)/i.test(setCookie) && /SameSite=Lax/i.test(setCookie);
    cookie = setCookie.split(';')[0];
    if (!checks.ownerLogin || !cookie) throw new Error('login');
    const stateResponse = await request('/api/state', { auth: true });
    const state = await stateResponse.json();
    csrf = state.csrf;
    checks.authenticatedState = stateResponse.status === 200 && state.localAccess === false && typeof csrf === 'string';
    checks.externalBusinessWritesDisabled = state.businessActionsEnabled === false;
    checks.missingCsrfDenied = (await request('/api/settings', { auth: true, useCsrf: false, body: {} })).status === 403;
    checks.wrongOriginDenied = (await request('/api/settings', { auth: true, requestOrigin: 'https://untrusted.invalid', body: {} })).status === 403;
    checks.privatePractice = state.settings?.mode === 'practice' && state.settings?.paused === true && state.settings?.useAI === false;
    checks.noPrivateProviders = !env.OPENAI_API_KEY && !env.GOOGLE_CLIENT_SECRET && !env.FPR_READONLY_TOKEN && !env.GITHUB_READ_TOKEN;
    if (!checks.privatePractice || !checks.noPrivateProviders) {
      phase = 'mutation_checks_skipped';
    } else {
      const pause = await request('/api/settings', { auth: true, body: { paused: true } });
      checks.ownerPause = pause.status === 200 && (await (await request('/api/state', { auth: true })).json()).settings.paused === true;
      let marker = null;
      try { marker = JSON.parse(await readFile(markerPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (marker) {
        checks.persistence = state.tasks.some(t => t.id === marker.taskId && t.status === 'cancelled' && t.revision === marker.revision);
        phase = 'persistence_verified';
      } else if (state.tasks.length === 0) {
        const created = await request('/api/tasks', { auth: true, body: {
          role: 'office', instruction: 'Deployment verification only: fictional internal test. No customer message, payment, booking or website action.'
        } });
        const task = (await created.json()).task;
        checks.pausedTaskCreated = created.status === 201 && task?.status === 'queued';
        if (!checks.pausedTaskCreated) throw new Error('task');
        const cancelled = await request(`/api/tasks/${task.id}/cancel`, { auth: true, body: { revision: task.revision } });
        const cancelledTask = (await cancelled.json()).task;
        checks.testTaskCancelled = cancelled.status === 200 && cancelledTask?.status === 'cancelled';
        if (!checks.testTaskCancelled) throw new Error('cancellation');
        await writeFile(markerPath, JSON.stringify({ taskId: task.id, revision: cancelledTask.revision }), { mode: 0o600 });
        checks.persistence = 'awaiting_redeploy';
        phase = 'persistence_marker_created';
      } else {
        phase = 'existing_tasks_not_modified';
      }
    }
    const logout = await request('/api/logout', { auth: true, body: {} });
    checks.logoutInvalidatesSession = logout.status === 200 && (await request('/api/state', { auth: true })).status === 401;
    cookie = ''; csrf = '';
    // A new replica may listen before Railway switches its public route.
    // Keep serving normally, then make bounded, real HTTPS checks.
    await new Promise(resolve => setTimeout(resolve, 15000));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(origin + '/healthz', { redirect: 'error', signal: AbortSignal.timeout(8000) });
        const health = await response.json();
        checks.publicHttpsHealth = response.status === 200 && health.status === 'ok' && health.service === 'friendly-office';
        checks.publicHttpsSecurityHeaders = response.headers.get('x-frame-options') === 'DENY' && !!response.headers.get('strict-transport-security');
        checks.publicAnonymousStateDenied = (await fetch(origin + '/api/state', { redirect: 'error', signal: AbortSignal.timeout(8000) })).status === 401;
        if (checks.publicHttpsHealth && checks.publicHttpsSecurityHeaders && checks.publicAnonymousStateDenied) {
          delete checks.publicHttpsFailure;
          break;
        }
      } catch (error) {
        checks.publicHttpsHealth = false;
        checks.publicHttpsFailure = String(error.cause?.code || error.name || 'Error').replace(/[^A-Za-z0-9_]/g, '').slice(0, 80);
      }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    checks.checkerCompleted = false;
    console.log('OFFICE_HOSTED_CHECK_ERROR ' + String(error.name || 'Error').replace(/[^A-Za-z]/g, ''));
  } finally {
    if (cookie && csrf) { try { await request('/api/logout', { auth: true, body: {} }); } catch {} }
    cookie = ''; csrf = '';
    report();
  }
  return { phase, checks };
}

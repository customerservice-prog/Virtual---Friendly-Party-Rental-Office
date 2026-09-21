"""Actual Chromium controls and layout checks against a disposable real backend."""
from pathlib import Path
import json, os, socket, subprocess, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
checks = []
def check(name, condition=True):
    assert condition, name
    checks.append(name)
    print('PASS ' + name, flush=True)
def covers_viewport(page):
    page.wait_for_timeout(200)
    return page.evaluate('''() => {
      const r=document.querySelector('#room-art').getBoundingClientRect();
      const v=document.querySelector('.stage-viewport').getBoundingClientRect();
      return r.left<=v.left+1 && r.top<=v.top+1 && r.right>=v.right-1 && r.bottom>=v.bottom-1;
    }''')
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
origin = f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='controls-ci-') as tmp:
    env = {**os.environ, 'NODE_ENV':'development', 'PORT':str(port), 'DATA_DIR':tmp,
           'OWNER_PASSWORD':'Fictional-CI-owner-password-ONLY', 'PUBLIC_ORIGIN':origin,
           'ENABLE_WEBSITE_CHECKS':'false', 'OPENAI_API_KEY':'', 'OPENAI_MODEL':'',
           'GOOGLE_CLIENT_ID':'','GOOGLE_CLIENT_SECRET':'','GITHUB_READ_TOKEN':'',
           'FPR_READONLY_URL':'','FPR_READONLY_TOKEN':''}
    log = (OUT/'controls-backend.log').open('w')
    server = subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log)
    try:
        for _ in range(80):
            try:
                with urllib.request.urlopen(origin+'/healthz',timeout=1) as r:
                    if r.status==200: break
            except Exception: time.sleep(.15)
        else: raise AssertionError('Backend not ready')
        with sync_playwright() as p:
            browser = p.chromium.launch(args=['--disable-dev-shm-usage'])
            ctx = browser.new_context(viewport={'width':1672,'height':941},reduced_motion='reduce')
            page=ctx.new_page(); errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(origin,wait_until='domcontentloaded')
            page.locator('#password').fill(env['OWNER_PASSWORD'])
            page.locator('#login-form').get_by_role('button').click()
            expect(page.locator('#shell')).to_be_visible()
            page.wait_for_function("document.querySelector('#room-art').naturalWidth===1354")
            page.screenshot(path=str(OUT/'showroom-controls-desktop.png'))
            for room in ['door','concessions','storage','overview']:
                page.locator(f'.room-view[data-room="{room}"]').click()
                check('desktop crop covers all edges: '+room, covers_viewport(page))
            page.locator('#watch-office').click()
            expect(page.locator('body')).to_have_class('watch-mode')
            expect(page.locator('.rail')).to_be_hidden()
            expect(page.locator('#exit-watch')).to_be_visible()
            check('watch mode enlarges office and keeps an exit',covers_viewport(page))
            page.screenshot(path=str(OUT/'showroom-watch-desktop.png'))
            page.keyboard.press('Escape')
            expect(page.locator('.rail')).to_be_visible()
            expect(page.locator('#watch-office')).to_be_focused()
            check('escape exits watch mode and restores keyboard focus')
            page.keyboard.press('2')
            expect(page.locator('#inspector')).to_be_visible()
            check('keyboard desk shortcut opens actual inspector')
            page.locator('#close-inspector').click()
            page.locator('#open-command').click()
            page.locator('#command').fill('123')
            page.locator('#command').press('2')
            expect(page.locator('#inspector')).to_be_hidden()
            check('desk shortcuts do not intercept typed instructions')
            page.locator('#close-command').click()
            for width,height in [(360,800),(390,844),(768,1024),(1024,768),(844,390)]:
                page.set_viewport_size({'width':width,'height':height})
                page.wait_for_timeout(250)
                check(f'no horizontal overflow at {width}x{height}',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                if width<761:
                    for role in ['office','email','tech']:
                        card=page.locator(f'#mobile-team [data-agent="{role}"]')
                        expect(card).to_be_visible()
                        box=card.bounding_box()
                        check(f'{role} mobile desk fits screen at {width}',box['x']>=0 and box['x']+box['width']<=width+1 and box['height']>=44)
                    for room in ['door','concessions','storage','overview']:
                        page.locator('#room-select').select_option(room)
                        check(f'mobile crop {room} at {width}',covers_viewport(page))
                    expect(page.locator('#logout')).to_be_visible()
                    page.screenshot(path=str(OUT/f'showroom-controls-mobile-{width}.png'),full_page=True)
                else:
                    page.locator('.room-view[data-room="door"]').click()
                    check(f'resized crop at {width}x{height}',covers_viewport(page))
                    page.locator('.room-view[data-room="overview"]').click()
            page.set_viewport_size({'width':390,'height':844})
            page.locator('#watch-office').click()
            expect(page.locator('#exit-watch')).to_be_visible()
            page.locator('#exit-watch').click()
            check('mobile watch mode has usable exit')
            page.locator('#logout').click()
            expect(page.locator('#login')).to_be_visible()
            check('mobile logout invalidates session',ctx.request.get(origin+'/api/state').status==401)
            check('no browser JavaScript errors',not errors)
            (OUT/'showroom-controls-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'javascript_errors':errors,'scope':'Disposable real Node backend, Chromium, fictional data only'},indent=2))
            print(f'{len(checks)} showroom-control browser checks passed',flush=True)
            browser.close()
    finally:
        server.terminate()
        try: server.wait(timeout=8)
        except subprocess.TimeoutExpired: server.kill(); server.wait()
        log.close()

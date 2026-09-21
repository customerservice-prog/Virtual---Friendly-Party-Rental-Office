"""Graphical layout checks on a disposable backend, never production records."""
from pathlib import Path
import base64, io, json, os, socket, subprocess, tempfile, time, urllib.request
from PIL import Image
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'; OUT.mkdir(exist_ok=True)
checks=[]
def check(name, condition=True):
    assert condition,name
    checks.append(name)
    print('PASS '+name,flush=True)
def covered(page):
    return page.evaluate('''()=>{const a=document.querySelector('#room-stage').getBoundingClientRect(),v=document.querySelector('.stage-viewport').getBoundingClientRect();return a.left<=v.left+1&&a.top<=v.top+1&&a.right>=v.right-1&&a.bottom>=v.bottom-1;}''')
def preview(path):
    image=Image.open(path).convert('RGB'); image.thumbnail((760,1100))
    out=io.BytesIO(); image.save(out,format='WEBP',quality=23,method=6)
    data=base64.b64encode(out.getvalue()).decode()
    print('VISUAL_PREVIEW_BEGIN '+path.name+' '+str(len(out.getvalue())),flush=True)
    for i in range(0,len(data),4000):print('VISUAL_DATA '+data[i:i+4000],flush=True)
    print('VISUAL_PREVIEW_END '+path.name,flush=True)
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
origin=f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='layout-ci-') as tmp:
    env={**os.environ,'NODE_ENV':'development','PORT':str(port),'DATA_DIR':tmp,'OWNER_PASSWORD':'Fictional-CI-owner-password-ONLY','PUBLIC_ORIGIN':origin,'ENABLE_WEBSITE_CHECKS':'false','OPENAI_API_KEY':'','OPENAI_MODEL':'','GOOGLE_CLIENT_ID':'','GOOGLE_CLIENT_SECRET':'','GITHUB_READ_TOKEN':'','FPR_READONLY_URL':'','FPR_READONLY_TOKEN':'','SHOWROOM_HOSTED_CHECK':'0','OFFICE_HOSTED_CHECK':'0'}
    log=(OUT/'layout-backend.log').open('w')
    server=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log)
    try:
        for _ in range(80):
            try:
                with urllib.request.urlopen(origin+'/healthz',timeout=1) as r:
                    if r.status==200:break
            except Exception:time.sleep(.15)
        else:raise AssertionError('Backend did not start')
        with sync_playwright() as p:
            browser=p.chromium.launch(args=['--disable-dev-shm-usage'])
            ctx=browser.new_context(viewport={'width':1672,'height':941},reduced_motion='reduce')
            page=ctx.new_page(); errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(origin,wait_until='domcontentloaded')
            page.locator('#password').fill(env['OWNER_PASSWORD'])
            page.locator('#login-form').get_by_role('button').click()
            expect(page.locator('#shell')).to_be_visible()
            page.wait_for_function("document.querySelector('#room-art').naturalWidth===1354")
            page.wait_for_timeout(200)
            check('default frontend is the showroom',page.locator('body').get_attribute('data-scene-mode')=='showroom')
            page.screenshot(path=str(OUT/'showroom-final-desktop.png'))
            for width,height in [(1672,941),(1440,900),(1024,768),(768,1024),(390,844),(320,740),(430,932),(640,850)]:
                page.set_viewport_size({'width':width,'height':height})
                page.wait_for_timeout(150)
                check(f'no horizontal overflow at {width}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                for room in ['door','concessions','storage','overview']:
                    if width<=760:
                        expect(page.locator('#room-select')).to_be_visible()
                        page.locator('#room-select').select_option(room)
                    else:
                        page.locator(f'button[data-room="{room}"]').click()
                    page.wait_for_timeout(120)
                    expect(page.locator(f'button[data-room="{room}"]')).to_have_attribute('aria-pressed','true')
                    check(f'{room} covers viewport at {width}px',covered(page))
                if width<=760:
                    for role in ['office','email','tech']:
                        b=page.locator(f'#mobile-team [data-agent="{role}"]')
                        expect(b).to_be_visible()
                        b.click();expect(page.locator('#inspector')).to_be_visible()
                        page.locator('#close-inspector').click()
                    check(f'all three mobile desks open at {width}px')
                    page.locator('.owner-cta').click();expect(page.locator('#approvals-view')).to_be_visible()
                    page.locator('#navigation [data-hq-route="overview"]').click()
                    check(f'mobile owner panel works at {width}px')
                if width==390:
                    page.evaluate('window.scrollTo(0,0)')
                    page.screenshot(path=str(OUT/'showroom-final-mobile.png'),full_page=True)
            check('no JavaScript errors in resized views',not errors)
            page.locator('#logout').click()
            expect(page.locator('#login')).to_be_visible()
            check('owner session removed after logout',ctx.request.get(origin+'/api/state').status==401)
            (OUT/'showroom-layout-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'scope':'Signed-in Chromium checks against a disposable real Node backend. No production credentials.'},indent=2))
            print(f'{len(checks)} isolated showroom layout checks passed',flush=True)
            for name in ['showroom-final-desktop.png','showroom-final-mobile.png']:preview(OUT/name)
            # Read-only public hosted check, reported independently from isolated layout tests.
            live=browser.new_context(viewport={'width':1440,'height':900})
            livepage=live.new_page(); hosted={'scope':'Public hosted login only; no owner credentials','passed':False}
            try:
                response=livepage.goto('https://virtual-office-production-62b4.up.railway.app/',wait_until='domcontentloaded',timeout=25000)
                hosted['html_status']=response.status if response else None
                livepage.wait_for_function("document.querySelector('#login:not([hidden])') || document.querySelector('#shell:not([hidden])')",timeout=15000)
                hosted['login_visible']=livepage.locator('#login').is_visible()
                hosted['authenticated_shell_visible']=livepage.locator('#shell').is_visible()
                hosted['artwork_status']=live.request.get('https://virtual-office-production-62b4.up.railway.app/showroom.avif',timeout=15000).status
                hosted['anonymous_state_status']=live.request.get('https://virtual-office-production-62b4.up.railway.app/api/state',timeout=15000).status
                livepage.screenshot(path=str(OUT/'showroom-hosted-login.png'))
                hosted['passed']=hosted['html_status']==200 and hosted['artwork_status']==200 and hosted['anonymous_state_status']==401
                assert hosted['passed'],'Hosted login verification failed'
                print('PASS public hosted HTTPS login, illustration and private API protection',flush=True)
            except Exception as error:
                hosted['error_type']=type(error).__name__
                print('HOSTED_BROWSER_CHECK did not pass: '+type(error).__name__,flush=True)
                raise
            finally:
                (OUT/'showroom-hosted-checks.json').write_text(json.dumps(hosted,indent=2))
                live.close();browser.close()
    finally:
        server.terminate()
        try:server.wait(timeout=8)
        except subprocess.TimeoutExpired:server.kill();server.wait()
        log.close()

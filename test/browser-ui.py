from pathlib import Path
from urllib.parse import urlparse,parse_qs
from datetime import date
import os,time,urllib.request
import calendar,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/design'; OUT.mkdir(parents=True,exist_ok=True)
ROUTES=['/','/albergue','/habitaciones','/restaurante','/servicios','/galeria','/contacto','/reservas']
BASE=os.environ.get('UI_BASE_URL','http://127.0.0.1:3000').rstrip('/')
for attempt in range(50):
    try:
        urllib.request.urlopen(BASE,timeout=1).close()
        break
    except OSError:
        if attempt==49:raise
        time.sleep(.1)
errors=[]; submitted=[]; checks=[]
rooms=[{'id':i,'name':name,'description':'Datos ficticios para comprobar la interfaz. Características pendientes de validación.','capacity':8,'free':8,'wholeAvailable':True,'beds':[{'id':(i-1)*8+n,'label':f'Cama {n}','available':True} for n in range(1,9)]} for i,name in enumerate(['Abeto','Ribera','Luz'],1)]
def api(route):
    url=urlparse(route.request.url); query=parse_qs(url.query)
    if url.path=='/api/calendar':
        y,m=map(int,query['month'][0].split('-'))
        data={'days':[{'date':date(y,m,d).isoformat(),'free':24 if d%3 else 9,'total':24} for d in range(1,calendar.monthrange(y,m)[1]+1)]}
    elif url.path=='/api/availability': data={'rooms':rooms}
    elif url.path=='/api/restaurant/availability': data={'slots':[{'id':1,'time':'13:30','free':12,'closed':False}]}
    elif route.request.method=='POST':
        submitted.append({'path':url.path,'body':route.request.post_data_json,'key':route.request.headers.get('idempotency-key')})
        data={'reference':'SQ-PRUEBA-UI','message':'Solicitud ficticia pendiente de revisión. Solo prueba de interfaz.'}
    else: data={}
    route.fulfill(status=201 if route.request.method=='POST' else 200,json=data)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for width in [320,390,768,1024,1440]:
        context=browser.new_context(viewport={'width':width,'height':960},locale='es-ES',reduced_motion='reduce')
        context.route('**/api/**',api)
        page=context.new_page(); page.on('pageerror',lambda err:errors.append(str(err)))
        for path in ROUTES:
            page.goto(BASE+path); page.wait_for_load_state('networkidle')
            expect(page.locator('#navigation a[aria-current="page"]')).to_have_attribute('href',path)
            expect(page.locator('h1')).to_have_count(1)
            size=page.evaluate('({scroll:document.documentElement.scrollWidth,viewport:innerWidth})')
            assert size['scroll']<=size['viewport']+1,(width,path,size)
            checks.append(f'{width}px {path}: direct load, active link, no overflow')
            if width==1440 and path=='/':page.screenshot(path=str(OUT/'inicio-desktop.png'),full_page=True)
            if width==390 and path=='/reservas':page.screenshot(path=str(OUT/'reservas-mobile.png'),full_page=True)
        if width<1200:
            expect(page.locator('#navigation')).not_to_be_visible()
            page.locator('#menu-toggle').click(); expect(page.locator('#navigation')).to_be_visible()
            if width==390:page.screenshot(path=str(OUT/'menu-mobile.png'))
            page.keyboard.press('Escape'); expect(page.locator('#navigation')).not_to_be_visible()
            expect(page.locator('#menu-toggle')).to_be_focused()
        for path in ROUTES:
            if width<1200:page.locator('#menu-toggle').click()
            page.locator(f'#navigation a[href="{path}"]').click()
            expect(page).to_have_url(BASE+path)
            page.reload(); expect(page.locator('#navigation a[aria-current="page"]')).to_have_attribute('href',path)
        checks.append(f'{width}px: all menu links and reloads')
        context.close()
    context=browser.new_context(viewport={'width':390,'height':844},locale='es-ES')
    context.route('**/api/**',api)
    page=context.new_page(); page.on('pageerror',lambda err:errors.append(str(err)))
    def contact():
        page.locator('#request-form [name=firstName]').fill('Prueba')
        page.locator('#request-form [name=lastName]').fill('Interfaz')
        page.locator('#request-form [name=email]').fill('interfaz@example.test')
        page.locator('#request-form [name=phone]').fill('+34 600000000')
        page.locator('#request-form input[type=checkbox]').check()
    page.goto(BASE+'/reservas'); page.locator('#search-form button[type=submit]').click()
    page.locator('.bed-option').first.click(); page.locator('#continue-beds').click()
    expect(page.locator('#request-dialog')).to_be_visible();contact()
    page.locator('#request-form button[type=submit]').click();expect(page.locator('#request-success')).to_contain_text('SQ-PRUEBA-UI')
    assert submitted[-1]['path']=='/api/bookings' and submitted[-1]['body']['bedIds']==[1] and submitted[-1]['key']
    page.locator('[data-close]').click()
    page.locator('#search-form [name=mode]').select_option('ROOM');page.locator('#search-form button[type=submit]').click()
    page.locator('[data-room]').first.click();contact();page.locator('#request-form button[type=submit]').click()
    expect(page.locator('#request-success')).to_contain_text('SQ-PRUEBA-UI')
    assert submitted[-1]['body']['roomId']==1 and submitted[-1]['body']['mode']=='ROOM'
    page.goto(BASE+'/restaurante');page.locator('#restaurant-search button').click();page.locator('[data-slot]').click();contact()
    page.locator('#request-form button[type=submit]').click();expect(page.locator('#request-success')).to_contain_text('SQ-PRUEBA-UI')
    assert submitted[-1]['path']=='/api/restaurant/requests' and submitted[-1]['body']['people']==2
    checks.append('Mobile: bed, whole room and restaurant forms submit original API payloads using synthetic responses')
    page.goto(BASE+'/habitaciones');page.goto(BASE+'/contacto');page.go_back();expect(page).to_have_url(BASE+'/habitaciones');page.go_forward();expect(page).to_have_url(BASE+'/contacto')
    checks.append('Browser back/forward preserves independent documents')
    context.close()
    for state in ['empty','error']:
        context=browser.new_context(viewport={'width':390,'height':844})
        def state_api(route):
            route.fulfill(status=503 if state=='error' else 200,json={'error':'Error de prueba de conexión.'} if state=='error' else {'rooms':[],'slots':[],'days':[]})
        context.route('**/api/**',state_api)
        page=context.new_page();page.on('pageerror',lambda err:errors.append(str(err)))
        page.goto(BASE+'/habitaciones');expect(page.locator('#room-cards')).to_contain_text('No se puede cargar' if state=='error' else 'todavía no ha configurado')
        page.goto(BASE+'/reservas');page.locator('#search-form button').click();expect(page.locator('#availability-results')).to_contain_text('Error de prueba' if state=='error' else 'No hay habitaciones')
        page.goto(BASE+'/restaurante');page.locator('#restaurant-search button').click();expect(page.locator('#restaurant-results')).to_contain_text('Error de prueba' if state=='error' else 'No hay turnos')
        checks.append(f'All functional pages handle {state} API responses')
        context.close()
    context=browser.new_context(viewport={'width':320,'height':844},java_script_enabled=False)
    page=context.new_page()
    for path in ROUTES:
        page.goto(BASE+path)
        expect(page.locator('#navigation')).to_be_visible()
        expect(page.locator('#navigation a')).to_have_count(8)
    context.close();checks.append('All eight page menus remain available without JavaScript at 320px')
    browser.close()
assert not errors,errors
report={'checks':checks,'javascript_errors':errors,'submitted_fixture_requests':len(submitted),'screenshots':['inicio-desktop.png','reservas-mobile.png','menu-mobile.png'],'note':'Browser API data is synthetic; no real bookings or database validation.'}
(OUT/'ui-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'checks':len(checks),'javascript_errors':errors,'fixture_submissions':len(submitted),'screenshots':report['screenshots']},ensure_ascii=False))

# Prueba en navegador real de la web publicada. No guarda visitas ni abre expedientes.
import os,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];url=os.environ.get('VIGIA_URL','https://fedora.taild88ec5.ts.net:8443')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);ctx=b.new_context(viewport={'width':390,'height':844});ctx.add_cookies([{'name':'vigia','value':os.environ['CLAVE'],'url':url}]);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));posts=[]
 page.on('request',lambda r:posts.append(r.post_data_json) if r.url.endswith('/api/hablar') and r.method=='POST' else None)
 for i in range(45):
  try:
   r=ctx.request.get(url+'/api/hablar',timeout=3000)
   if r.ok and r.json().get('disponible'):break
  except Exception:pass
  time.sleep(1)
 else:raise RuntimeError('El nodo no está disponible')
 page.goto(url+'/equipos');page.locator('#btnEscribir').click();page.locator('#texto').fill('Estoy en Hospital DemoCare Pacific, Panamá. Vi dos resonadores.');page.locator('#accion').click();page.wait_for_selector('#p2:not(.oculto)',timeout=60000)
 page.locator('#lecturaVoz button').first.wait_for();assert posts==[]
 tiempos=[]
 for intento in range(2):
  t=time.monotonic()
  with page.expect_response(lambda r:r.url.endswith('/api/hablar') and r.request.method=='POST',timeout=60000) as sonido:page.locator('#lecturaVoz button').first.click()
  audio=sonido.value;assert audio.ok,audio.text();assert audio.headers['x-vigia-modelo']=='Supertonic2-Q8-GPU'
  tiempos.append({'respuesta_ms':round((time.monotonic()-t)*1000),'cache':audio.headers['x-vigia-cache']})
  page.wait_for_function('document.querySelector("#lecturaVoz audio").currentTime>0')
  assert page.evaluate("async()=>{const a=document.querySelector('#lecturaVoz audio');const b=await (await fetch(a.src)).arrayBuffer();return String.fromCharCode(...new Uint8Array(b).slice(0,4))}")=='RIFF'
  page.screenshot(path=str(ROOT/'evidencia/voz-opcional/philips-movil.png'))
  page.locator('#lecturaVoz').get_by_role('button',name='Detener',exact=True).click()
  assert page.locator('#lecturaVoz audio').evaluate('a=>a.paused && !a.getAttribute("src")')
 assert tiempos[1]['cache']=='true'
 page.goto(url+'/sucursal');page.locator('#btnEscribir').click();page.locator('#consulta').fill('¿A qué hora cierra la sucursal los sábados?');page.locator('#accion').click();page.wait_for_selector('#p2:not(.oculto)',timeout=60000)
 with page.expect_response(lambda r:r.url.endswith('/api/hablar') and r.request.method=='POST') as respuesta:page.locator('#lecturaSucursal button').first.click()
 assert respuesta.value.ok
 page.wait_for_function('document.querySelector("#lecturaSucursal audio").currentTime>0');page.screenshot(path=str(ROOT/'evidencia/voz-opcional/sucursal-movil.png'))
 page.locator('#lecturaSucursal').get_by_role('button',name='Detener',exact=True).click()
 ctx.set_offline(True);page.locator('#lecturaSucursal button').first.click();page.locator('#lecturaSucursal').get_by_text('Lectura no disponible:',exact=False).wait_for();assert page.locator('#accion').is_enabled();ctx.set_offline(False)
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1');assert not errors,errors
 print(json.dumps({'url':url,'modelo':'Supertonic 2 Q8 GPU','sin_autoplay':True,'philips_reproduce_y_detiene':True,'sucursal_reproduce_y_detiene':True,'sin_red_texto_sigue_disponible':True,'repeticion':tiempos,'sin_desborde_movil':True,'errores_js':errors},ensure_ascii=False));b.close()

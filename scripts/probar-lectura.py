import json,threading,wave,io
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(ROOT/'app'),**k)
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',7438),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
f=io.BytesIO()
with wave.open(f,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100);w.writeframes(b'\0\0'*44100*5)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));pedidos=[];retenidas=[];modo={'valor':'normal'}
 def api(r):
  if r.request.method=='GET':r.fulfill(json={'disponible':True});return
  pedidos.append(r.request.post_data_json['texto'])
  if modo['valor']=='lento':retenidas.append(r);return
  if modo['valor']=='ocupado':modo['valor']='normal';r.fulfill(status=429,json={'error':'Ocupado'});return
  if modo['valor']=='ocupado-siempre':r.fulfill(status=429,json={'error':'Ocupado'});return
  if modo['valor']=='fallo':r.fulfill(status=503,json={'error':'Nodo no disponible'});return
  r.fulfill(content_type='audio/wav',body=f.getvalue())
 page.route('**/api/hablar',api)
 page.route('**/control',lambda r:r.fulfill(content_type='text/html',body='<div id="voz"></div><script type="module">import {crearLectura} from "/lectura.js";window.lectura=crearLectura(document.querySelector("#voz"));lectura.actualizar("Pregunta uno", "Escuchar pregunta");</script>'))
 page.goto('http://127.0.0.1:7438/control');page.get_by_role('button',name='Escuchar pregunta').wait_for();assert not pedidos
 page.get_by_role('button',name='Escuchar pregunta').click();page.wait_for_function('document.querySelector("audio").currentTime>0');page.get_by_role('button',name='Detener',exact=True).click();assert page.locator('audio').evaluate('(a)=>a.paused && !a.getAttribute("src")')
 modo['valor']='lento';page.get_by_role('button',name='Escuchar pregunta').click();page.wait_for_timeout(100);assert retenidas
 page.get_by_role('button',name='Detener',exact=True).click();retenidas.pop().fulfill(content_type='audio/wav',body=f.getvalue());page.wait_for_timeout(100);assert page.locator('audio').evaluate('(a)=>a.paused && !a.getAttribute("src")')
 modo['valor']='normal';page.get_by_role('button',name='Escuchar pregunta').click();page.wait_for_function('document.querySelector("audio").currentTime>0');page.evaluate('lectura.actualizar("Pregunta dos", "Escuchar pregunta")');assert page.locator('audio').evaluate('(a)=>a.paused && !a.getAttribute("src")')
 modo['valor']='ocupado';page.get_by_role('button',name='Escuchar pregunta').click();page.wait_for_function('document.querySelector("audio").currentTime>0');page.get_by_role('button',name='Detener',exact=True).click()
 modo['valor']='ocupado-siempre';page.get_by_role('button',name='Escuchar pregunta').click();page.get_by_text('El nodo está ocupado.',exact=False).wait_for();page.get_by_role('button',name='Detener',exact=True).click();total=len(pedidos);page.wait_for_timeout(1200);assert len(pedidos)==total
 modo['valor']='fallo';page.get_by_role('button',name='Escuchar pregunta').click();page.get_by_text('Lectura no disponible:',exact=False).wait_for();assert page.get_by_role('button',name='Escuchar pregunta').is_enabled()
 modo['valor']='normal';larga=' '.join(['Contenido visible sin omitir palabras.']*25);page.evaluate('t=>lectura.actualizar(t)',larga);antes=len(pedidos);page.get_by_role('button',name='Escuchar',exact=True).click()
 for i in range(3):
  page.wait_for_function("i=>document.querySelector('audio').currentTime>0 && document.querySelector('#voz p').textContent.startsWith('Lectura '+(i+1)+' de')",arg=i)
  if i==0:modo['valor']='ocupado'
  page.locator('audio').evaluate('a=>a.dispatchEvent(new Event("ended"))');page.wait_for_timeout(100)
 page.get_by_text('Lectura terminada.',exact=True).wait_for();bloques=pedidos[antes:];assert bloques[1]==bloques[2];assert ' '.join([bloques[0]]+bloques[2:])==larga;assert all(len(t)<=500 for t in pedidos)
 # La lectura de Sucursal incluye lo visible: monto, alcance y advertencias.
 def sucursal(r):
  if r.request.url.endswith('/estado'):r.fulfill(json={'disponible':True,'guia':{'version':'Prueba'},'ejecucion':'local'});return
  r.fulfill(json={'cubierto':True,'consultaId':'prueba','codigo':'RET-ISL-01','limite':'B/. 80.00','limite_origen':'Guía sintética','citas':[{'seccion':'RET-ISL-01 — Prueba','texto':'Guía de prueba'}],'pasos':['1. Documentar la solicitud.','No se autoriza ninguna transacción.','| B/. 80.00 | Tope de la prueba sintética B/. 80.00 |'],'ms':1})
 page.route('**/api/sucursal/**',sucursal)
 page.goto('http://127.0.0.1:7438/sucursal.html');page.locator('#btnEscribir').click();page.locator('#consulta').fill('Prueba');page.locator('#accion').click();page.wait_for_selector('#p2:not(.oculto)')
 antes=len(pedidos);page.locator('#lecturaSucursal button').first.click();page.wait_for_function('document.querySelector("audio").currentTime>0')
 assert '80 balboas' in pedidos[antes] and 'Tope de la prueba sintética' in pedidos[antes] and 'No se autoriza' in pedidos[antes],pedidos[antes]
 page.locator('#lecturaSucursal').get_by_role('button',name='Detener',exact=True).click()
 assert not errors,errors;b.close()
server.shutdown();print(json.dumps({'ocupado_reintenta_mismo_bloque':True,'detener_cancela_reintentos':True,'sucursal_lee_monto_alcance_y_advertencia':True,'sin_reproduccion_automatica':True,'reproduccion_y_detener':True,'respuesta_tardia_no_reproduce':True,'cambiar_pregunta_detiene':True,'error_recuperable':True,'lectura_larga_completa':True,'errores_js':errors},ensure_ascii=False))

import json, threading
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT/'app'),**kwargs)
 def do_GET(self):
  if self.path in ('/revision.js','/reglas.js','/esquema.js'):
   content=(ROOT/'src/equipos'/self.path[1:]).read_bytes();self.send_response(200);self.send_header('Content-Type','text/javascript');self.end_headers();self.wfile.write(content);return
  self.path=self.path.split('?')[0]
  self.path={'/':'/inicio.html','/equipos':'/index.html','/tablero':'/tablero.html','/sucursal':'/sucursal.html','/verificar':'/verificar.html'}.get(self.path,self.path)
  super().do_GET()
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',7434),Handler); threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block')
 page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 writes=[];pendiente=[]
 def api(route):
  if route.request.method!='GET': writes.append(route.request.url)
  if route.request.url.endswith('/api/extraer'):pendiente.append(route);return
  if route.request.url.endswith('/api/evidencia'):route.fulfill(json={'modo':'local','modelo':'Prueba'});return
  route.abort()
 ctx.route('**/api/**',api)
 page.goto('http://127.0.0.1:7434/equipos');page.wait_for_timeout(200)
 def queue():return page.evaluate("""async()=>{const d=await new Promise(ok=>{const r=indexedDB.open('vigia',1);r.onsuccess=()=>ok(r.result)});return new Promise(ok=>{const r=d.transaction('cola').objectStore('cola').getAll();r.onsuccess=()=>{d.close();ok(r.result)}})}""")
 page.locator('#quien').fill('Prueba aislada')
 page.locator('#btnEscribir').click();page.locator('#texto').fill('Visita pendiente A')
 page.locator('#nuevaVisita').click();page.wait_for_url('**/equipos');page.wait_for_timeout(300)
 assert len(queue())==1 and page.locator('#texto').input_value()==''
 assert not writes
 results.append('Nueva visita conserva texto sin interpretar y abre una captura vacía sin inferencia automática')
 page.reload();page.wait_for_timeout(300);assert len(queue())==1 and page.locator('#texto').input_value()==''
 page.locator('#limpiarPendientes').click();page.locator('#cancelarLimpieza').click();assert len(queue())==1
 results.append('Cancelar el borrado conserva la captura; recargar no restaura borradores automáticamente')
 page.locator('#procesar').click();page.wait_for_timeout(200);assert len(pendiente)==1
 page.locator('#limpiarPendientes').click();assert not page.locator('#confirmarLimpieza').is_visible()
 assert 'espera' in page.locator('#estadoLimpieza').inner_text()
 pendiente.pop().fulfill(json={'borrador':{'customer':{'name':'Hospital de prueba'},'equipment':[{'modality':'MR','quantity':1}]},'preguntas':[],'duplicados':[]})
 page.wait_for_selector('#p2:not(.oculto)');page.wait_for_timeout(200)
 otra=ctx.new_page();otra.goto('http://127.0.0.1:7434/equipos');otra.wait_for_timeout(200)
 results.append('No permite borrar durante inferencia; revisión y original permanecen hasta terminar')
 page.locator('#limpiarPendientes').click();page.screenshot(path=str(ROOT/'evidencia/limpiar-pendientes-movil.png'))
 page.locator('#confirmarBorrado').click();page.wait_for_url('**/equipos?limpio=1');assert queue()==[]
 assert page.locator('#quien').input_value()=='Prueba aislada'
 page.reload();page.wait_for_timeout(300);assert queue()==[] and page.locator('#texto').input_value()==''
 assert all(u.endswith('/api/extraer') for u in writes),writes
 otra.wait_for_url('**/equipos?limpio=1');assert otra.locator('#texto').input_value()==''
 results.append('Otra pestaña se reinicia al borrar para impedir que restaure datos antiguos')
 results.append('Borrado confirmado persiste tras recarga y conserva el nombre; ningún guardado ni borrado al servidor')
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
 assert not errors,errors
 b.close()
server.shutdown()
print(json.dumps({'pruebas':results,'errores_js':errors},ensure_ascii=False,indent=2))

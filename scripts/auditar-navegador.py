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
  self.path={'/':'/inicio.html','/equipos':'/index.html','/tablero':'/tablero.html','/sucursal':'/sucursal.html','/verificar':'/verificar.html'}.get(self.path,self.path)
  super().do_GET()
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',7432),Handler); threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block')
 page=ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 state={'online':False,'extracts':0,'savefail':True,'saved':[]}
 draft={'customer':{'name':'Hospital DemoCare Pacific','country':'Panama'},'equipment':[{'modality':'MR','quantity':2,'manufacturer':None}]}
 def api(route):
  path=route.request.url.split('/api/')[1]
  if not state['online']:route.abort();return
  if path=='evidencia':route.fulfill(json={'modo':'local','modelo':'Control de prueba'});return
  if path=='extraer':
   state['extracts']+=1
   route.fulfill(json={'id':'CONTROL','borrador':draft,'preguntas':[],'duplicados':[],'ms':5});return
  if path=='guardar':
   state['saved'].append(route.request.post_data_json)
   if state['savefail']:route.abort();return
   route.fulfill(json={'eventos':1,'acta':{'sello':{'hash':'a'*64,'firmante':'Control'}}});return
  route.fulfill(json={})
 page.route('**/api/**',api)
 page.goto('http://127.0.0.1:7432/equipos');page.wait_for_timeout(300)
 def queue():return page.evaluate("""async()=>{const d=await new Promise((ok,err)=>{const r=indexedDB.open('vigia',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error)});return await new Promise(ok=>{const r=d.transaction('cola').objectStore('cola').getAll();r.onsuccess=()=>ok(r.result.map(x=>({id:x.id,tipo:x.tipo,revision:!!x.revision})))})}""")
 page.locator('#btnEscribir').click();page.locator('#texto').fill('Dos resonadores en Hospital DemoCare Pacific');page.locator('#accion').click();page.wait_for_timeout(100)
 page.locator('#texto').fill('Un tomógrafo en Hospital DemoCare Horizon');page.locator('#accion').click();page.wait_for_timeout(100)
 assert len(queue())==2,queue();results.append('Dos capturas sin nodo conservadas por separado')
 state['online']=True
 page.reload(); page.locator('#procesar').click(); page.wait_for_selector('#p2:not(.oculto)');page.wait_for_timeout(100)
 assert len(queue())==2,queue();assert state['extracts']==1,state
 results.append('Una captura retomada explícitamente tras reconectar; original permanece durante revisión')
 page.reload();page.locator('#procesar').click();page.wait_for_selector('#p2:not(.oculto)');assert state['extracts']==1,state
 results.append('Revisión recuperada tras recargar sin repetir inferencia')
 page.locator('#accion').click();page.wait_for_timeout(100)
 assert page.locator('#accion').inner_text()=='Reintentar guardar';assert len(queue())==2
 state['savefail']=False;page.locator('#accion').click();page.wait_for_timeout(100)
 assert len(queue())==1,queue()
 assert state['saved'][0]['requestId']==state['saved'][1]['requestId']
 assert state['saved'][1]['fuente']=='texto'
 results.append('Fallo de red permite reintentar con el mismo identificador; solo borra al recibir acta; fuente texto correcta')
 page.screenshot(path='/tmp/vigia-auditoria-movil.png',full_page=True)
 for width in (390,1280):
  page.set_viewport_size({'width':width,'height':900})
  for path in ('/','/equipos','/sucursal','/tablero','/verificar','/catalogo.html'):
   page.goto('http://127.0.0.1:7432'+path);page.wait_for_timeout(100)
   overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
   results.append(f'{path} {width}px: '+('DESBORDE' if overflow else 'sin desborde'))
 assert not errors,errors
 b.close()
server.shutdown()
print(json.dumps({'pruebas':results,'errores_js':errors},ensure_ascii=False,indent=2))

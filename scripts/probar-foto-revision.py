import json, threading, os
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(ROOT/'app'),**k)
 def do_GET(self):
  if self.path in ('/revision.js','/reglas.js','/esquema.js'):
   self.send_response(200);self.send_header('Content-Type','text/javascript');self.end_headers();self.wfile.write((ROOT/'src/equipos'/self.path[1:]).read_bytes());return
  if self.path=='/equipos':self.path='/index.html'
  super().do_GET()
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',7433),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));state={'extracts':0,'saved':None,'fallar':False}
 draft={'customer':{'name':'Hospital DemoCare Pacific','country':'Panama'},'equipment':[{'modality':'MR','quantity':None,'manufacturer':None}]}
 def api(route):
  path=route.request.url.split('/api/')[1]
  if path=='evidencia':route.fulfill(json={'modo':'local','modelo':'Control'});return
  if path=='extraer':
   if state['fallar']:route.fulfill(status=503,json={'aviso':'Prueba de nodo desconectado'});return
   state['extracts']+=1
   if state['extracts']>1:
    assert route.request.post_data_json['respuestas']=={}
    draft['customer']['name']='Hospital DemoCare Horizon';draft['equipment'][0]['quantity']=2
   route.fulfill(json={'id':'PRUEBA','ms':5,'borrador':draft,'preguntas':[{'campo':'customer.location','grupo':None,'clave':'customer.location:null','texto':'¿Ciudad y país?','opciones':[]}],'duplicados':[]});return
  if path=='placa':route.fulfill(json={'modo':'placa','campos':{'manufacturer':'NovaMed','model':'NM-MR 700','modality':'MR','serial':'DEMO-01'},'desacuerdos':[]});return
  if path=='guardar':state['saved']=route.request.post_data_json;route.fulfill(json={'eventos':2,'acta':{'sello':{'hash':'a'*64,'firmante':'Prueba'}}});return
  route.fulfill(json={})
 page.route('**/api/**',api);page.goto('http://127.0.0.1:7433/equipos');page.locator('#btnEscribir').click();page.locator('#texto').fill('Visita de prueba a Hospital DemoCare Pacific');page.locator('#accion').click();page.wait_for_selector('#p2:not(.oculto)')
 page.locator('#libre').fill('Respuesta a medio escribir')
 page.locator('#volver').click();assert page.locator('#p2').is_visible()
 page.locator('#relatoEditado').fill('Edición que cancelo');page.locator('#cancelarRelato').click()
 assert page.locator('#libre').input_value()=='Respuesta a medio escribir'
 assert state['extracts']==1
 page.locator('#volver').click();page.locator('#relatoEditado').fill('Corrección para reintentar');state['fallar']=True;page.locator('#aplicarRelato').click()
 page.wait_for_function("document.querySelector('#errorEdicion').textContent.includes('Conservamos')")
 assert page.locator('#p2').is_visible() and 'Pacific' in page.locator('#filas').inner_text()
 assert page.locator('#relatoEditado').input_value()=='Corrección para reintentar'
 state['fallar']=False;page.locator('#cancelarRelato').click()
 page.locator('#libre').fill('David, Panama');page.get_by_role('button',name='Responder',exact=True).click();page.locator('#libre').fill('2');page.get_by_role('button',name='Responder',exact=True).click()
 page.evaluate('window.scrollTo(0,document.body.scrollHeight)');box=page.locator('#fotoRevisar').bounding_box();assert 0<=box['y']<844
 with page.expect_file_chooser() as chooser:page.locator('#fotoRevisar').click()
 chooser.value.set_files({'name':'placa.png','mimeType':'image/png','buffer':b'control de API'})
 page.locator('#usarFoto').click();page.wait_for_function("document.querySelector('#fotoRevision').textContent.includes('Foto incorporada')")
 assert 'David' in page.locator('#filas').inner_text();assert 'DEMO-01' in page.locator('#filas').inner_text();assert state['extracts']==1
 page.screenshot(path=str(ROOT/'evidencia/auditoria-foto-en-revision-9sep.png'),full_page=True)
 if os.environ.get('PROBAR_CORRECCION'):
  page.locator('#volver').click();page.screenshot(path=str(ROOT/'evidencia/edicion-en-visita-movil.png'));assert page.locator('#p2').is_visible() and not page.locator('#p1').is_visible();page.locator('#relatoEditado').fill('Dos resonadores en Hospital DemoCare Horizon');page.locator('#aplicarRelato').click();page.wait_for_function("document.querySelector('#filas').textContent.includes('Hospital DemoCare Horizon')")
  assert 'DEMO-01' not in page.locator('#filas').inner_text()
  page.locator('#retomarFoto').click();page.locator('#usarFoto').click();page.wait_for_function("document.querySelector('#fotoRevision').textContent.includes('Foto incorporada')")
  assert state['extracts']==2
 page.locator('#guardarParcial').click();page.get_by_role('button',name='Sí, los vi',exact=True).click();page.locator('#accion').click();page.wait_for_function("document.querySelector('#p2').textContent.includes('Visita guardada')")
 saved=state['saved'];assert saved['borrador']['customer'].get('city')==('David' if not os.environ.get('PROBAR_CORRECCION') else None);assert sum(g['quantity'] for g in saved['borrador']['equipment'])==2;assert len(saved['borrador']['equipment'])==2;assert saved['foto']['confirmado_por_colaborador'];assert state['extracts']==(2 if os.environ.get('PROBAR_CORRECCION') else 1);assert not errors,errors
 print(json.dumps({'foto_durante_preguntas':True,'foto_visible_al_desplazarse':True,'cancelar_conserva_respuesta_en_curso':True,'fallo_de_nodo_conserva_revision_y_edicion':True,'respuestas_conservadas':True,'cantidad_total':2,'inferencias':state['extracts'],'guardado_con_pendientes':True,'corregir_sin_perder_unidades':bool(os.environ.get('PROBAR_CORRECCION')),'errores_js':errors},ensure_ascii=False));b.close()
server.shutdown()

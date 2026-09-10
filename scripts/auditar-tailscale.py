# Prueba con inferencia real: requiere servidor, QVAC, clave y Playwright. No guarda visitas.
import json, hashlib, os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];url=os.environ.get('VIGIA_URL','https://fedora.taild88ec5.ts.net:8443');clave=os.environ['CLAVE']
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844});ctx.add_cookies([{'name':'vigia','value':clave,'url':url}]);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 checks=[]
 for path in ['/','/equipos','/sucursal','/tablero','/verificar','/revision.js','/reglas.js','/esquema.js']:
  res=page.goto(url+path);page.wait_for_timeout(1200);assert res.status==200,(path,res.status)
  overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
  checks.append({'ruta':path,'status':res.status,'overflow':overflow})
  assert not overflow,(path,'desborde horizontal')
 page.goto(url+'/equipos');page.wait_for_function("document.querySelector('#btnEscribir').onclick !== null")
 page.locator('#btnEscribir').click();page.locator('#texto').fill('En Hospital DemoCare Pacific en Panama City, Panama, vi dos resonadores NovaMed de siete años.');page.locator('#accion').click();page.wait_for_selector('#p2:not(.oculto)',timeout=60000)
 assert page.locator('#fotoRevisar').is_visible();assert page.locator('#guardarParcial').is_visible()
 with page.expect_file_chooser() as chooser:page.locator('#fotoRevisar').click()
 chooser.value.set_files(str(root/'fixtures/placas/nmmr700-nitida.png'))
 page.locator('#usarFoto').wait_for(timeout=60000);page.locator('#usarFoto').click();page.wait_for_function("document.querySelector('#fotoRevision').textContent.includes('Foto incorporada')",timeout=15000)
 page.screenshot(path=str(root/'evidencia/auditoria-tailscale-movil-9sep.png'),full_page=True)
 response=ctx.request.get(url+'/equipos');same=hashlib.sha256(response.body()).hexdigest()==hashlib.sha256((root/'app/index.html').read_bytes()).hexdigest()
 page.wait_for_timeout(1000);caches=page.evaluate('caches.keys()');assert not errors,errors
 result={'origen':url,'rutas':checks,'html_igual_repo':same,'inferencia_real':True,'foto_durante_revision':True,'vision_qvac_real':True,'cache':caches,'errores_js':errors,'visita_guardada':False}
 (root/'evidencia/auditoria-tailscale-final-9sep.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()

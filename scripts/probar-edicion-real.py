# Prueba sintética completa con QVAC y guardado real. Crea una visita de auditoría.
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];url=os.environ.get('VIGIA_URL','https://fedora.taild88ec5.ts.net:8443')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':844});c.add_cookies([{'name':'vigia','value':os.environ['CLAVE'],'url':url}]);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url+'/equipos');page.locator('#quien').fill('Auditoría sintética · edición')
 page.locator('#btnEscribir').click();page.locator('#texto').fill('Estoy en Hospital DemoCare Pacific, Ciudad de Panamá, Panamá. Vi dos resonadores NovaMed de siete años.');page.locator('#accion').click();page.wait_for_selector('#p2:not(.oculto)',timeout=60000)
 page.locator('#volver').click()
 texto='Estoy en Hospital DemoCare Pacific, Ciudad de Panamá, Panamá. Corrijo: vi tres resonadores NovaMed de siete años.'
 page.evaluate("texto=>{const t=document.querySelector('#relatoEditado');t.value=texto;t.dispatchEvent(new Event('input'));document.querySelector('#accion').click()}",texto)
 page.wait_for_selector('#editorRelato.oculto',state='attached',timeout=60000)
 assert page.locator('#p2').is_visible() and not page.locator('#p1').is_visible()
 assert 'tres resonadores' in page.locator('#dicho').inner_text()
 page.locator('#guardarParcial').click();page.get_by_role('button',name='Sí, los vi',exact=True).click()
 with page.expect_response(lambda r:r.url.endswith('/api/guardar') and r.request.method=='POST') as respuesta:page.locator('#accion').click()
 r=respuesta.value;assert r.ok,r.text();body=r.request.post_data_json
 assert sum(g['quantity'] for g in body['borrador']['equipment'])==3,body
 page.locator('#p2 a[href^="/verificar"]').click();page.get_by_text('Acta válida',exact=True).wait_for()
 assert not errors,errors
 print(json.dumps({'origen':url,'qvac_real':True,'edicion_clic_inmediato':True,'visita_guardada_real':True,'cantidad_corregida_guardada':3,'acta_valida':True,'observador':body['observador'],'errores_js':errors},ensure_ascii=False));b.close()

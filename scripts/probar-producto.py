import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];url=os.environ.get('VIGIA_URL','https://fedora.taild88ec5.ts.net:8443')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},accept_downloads=True);ctx.add_cookies([{'name':'vigia','value':os.environ['CLAVE'],'url':url}]);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url+'/equipos');page.evaluate('navigator.serviceWorker.ready');page.wait_for_timeout(1000)
 page.goto(url+'/tablero');page.wait_for_function("document.querySelector('#clientes').textContent.includes('DemoCare')")
 page.locator('#buscarCliente').fill('Pacific');assert 'Horizon' not in page.locator('#clientes').inner_text()
 with page.expect_download() as d:page.locator('#exportar').click()
 csv=Path(d.value.path()).read_text(encoding='utf-8-sig');assert 'Pacific' in csv and 'Horizon' not in csv
 assert page.locator('#prioridades').inner_text();assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
 page.screenshot(path=str(ROOT/'evidencia/tablero-producto-movil.png'),full_page=True)
 page.locator('#buscarCliente').fill('ningun-cliente-xyz');assert 'DemoCare' not in page.locator('#clientes').inner_text()
 page.goto(url+'/sucursal');page.locator('#empleado').fill('Auditoría sintética');page.locator('#sucursal').fill('Sucursal de pruebas');page.locator('#btnEscribir').click();page.locator('#consulta').fill('¿Qué documentos necesita una persona natural adulta panameña para abrir una cuenta?');page.locator('#accion').click();page.wait_for_selector('#p2:not(.oculto)',timeout=60000);page.locator('#accion').click();page.wait_for_selector('#p3:not(.oculto)')
 page.locator('#c-observacion').fill('Ensayo sintético: documentación revisada para verificar cierre y siguiente atención.')
 with page.expect_response(lambda r:'/datos' in r.url and r.request.method=='POST'):
  page.locator('#c-observacion').locator('xpath=../..').get_by_role('button',name='Guardar',exact=True).click()
 page.get_by_role('button',name='Cerrar y emitir acta',exact=True).click();page.get_by_role('button',name='Verificar acta',exact=True).click();page.wait_for_url('**/verificar?desde=sucursal#*');page.get_by_text('Acta válida',exact=True).wait_for()
 page.screenshot(path=str(ROOT/'evidencia/cierre-sucursal-producto.png'),full_page=True)
 ctx.set_offline(True);page.reload();page.get_by_text('Acta válida',exact=True).wait_for();ctx.set_offline(False)
 page.get_by_role('link',name='Iniciar otra atención',exact=True).click();assert page.url==url+'/sucursal';assert page.locator('#consulta').input_value()=='';assert page.locator('#p1').is_visible();assert not errors,errors
 print(json.dumps({'tablero_filtro':True,'csv_filtrado':True,'prioridades':True,'sin_desborde_390':True,'expediente_real_cerrado':True,'firma_valida':True,'verificacion_sin_red':True,'nueva_atencion_limpia':True,'errores_js':errors},ensure_ascii=False));b.close()

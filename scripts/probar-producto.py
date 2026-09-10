import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];url=os.environ.get('VIGIA_URL','https://fedora.taild88ec5.ts.net:8443')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},accept_downloads=True,timezone_id='UTC');ctx.add_cookies([{'name':'vigia','value':os.environ['CLAVE'],'url':url}]);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url+'/equipos');page.evaluate('navigator.serviceWorker.ready');page.wait_for_timeout(1000)
 page.goto(url+'/tablero');page.wait_for_function("document.querySelector('#clientes').textContent.includes('DemoCare')")
 page.locator('#buscarCliente').fill('Pacific');assert 'Horizon' not in page.locator('#clientes').inner_text()
 with page.expect_download() as d:page.locator('#exportar').click()
 csv=Path(d.value.path()).read_text(encoding='utf-8-sig');assert 'Pacific' in csv and 'Horizon' not in csv
 assert page.locator('#prioridades').inner_text();assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
 assert 'Último registro' in page.locator('#clientes').text_content()
 assert 'Panamá (UTC−5)' in page.locator('#clientes').inner_text()
 datos=ctx.request.get(url+'/api/inventario').json()
 equipo=next(e for sitio in datos if 'Pacific' in sitio['customer']['name'] for e in sitio['equipos'])
 esperada=page.evaluate("v=>new Date(v).toLocaleString('es-PA',{timeZone:'America/Panama',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})",equipo['ultimo_registro'])
 assert esperada in page.locator('#clientes').inner_text()
 assert 'Último registro (UTC)' in csv
 page.screenshot(path=str(ROOT/'evidencia/tablero-producto-movil.png'),full_page=True)
 page.locator('#buscarCliente').fill('ningun-cliente-xyz');assert 'DemoCare' not in page.locator('#clientes').inner_text()
 page.goto(url+'/sucursal');page.locator('#empleado').fill('Auditoría sintética');page.locator('#sucursal').fill('Sucursal de pruebas');page.locator('#btnEscribir').click();page.locator('#consulta').fill('¿Qué documentos necesita una persona natural adulta panameña para abrir una cuenta?');page.locator('#accion').click();page.wait_for_selector('#p2:not(.oculto)',timeout=60000);page.locator('#accion').click();page.wait_for_selector('#p3:not(.oculto)')
 page.locator('#c-folio').fill('PRUEBA-FLUJO-CAMPOS')
 page.locator('#c-observacion').fill('Ensayo sintético: documentación revisada para verificar cierre y siguiente atención.')
 with page.expect_response(lambda r:'/datos' in r.url and r.request.method=='POST'):
  page.locator('#c-observacion').locator('xpath=../..').get_by_role('button',name='Guardar',exact=True).click()
 assert page.locator('#c-folio').input_value()=='PRUEBA-FLUJO-CAMPOS'
 page.get_by_role('button',name='Cerrar y emitir acta',exact=True).click()
 assert 'Guarda los campos editados' in page.locator('#expediente').inner_text()
 with page.expect_response(lambda r:'/datos' in r.url and r.request.method=='POST'):
  page.locator('#c-folio').locator('xpath=../..').get_by_role('button',name='Guardar',exact=True).click()
 page.get_by_role('button',name='Cerrar y emitir acta',exact=True).click();page.get_by_role('button',name='Verificar acta',exact=True).click();page.wait_for_url('**/verificar?desde=sucursal#*');page.get_by_text('Acta válida',exact=True).wait_for()
 acta_url=page.url
 page.screenshot(path=str(ROOT/'evidencia/cierre-sucursal-producto.png'),full_page=True)
 ctx.set_offline(True);page.reload();page.get_by_text('Acta válida',exact=True).wait_for();ctx.set_offline(False)
 page.get_by_role('link',name='Iniciar otra atención',exact=True).click();assert page.url==url+'/sucursal';assert page.locator('#consulta').input_value()=='';assert page.locator('#p1').is_visible();assert not errors,errors
 antes=ctx.request.get(url+'/api/sucursal/expedientes').json()['expedientes']
 page.locator('#btnEscribir').click();page.locator('#consulta').fill('Consulta que voy a limpiar')
 page.locator('#limpiarSucursal').click();page.locator('#cancelarLimpiar').click();assert page.locator('#consulta').input_value()=='Consulta que voy a limpiar'
 page.locator('#limpiarSucursal').click();page.locator('#olvidarCredencial').check();page.locator('#confirmarLimpiar').click();page.wait_for_timeout(500)
 assert page.locator('#consulta').input_value()=='' and page.locator('#empleado').input_value()=='' and page.locator('#sucursal').input_value()==''
 assert ctx.request.get(url+'/api/sucursal/expedientes').json()['expedientes']==antes
 page.locator('#historialSucursal summary').click();page.locator('#listaAtenciones button').first.click()
 page.get_by_role('button',name='Verificar acta',exact=True).click();page.wait_for_url('**/verificar?desde=sucursal#*');page.get_by_text('Acta válida',exact=True).wait_for();assert page.url==acta_url
 assert not errors,errors
 print(json.dumps({'fecha_registro_panama_con_navegador_utc':True,'limpieza_sucursal_cancelar_y_confirmar':True,'historial_conservado_y_acta_recuperada':True,'guardar_un_campo_conserva_otros':True,'cierre_bloqueado_con_cambios_sin_guardar':True,'tablero_filtro':True,'csv_filtrado':True,'prioridades':True,'sin_desborde_390':True,'expediente_real_cerrado':True,'firma_valida':True,'verificacion_sin_red':True,'nueva_atencion_limpia':True,'errores_js':errors},ensure_ascii=False));b.close()

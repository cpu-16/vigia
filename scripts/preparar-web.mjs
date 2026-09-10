// Exporta dos herramientas que funcionan enteramente en el navegador.
// Conserva el catálogo, sus licencias y el verificador criptográfico originales.
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),web=join(root,'web'),node='';
const sinPwa=html=>html.replace(/<link rel="manifest"[^>]*>\n/,'').replace(/<script src="\/pwa.js"[^>]*><\/script>\n/,'');
const catalogo=join(web,'catalogo');await mkdir(join(catalogo,'placas'),{recursive:true});
let html=sinPwa(await readFile(join(root,'app/catalogo.html'),'utf8'));
html=html.replaceAll('/catalogo-FUENTES.json','/catalogo/catalogo-FUENTES.json').replaceAll('/placas/','/catalogo/placas/').replaceAll('/${e.foto}','/catalogo/${e.foto}').replaceAll('href="/equipos"',`href="${node}/equipos"`).replaceAll('href="/tablero"',`href="${node}/tablero"`);
html=html.replace('cada uno con su placa sintética','con placas sintéticas y casos sin placa').replace('</b></p>','</b><span>Catálogo público de demostración · ciberpty. Capturar y abrir el tablero requieren acceso al nodo del equipo.</span></p>');
await writeFile(join(catalogo,'index.html'),html);
for(const file of await readdir(join(root,'app')))if(/^catalogo-.*\.(jpg|json)$/.test(file))await copyFile(join(root,'app',file),join(catalogo,file));
for(const file of await readdir(join(root,'fixtures/placas')))if(file.endsWith('.png'))await copyFile(join(root,'fixtures/placas',file),join(catalogo,'placas',file));
const verificar=join(web,'verificar');await mkdir(verificar,{recursive:true});
html=sinPwa(await readFile(join(root,'app/verificar.html'),'utf8')).replace("from '/verificar.js'","from './verificar.js'");
html=html.replaceAll("'/sucursal'",`'${node}/sucursal'`).replaceAll("'/equipos'",`'${node}/equipos'`).replaceAll('href="/sucursal#historialSucursal"',`href="${node}/sucursal#historialSucursal"`).replaceAll('href="/tablero"',`href="${node}/tablero"`);
html=html.replace('<div class="losa" id="btnEjemplo">','<button type="button" class="losa" id="btnEjemplo">').replace('Acta de ejemplo</div>','Acta de ejemplo</button>');
await writeFile(join(verificar,'index.html'),html);await copyFile(join(root,'app/verificar.js'),join(verificar,'verificar.js'));
console.log('Catálogo público y verificador preparados; no requieren API ni credenciales.');

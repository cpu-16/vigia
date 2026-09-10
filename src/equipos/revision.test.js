import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { revision, incorporarPlaca } from './revision.js';
import { Base } from './almacen.js';
const borrador = () => ({customer:{name:'Hospital DemoCare Pacific',city:null,country:'Panama'},equipment:[{modality:'MR',quantity:2,manufacturer:null,model:null,age_years_min:null,age_years_max:null}]});
const foto = {modo:'placa',campos:{manufacturer:'NovaMed',model:'NM-MR 700',serial:'DEMO-01',modality:'MR',mfg:'2020-01'},desacuerdos:[]};
test('la revisión humana conserva respuestas y omite pendientes sin inferencia',()=>{
 const b=borrador();const r=revision(b,{'customer.location:null':'David, Panama','manufacturer:0':'No sé','age:0':'No sé'});
 assert.equal(r.borrador.customer.city,'David');assert.equal(r.borrador.equipment[0].manufacturer,null);
 assert.deepEqual(r.preguntas.map(q=>q.campo),['directo']);assert.equal(b.customer.city,null);
});
test('foto de una unidad conserva cantidad total y no inventa antigüedad de instalación',()=>{
 const b=revision(borrador(),{'quantity:0':2,'customer.location:null':'David, Panama'}).borrador;
 const r=incorporarPlaca(b,foto,0);const revisada=revision(r.borrador,{'quantity:0':1,'customer.location:null':'David, Panama'}).borrador;
 assert.equal(r.separada,true);assert.equal(revisada.equipment.reduce((n,g)=>n+g.quantity,0),2);
 assert.equal(revisada.equipment[0].serial,'DEMO-01');assert.equal(revisada.equipment[1].serial,undefined);
 assert.equal(revisada.equipment[1].manufacturer,null);assert.equal(revisada.equipment[0].age_years_min,null);
 assert.equal(revisada.customer.city,'David');assert.equal(b.equipment.length,1);
});
test('placa contradictoria o de otro equipo conserva los datos originales',()=>{
 const b=borrador();b.equipment[0].manufacturer='BluePeak Medical';
 assert.throws(()=>incorporarPlaca(b,foto,0),/discrepa/);assert.equal(b.equipment.length,1);
 assert.throws(()=>incorporarPlaca(borrador(),{...foto,campos:{modality:'CT'}},0),/modalidad/);
 assert.throws(()=>incorporarPlaca(borrador(),{...foto,desacuerdos:[{campo:'serial'}]},0),/contradictorios/);
});
test('inventario no colapsa unidad identificada y resto del grupo',()=>{
 const dir=mkdtempSync(join(tmpdir(),'vigia-foto-'));
 try {const base=new Base(join(dir,'eventos.jsonl'));const r=incorporarPlaca(borrador(),foto,0);
 base.guardar(r.borrador,{observador:'Prueba'});
 assert.equal(base.inventario()[0].equipos.length,2);assert.equal(base.agregado('modality')[0].unidades,2);
 base.guardar({customer:r.borrador.customer,equipment:[r.borrador.equipment[0]]},{observador:'Otra persona'});
 assert.equal(base.agregado('modality')[0].unidades,2);
 const distinta=structuredClone(r.borrador.equipment[0]);distinta.serial='DEMO-02';base.guardar({customer:r.borrador.customer,equipment:[distinta]});
 assert.equal(base.agregado('modality')[0].unidades,3);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('una serie no puede asignarse a dos unidades de la misma visita',()=>{
 const b=borrador();b.equipment[0].quantity=3;
 const r=incorporarPlaca(b,foto,0);
 assert.throws(()=>incorporarPlaca(r.borrador,foto,1),/ya está asignada/);
 assert.equal(r.borrador.equipment.reduce((n,g)=>n+g.quantity,0),3);
});
test('cantidad inválida no se acepta como respuesta confirmada',()=>{
 for (const valor of ['tres',0,-1,1.5]) assert.throws(()=>revision(borrador(),{'quantity:0':valor}),/entero/);
});
test('una edad abierta confirmada no se reemplaza silenciosamente ni se pide otra vez',()=>{
 const dir=mkdtempSync(join(tmpdir(),'vigia-edad-'));
 try {const base=new Base(join(dir,'eventos.jsonl'));const b=incorporarPlaca(borrador(),foto,0).borrador;b.equipment=b.equipment.slice(0,1);
 Object.assign(b.equipment[0],{age_years_min:11,age_years_max:null});base.guardar(b);
 Object.assign(b.equipment[0],{age_years_min:3,age_years_max:7});base.guardar(b);
 assert.equal(base.inventario()[0].equipos[0].age_years_min,11);
 assert.equal(base.renovaciones()[0].clase,'reemplazar');assert.equal(base.incompletos().length,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('países equivalentes no fragmentan los agregados por idioma o acento',()=>{
 const dir=mkdtempSync(join(tmpdir(),'vigia-pais-'));
 try{const base=new Base(join(dir,'eventos.jsonl'));
 for(const [i,country] of ['Panamá','Panama','PA'].entries()){const b=borrador();b.customer={name:'Clínica sintética '+i,country};b.equipment[0].quantity=1;base.guardar(b);}
 assert.deepEqual(base.agregado('country'),[{clave:'Panamá',unidades:3,clientes:3,reemplazar:0}]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

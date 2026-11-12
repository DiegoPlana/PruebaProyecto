import test from 'node:test';
import assert from 'node:assert/strict';
import {dates,date,contact,integer,uuid} from '../src/validation.mjs';
test('rechaza fechas inexistentes, intervalos vacíos, pasados y excesivos',()=>{
 for(const invalid of ['2026-02-30','ayer','2026-13-01'])assert.throws(()=>date(invalid));
 assert.throws(()=>dates('2090-01-01','2090-01-01'));
 assert.throws(()=>dates('2000-01-01','2000-01-02'));
 assert.throws(()=>dates('2090-01-01','2092-01-01'));
 assert.deepEqual(dates('2090-02-01','2090-02-02'),['2090-02-01','2090-02-02']);
});
test('email y teléfono obligatorios y notas limitadas',()=>{
 const good={firstName:' Prueba ',lastName:'Ficticia',email:'TEST@example.test',phone:'+34 600 000 000'};
 assert.equal(contact(good).email,'test@example.test');assert.equal(contact(good).firstName,'Prueba');
 for(const patch of [{email:''},{phone:''},{email:'sin-arroba'},{phone:'abc'},{notes:'x'.repeat(1001)}])assert.throws(()=>contact({...good,...patch}));
});
test('identificadores y cantidades estrictos',()=>{
 for(const v of ['2',1.5,-2,0,501])assert.throws(()=>integer(v,'personas'));
 assert.throws(()=>uuid('no-es-uuid'));assert.equal(uuid('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
});

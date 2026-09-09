// Proveedor de inferencia: presta la GPU de este equipo a otros nodos por llave pública.
// Es el lado que corre en la laptop, en el Raspberry Pi de la sucursal o en la Mac de la
// oficina regional. El consumidor (el teléfono) se conecta por el DHT de Hyperswarm con la
// llave; no hay servidor intermedio, no hay nube, y sin la llave correcta no hay inferencia.
//
// Corre:  GGML_VK_VISIBLE_DEVICES=1 node src/puente/proveedor.js [--consumidor <llave>]
import { startQVACProvider, stopQVACProvider, subscribeServerLogs } from '@qvac/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname } from 'node:path';
import { registrar } from '../core/rendimiento.js';

// La identidad del proveedor se deriva de una semilla guardada: así la llave no cambia entre
// reinicios y se puede imprimir en un QR o dejarla configurada en los teléfonos del equipo.
export function semillaEstable(ruta = process.env.SEMILLA_P2P ?? 'datos/p2p-semilla') {
  if (!existsSync(ruta)) { mkdirSync(dirname(ruta), { recursive: true }); writeFileSync(ruta, randomBytes(32).toString('hex'), { mode: 0o600 }); }
  return readFileSync(ruta, 'utf8').trim();
}

export async function arrancarProveedor({ consumidoresPermitidos = [], semilla = semillaEstable(), etiqueta = 'proveedor' } = {}) {
  if (semilla) process.env.QVAC_HYPERSWARM_SEED = semilla;
  const r = await startQVACProvider({
    ...(consumidoresPermitidos.length ? { firewall: { mode: 'allow', publicKeys: consumidoresPermitidos } } : {}) });
  registrar({ stage: 'provider', status: 'ok', model: etiqueta, execution_mode: 'provider',
    provider: r.publicKey?.slice(0, 16), firewall: consumidoresPermitidos.length ? 'allow' : 'abierto' });
  return { publicKey: r.publicKey, detener: () => stopQVACProvider().catch(() => {}) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--consumidor');
  const permitidos = i > 0 && process.argv[i + 1] ? [process.argv[i + 1]] : [];
  const { publicKey } = await arrancarProveedor({ consumidoresPermitidos: permitidos });
  console.log('▸ Proveedor QVAC listo. Este equipo presta su cómputo a quien tenga esta llave:\n');
  console.log(`   ${publicKey}\n`);
  if (permitidos.length) console.log(`▸ Cortafuegos: solo se acepta al consumidor ${permitidos[0].slice(0, 16)}…\n`);
  console.log('▸ En el teléfono:  P2P_PROVEEDOR=<llave> node src/puente/nodo.js\n');
  // Cada solicitud delegada se ve en esta terminal: es la evidencia en cámara.
  subscribeServerLogs(l => { const t = typeof l === 'string' ? l : JSON.stringify(l);
    if (/delegat|consumer|request|inference/i.test(t)) console.log(`  · ${new Date().toLocaleTimeString('es-PA')} ${t.slice(0, 160)}`); });
  process.on('SIGINT', async () => { await stopQVACProvider().catch(() => {}); process.exit(0); });
}

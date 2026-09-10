import { prepararLectura } from '../app/texto-voz.js';
// Comparación real: genera audios sintéticos; requiere QVAC y nodo con Whisper.
import {loadModel,unloadModel,textToSpeech,TTS_MULTILINGUAL_SUPERTONIC2_Q4_0,TTS_MULTILINGUAL_SUPERTONIC2_Q8_0,TTS_MULTILINGUAL_SUPERTONIC3_Q4_0,TTS_MULTILINGUAL_SUPERTONIC3_Q8_0} from '@qvac/sdk';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {crearWav} from '../src/core/wav.js';
const modelos=[['supertonic3-q8', TTS_MULTILINGUAL_SUPERTONIC3_Q8_0],['supertonic2-q4',TTS_MULTILINGUAL_SUPERTONIC2_Q4_0],['supertonic2-q8',TTS_MULTILINGUAL_SUPERTONIC2_Q8_0],['supertonic3-q4',TTS_MULTILINGUAL_SUPERTONIC3_Q4_0]];
const frases=process.env.PRUEBA_DOMINIO ? ['Confirmaste tres resonadores. Queda pendiente la marca del tomógrafo.','El monto de B/. 80.00 es documental. Esta aplicación no autoriza retiros.','El equipo tiene entre siete y nueve años. La fecha de observación es el nueve de septiembre de dos mil veintiséis.','¿Lo viste directamente o te lo contaron?'] : ['¿Cuántos equipos viste? Puedes añadir una foto de la placa para completar el modelo y la serie.','La consulta no tiene respaldo en la guía. Puedes documentarla para seguimiento. No se ha autorizado ninguna transacción.'];
const gpu=()=>Number(execFileSync('nvidia-smi',['--query-gpu=memory.used','--format=csv,noheader,nounits'],{encoding:'utf8'}).trim());
function memoria(){const filas=execFileSync('ps',['-eo','pid=,ppid=,rss='],{encoding:'utf8'}).trim().split('\n').map(x=>x.trim().split(/\s+/).map(Number));const ids=new Set([process.pid]);for(let i=0;i<5;i++)for(const [pid,ppid] of filas)if(ids.has(ppid))ids.add(pid);return filas.filter(([pid])=>ids.has(pid)).reduce((s,f)=>s+f[2],0)/1024;}
const resultados=[];
for(const [nombre,modelSrc] of modelos.filter(([n]) => !process.env.SOLO_MODELOS || process.env.SOLO_MODELOS.split(',').includes(n))){
 for(const useGPU of (process.env.SOLO_GPU ? [true] : [false,true])){
  let id; const antes=gpu(),t=performance.now();let picoRss=memoria();const muestreo=setInterval(()=>{picoRss=Math.max(picoRss,memoria());},250);
  const r={modelo:nombre,solicitado:useGPU?'gpu':'cpu',frases:[]};console.log('Probando',nombre,r.solicitado);
  try{
   id=await loadModel({modelSrc,modelType:'tts',modelConfig:{ttsEngine:'supertonic',language:'es',voice:'F1',ttsSpeed:1.05,ttsNumInferenceSteps:5,useGPU}});
   r.carga_ms=Math.round(performance.now()-t);r.vram_antes_mib=antes;r.vram_cargado_mib=gpu();
   for(let i=0;i<frases.length;i++){
    const inicio=performance.now();const muestras=await textToSpeech({modelId:id,text:process.env.NORMALIZAR ? prepararLectura(frases[i]) : frases[i],inputType:'text',stream:false}).buffer;const ms=Math.round(performance.now()-inicio);const wav=crearWav(muestras);
    const archivo=`evidencia/voz-opcional/${nombre}-${r.solicitado}-${process.env.NORMALIZAR ? 'normalizado-' : process.env.PRUEBA_DOMINIO ? 'dominio-' : ''}${i}.wav`;writeFileSync(archivo,wav);
    const f={texto:frases[i],texto_sintetizado:process.env.NORMALIZAR ? prepararLectura(frases[i]) : frases[i],archivo,ms,duracion_s:muestras.length/44100,pico:0,clipping:muestras.filter(x=>Math.abs(x)>=32767).length/muestras.length};
    f.pico=muestras.reduce((m,x)=>Math.max(m,Math.abs(x)),0);r.frases.push(f);
   }
  }catch(e){r.error=String(e.message);}finally{clearInterval(muestreo);r.rss_arbol_max_mib=Math.round(picoRss);if(id)await unloadModel({modelId:id});}
  // Transcripción independiente del TTS, con Whisper ya cargado en el nodo.
  for(const f of r.frases){try{const {readFileSync}=await import('node:fs');const res=await fetch('http://127.0.0.1:7320/api/dictar',{method:'POST',headers:{Cookie:`vigia=${process.env.CLAVE}`},body:readFileSync(f.archivo)});f.asr=await res.json();}catch(e){f.asr_error=e.message;}}
  resultados.push(r);writeFileSync(process.env.SALIDA_TTS ?? 'evidencia/voz-opcional/comparacion.json',JSON.stringify(resultados,null,2));console.log(JSON.stringify(r));
 }
}
process.exit(0);

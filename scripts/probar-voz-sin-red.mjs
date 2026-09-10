// Ejecutar en un namespace sin red, con modelos ya descargados.
import {readFileSync,writeFileSync} from 'node:fs';
import {loadModel,textToSpeech,unloadModel,TTS_MULTILINGUAL_SUPERTONIC2_Q8_0} from '@qvac/sdk';
import {crearWav} from '../src/core/wav.js';
const rutas=readFileSync('/proc/net/route','utf8').trim().split('\n').slice(1);
if(rutas.length)throw new Error('Esta prueba requiere un espacio de red sin rutas');
let externa=false;try{await fetch('http://1.1.1.1',{signal:AbortSignal.timeout(1500)});externa=true;}catch{}
if(externa)throw new Error('Hay acceso externo');
const id=await loadModel({modelSrc:TTS_MULTILINGUAL_SUPERTONIC2_Q8_0,modelType:'tts',modelConfig:{ttsEngine:'supertonic',language:'es',voice:'F1',ttsSpeed:1.05,ttsNumInferenceSteps:5,useGPU:true}});
try{
 const t=performance.now();const a=await textToSpeech({modelId:id,text:'Sin acceso a Internet, esta voz se genera con QVAC en el nodo local.',inputType:'text',stream:false}).buffer;
 writeFileSync('evidencia/voz-opcional/sin-red.wav',crearWav(a));
 writeFileSync('evidencia/voz-opcional/sin-red.json',JSON.stringify({rutas,acceso_externo:externa,modelo:'Supertonic 2 Q8',modo:'local',hardware:'RTX 4060',ms:Math.round(performance.now()-t),segundos:a.length/44100},null,2));
}finally{await unloadModel({modelId:id});}process.exit(0);

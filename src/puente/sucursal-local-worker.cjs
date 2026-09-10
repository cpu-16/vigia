// Ejecutado por Bare dentro de Termux; rutas únicas por solicitud, sin red ni SDK worker.
const fs = require('bare-fs');
const path = require('bare-path');
const jobPath = Bare.argv[2];
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const output = jobPath + '.result.json';
async function main() {
  const root = path.resolve('.');
  const modelPath = path.join(root, 'qwen3-0.6b-q4.gguf');
  const source = path.join(root, 'node_modules/@qvac/llm-llamacpp/prebuilds/android-arm64/qvac__llm-llamacpp');
  const backendsDir = path.join(root, 'qvac-cpu-prebuilds');
  const target = path.join(backendsDir, 'android-arm64/qvac__llm-llamacpp');
  for (const d of [backendsDir, path.join(backendsDir, 'android-arm64'), target]) if (!fs.existsSync(d)) fs.mkdirSync(d);
  for (const f of fs.readdirSync(source)) if (/^libqvac-ggml-cpu-.*\.so$/.test(f) && !fs.existsSync(path.join(target, f))) fs.copyFileSync(path.join(source, f), path.join(target, f));
  const Llm = require('@qvac/llm-llamacpp');
  const model = new Llm({ files: {model:[modelPath]}, config:{device:'cpu',backendsDir,gpu_layers:'0',ctx_size:'512',predict:'32',temp:'0',seed:'42',verbosity:'0',no_mmap:'false'}, logger:{log(){},info(){},warn(){},error(){},debug(){}}, opts:{stats:true} });
  const start = Date.now(); await model.load(); const loadMs = Date.now()-start;
  fs.writeFileSync(jobPath+'.phase.json',JSON.stringify({fase:'inferencia',carga_ms:loadMs}));
  const inferStart = Date.now();
  const result = await model.run([{role:'system',content:'Responde en español en una sola frase breve usando SOLO la guía proporcionada. Copia el dato pertinente. Si no está, responde "Sin respaldo en la guía". No inventes ni autorices operaciones. /no_think'}, {role:'user',content:job.prompt}], {generationParams:{predict:32,temp:0,seed:42,reasoning_budget:0}});
  const tokens=[]; for await(const token of result.iterate()) tokens.push(token);
  const resultJson={respuesta:tokens.join(''),carga_ms:loadMs,inferencia_ms:Date.now()-inferStart,stats:result.stats};
  await model.unload();
  fs.writeFileSync(output,JSON.stringify(resultJson));
}
main().then(()=>Bare.exit(0)).catch(e=>{fs.writeFileSync(output,JSON.stringify({error:String(e.stack||e)}));Bare.exit(1)});

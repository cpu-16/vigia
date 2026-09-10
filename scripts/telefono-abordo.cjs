// Igual que FUNCIONA.cjs, pero el prompt y el largo entran por variables de entorno: sirve para
// medir una pregunta del producto y no un «2+2». Mismo truco de backends: solo CPU, porque el
// linker de Android crashea explorando Vulkan (ver CELULAR-QVAC.md).
const fs = require('bare-fs')
const path = require('bare-path')
const outPath = path.resolve('./abordo-result.txt')
const log = v => fs.appendFileSync(outPath, String(v) + '\n')

// Bare no es Node: no hay `process` NI `Bare.env` (solo `Bare.argv`). Leer process.env mataba el
// módulo antes del primer log y el proceso salía con 0 sin escribir nada. La pregunta entra por
// archivo: «sistema» en la primera línea, la pregunta en el resto. Sin comillas que escapar.
const pregunta = fs.readFileSync(path.resolve('./prompt.txt'), 'utf8').split('\n')
const SISTEMA = pregunta[0].trim() || 'Responde en español, breve y directo.'
const PROMPT = pregunta.slice(1).join('\n').trim() || '¿Cuánto es 2+2?'
const PREDICT = Number(Bare.argv[2] || 64)

async function main() {
  fs.writeFileSync(outPath, '')
  const modelPath = path.resolve('./qwen3-0.6b-q4.gguf')
  const packagedBackends = path.resolve('./node_modules/@qvac/llm-llamacpp/prebuilds/android-arm64/qvac__llm-llamacpp')
  const cpuPrebuilds = path.resolve('./qvac-cpu-prebuilds')
  const cpuBackends = path.join(cpuPrebuilds, 'android-arm64', 'qvac__llm-llamacpp')
  for (const dir of [cpuPrebuilds, path.join(cpuPrebuilds, 'android-arm64'), cpuBackends]) if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  for (const name of fs.readdirSync(packagedBackends)) {
    if (name.startsWith('libqvac-ggml-cpu-') && name.endsWith('.so')) {
      const t = path.join(cpuBackends, name)
      if (!fs.existsSync(t)) fs.copyFileSync(path.join(packagedBackends, name), t)
    }
  }
  const LlmLlamacpp = require('@qvac/llm-llamacpp')
  log(`PROMPT ${PROMPT}`)
  const model = new LlmLlamacpp({
    files: { model: [modelPath] },
    config: { device: 'cpu', backendsDir: cpuPrebuilds, gpu_layers: '0', ctx_size: '2048',
      predict: String(PREDICT), temp: '0.1', seed: '42', verbosity: '0', no_mmap: 'true' },
    logger: { log: () => {}, info: () => {}, warn: () => {}, error: log, debug: () => {} },
    opts: { stats: true }
  })
  const t0 = Date.now(); await model.load(); log(`LOAD_OK_MS ${Date.now() - t0}`)
  const t1 = Date.now()
  const res = await model.run([{ role: 'system', content: SISTEMA }, { role: 'user', content: PROMPT }],
    { generationParams: { predict: PREDICT, temp: 0.1, seed: 42, reasoning_budget: 0 } })
  const chunks = []
  for await (const tok of res.iterate()) chunks.push(tok)
  log(`ANSWER ${chunks.join('')}`)
  log(`RUN_MS ${Date.now() - t1}`)
  log(`STATS ${JSON.stringify(res.stats)}`)
  await model.unload()
}
main().then(() => { log('SUCCESS'); Bare.exit(0) }).catch(e => { log(`ERROR ${e && e.stack ? e.stack : e}`); Bare.exit(1) })

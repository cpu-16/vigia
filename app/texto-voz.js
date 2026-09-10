// Expande la notación monetaria panameña para evitar que TTS lea «B barra punto».
// Conserva la cantidad; no interpreta políticas ni modifica el texto mostrado.
export function prepararLectura(texto) {
  return String(texto).replace(/\bB\/\.\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?(?!\d|[.,]\d)/g, (_, entero, centavos) => {
    const n = entero.replaceAll(',', '');
    return `${n} ${Number(n) === 1 ? 'balboa' : 'balboas'}${centavos && centavos !== '00' ? ` con ${Number(centavos)} ${Number(centavos) === 1 ? 'centésimo' : 'centésimos'}` : ''}`;
  });
}

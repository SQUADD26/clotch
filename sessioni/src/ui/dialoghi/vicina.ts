/** La sessione dopo (`passo` 1) o prima (-1) di quella aperta, nell'ordine dell'elenco, ricominciando dall'altra estremità; null se non c'è altra sessione. */
export function vicina(elenco: { id: string }[], aperta: string | null, passo: 1 | -1): string | null {
  if (!elenco.length || (elenco.length === 1 && elenco[0].id === aperta)) return null;
  const i = elenco.findIndex((s) => s.id === aperta);
  return elenco[i < 0 ? (passo === 1 ? 0 : elenco.length - 1) : (i + passo + elenco.length) % elenco.length].id;
}

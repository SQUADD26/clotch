/** La prossima sessione che aspetta Roberto, nell'ordine dell'elenco, dopo quella aperta e ricominciando dall'inizio; null se nessun'altra aspetta. */
export function prossimaInAttesa(elenco: { id: string; stato: string }[], aperta: string | null): string | null {
  const da = elenco.findIndex((s) => s.id === aperta) + 1; // aperta assente: si parte dalla prima
  const giro = [...elenco.slice(da), ...elenco.slice(0, da)];
  return giro.find((s) => s.stato === "aspetta" && s.id !== aperta)?.id ?? null;
}

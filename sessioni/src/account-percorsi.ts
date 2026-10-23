// Quali cartelle ~/.claude-* si leggono: quelle trovate, più le aggiunte, meno le tolte. Lo usano main (elenco) e Impostazioni · Account.
export const percorsiAccount = (trovate: string[], aggiunte: string[], tolte: string[]): string[] =>
  [...trovate, ...aggiunte.filter((p) => !trovate.includes(p))].filter((p) => !tolte.includes(p));

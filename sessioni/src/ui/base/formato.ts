// Orari, date e plurali scritti in un modo solo (#625): «14:12», «23 ott», «Oggi», «Ieri», «1 regola», «3 regole».
export const orario = (t: number) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
export const dataBreve = (t: number) => new Date(t).toLocaleDateString("it-IT", { day: "numeric", month: "short" }).replace(".", "");
export function giornoRelativo(t: number, ora: number) {
  const ieri = new Date(ora); ieri.setDate(ieri.getDate() - 1);
  const stesso = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  return stesso(new Date(t), new Date(ora)) ? "Oggi" : stesso(new Date(t), ieri) ? "Ieri" : dataBreve(t);
}
export const plurale = (n: number, uno: string, tanti: string) => `${n.toLocaleString("it-IT")} ${n === 1 ? uno : tanti}`;

// Ore e date come nei frame Friday: «14:12», «23 ott».
export const orario = (t: number) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
export const giorno = (t: number) => new Date(t).toLocaleDateString("it-IT", { day: "numeric", month: "short" });

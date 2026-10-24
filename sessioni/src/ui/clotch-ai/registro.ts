// Dal registro senza Map (canale `clotch-ai:registro`) al `Registro` che leggono le viste.
import type { Registro } from "../../clotch-ai";

/** Ultima chat vista per id: una chat che non è cambiata resta lo stesso oggetto, così chi la mostra non si ridisegna (#474). */
const viste = new Map<string, { json: string; c: any }>();

export function daPiano(p: any): Registro {
  const chat = new Map<string, any>(Object.entries(p.chat ?? {}).map(([k, c]: [string, any]) => {
    const json = JSON.stringify(c), v = viste.get(k);
    if (v?.json === json) return [k, v.c];
    const n = { ...c, aiutanti: new Map(Object.entries(c.aiutanti ?? {})) };
    viste.set(k, { json, c: n });
    return [k, n];
  }));
  for (const k of viste.keys()) if (!chat.has(k)) viste.delete(k);
  return { ...p, chat, esiti: new Map(Object.entries(p.esiti ?? {})) };
}

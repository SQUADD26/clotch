// Dal registro senza Map (canale `clotch-ai:registro`) al `Registro` che leggono le viste.
import type { Registro } from "../../clotch-ai";

/** Ultima chat vista per id: una chat che non è cambiata resta lo stesso oggetto, così chi la mostra non si ridisegna (#474). */
const viste = new Map<string, { json: string; c: any }>();

/** Le parti cambiate (`clotch-ai:registro` con `parziale`, clotch-ai-ipc.ts) sul registro di prima: le chat non toccate restano gli stessi oggetti. */
export function applicaParziale(r: Registro, p: any): Registro {
  const chat = new Map(r.chat);
  for (const [k, c] of Object.entries(p.chat ?? {}) as [string, any][]) chat.set(k, { ...c, aiutanti: new Map(Object.entries(c.aiutanti ?? {})) });
  for (const k of p.tolte ?? []) chat.delete(k);
  const campi = { ...(p.campi ?? {}) };
  if (campi.esiti) campi.esiti = new Map(Object.entries(campi.esiti));
  return { ...r, ...campi, chat };
}

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

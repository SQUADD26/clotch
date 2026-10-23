// Dal registro senza Map (canale `friday:registro`) al `Registro` che leggono le viste.
import type { Registro } from "../../friday";

export function daPiano(p: any): Registro {
  const chat = new Map<string, any>(Object.entries(p.chat ?? {}).map(([k, c]: [string, any]) => [k, { ...c, aiutanti: new Map(Object.entries(c.aiutanti ?? {})) }]));
  return { ...p, chat, esiti: new Map(Object.entries(p.esiti ?? {})) };
}

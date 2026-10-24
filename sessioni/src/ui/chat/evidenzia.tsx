// figma: 131-59690 — colori del codice: colore/codice/{parola,testo,funzione,numero,commento} (blocco codice copiabile 131:59881).
import type { ReactNode } from "react";

const PAROLE = new Set("const let var function return if else for while import from export class new async await def func struct enum case switch try catch throw in of true false null nil self guard where public private static type interface".split(" "));
const SHELL = new Set(["", "sh", "bash", "zsh", "shell", "console"]);
// commento | testo tra apici | opzione di riga di comando | numero | nome
const TOKEN = /((?:^|\s)#.*|\/\/.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|((?:^|\s)--?[A-Za-z][\w-]*)|(\b\d[\d.]*\b)|([A-Za-z_]\w*)/g;

/** Evidenziatore a regole, senza grammatiche: basta per i comandi e il codice breve di una risposta. */
export function evidenzia(testo: string, lingua = ""): ReactNode[] {
  const shell = SHELL.has(lingua);
  return testo.split("\n").flatMap((riga, i) => {
    let primo = shell, fine = 0;
    const out: ReactNode[] = i ? ["\n"] : [];
    for (const m of riga.matchAll(TOKEN)) {
      const [t, commento, stringa, opzione, numero, nome] = m;
      const classe = commento ? "commento" : stringa ? "testo" : opzione && shell ? "parola" : numero ? "numero"
        : nome && (primo || riga[m.index + t.length] === "(") ? "funzione" : nome && PAROLE.has(nome) ? "parola" : null;
      if (nome || opzione) primo = false;
      out.push(riga.slice(fine, m.index));
      out.push(classe ? <span key={`${i}-${m.index}`} className={`cod-${classe}`}>{t}</span> : t);
      fine = m.index + t.length;
    }
    out.push(riga.slice(fine));
    return out;
  });
}

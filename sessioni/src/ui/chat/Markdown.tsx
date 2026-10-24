// figma: 131-59690 — risposta formattata (titoli, elenchi, codice, citazione, tabella); 140-60491 tabella larga e lunga.
// Testo 101-7216; codice 101-7213; link 101-28289.
import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { toString } from "mdast-util-to-string";
import type { List, Nodes } from "mdast";
import { avvisa } from "../base/Avvisi";
import { BottoneIcona } from "../base/Bottone";
import { Icona } from "../base/Icona";
import { evidenzia } from "./evidenzia";
import { provaDi } from "./testi";
import "./markdown.css";

const parser = unified().use(remarkParse).use(remarkGfm);

/** Copia dagli stessi nodi del renderer, senza regex che alterano codice o link annidati. */
export function senzaMarkdown(testo: string): string {
  // segno («1.», «-», «[x]») e rientro delle voci, una riga a capo fra voci
  const lista = (n: List, rientro: string): string => n.children.map((li, i) => {
    const [primo, ...resto] = li.children;
    const stato = li.checked == null ? "" : li.checked ? "[x] " : "[ ] ";
    return `${rientro}${n.ordered ? `${(n.start ?? 1) + i}.` : "-"} ${stato}${primo ? leggi(primo) : ""}${resto.map((c) => c.type === "list" ? `\n${lista(c, rientro + "  ")}` : `\n${rientro}  ${leggi(c)}`).join("")}`;
  }).join("\n");
  const leggi = (n: Nodes): string => {
    if (n.type === "list") return lista(n, "");
    if (n.type === "html") return "";
    if (n.type === "break") return "\n";
    if (n.type === "paragraph" || n.type === "heading" || n.type === "emphasis" || n.type === "strong" || n.type === "delete" || n.type === "link" || n.type === "tableCell") return n.children.map(leggi).join("");
    if (n.type === "root" || n.type === "blockquote") return n.children.map(leggi).join("\n\n");
    if (n.type === "table") return n.children.map(leggi).join("\n");
    if (n.type === "tableRow") return n.children.map(leggi).join("\t");
    if (n.type === "listItem") return n.children.map(leggi).join("\n");
    return toString(n, { includeHtml: false });
  };
  return leggi(parser.parse(testo)).replace(/\n{3,}/g, "\n\n");
}

/** Solo indirizzi web si aprono; ogni altro (file, mail, ancora) resta scritto ma inerte, con l'indirizzo da copiare. */
const web = (url: string) => !/[\u0000-\u0020\u007f]/.test(url) && /^https?:\/\//i.test(url);

function Codice({ children }: { children?: ReactNode }) {
  const [copiato, setCopiato] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const code = isValidElement<{ children?: ReactNode; className?: string }>(children) ? children : null;
  const grezzo = String(code?.props.children ?? ""), testo = grezzo.replace(/\n$/, "");
  const lingua = code?.props.className?.replace(/^language-/, "");
  return <div className="blocco-codice markdown-codice">
    <div className="testata-codice">
      <span>{lingua}</span>
      <BottoneIcona icona={copiato ? "spunta" : "copia"} etichetta={copiato ? "Copiato" : "Copia codice"}
        onClick={() => {
          void navigator.clipboard.writeText(testo).then(() => { setCopiato(true); clearTimeout(timer.current); timer.current = window.setTimeout(() => setCopiato(false), 1500); })
            .catch(() => avvisa({ tipo: "errore", messaggio: "Copia non riuscita" }));
        }} />
    </div>
    <pre><code>{evidenzia(grezzo, lingua)}</code></pre>
  </div>;
}

/** Il riquadro scorre in entrambi i versi; `scorre` (più larga della colonna) mostra il bordo sotto la prima colonna fissa. */
function Tabella({ children }: { children?: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const [scorre, setScorre] = useState(false);
  useLayoutEffect(() => {
    const e = el.current!;
    setScorre(e.scrollWidth > e.clientWidth);
    // scena di prova «tabella:<px>» (140-60491): la tabella parte già scorsa di tanti px
    const x = Number(provaDi(new URLSearchParams(location.search).get("sezione"), "tabella"));
    if (x) e.scrollLeft = x;
  }, [children]);
  return <div ref={el} className={scorre ? "tabella-markdown scorre" : "tabella-markdown"} tabIndex={0}><table>{children}</table></div>;
}

/** Esiti noti di una cella: il punto prende il colore dello stato (colore/icona/…). */
const ESITI: Record<string, string> = { finita: "successo", verificata: "successo", verificate: "successo", "da rivedere": "accento", "in pausa": "secondaria", "in corso": "accento-blu" };

/** Il testo di un nodo React, anche dentro codice o grassetto: serve a misurare la colonna. */
const daNodo = (n: ReactNode): string => Children.toArray(n).map((c) => typeof c === "string" || typeof c === "number" ? String(c)
  : isValidElement<{ children?: ReactNode }>(c) ? daNodo(c.props.children) : "").join("");

const cella = (Tag: "th" | "td") => function Cella({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const testo = daNodo(children);
  const solo = Children.count(children) === 1 && typeof children === "string";
  const esito = Tag === "td" && solo ? ESITI[testo.trim().toLowerCase()] : undefined;
  const classe = style?.textAlign === "right" ? "numero" : testo.length > 20 ? "larga" : undefined;
  return <Tag style={style} className={classe}>{esito ? <span className="esito"><i className={`punto ${esito}`} />{children}</span> : children}</Tag>;
};

const Th = cella("th"), Td = cella("td");

/** HTML mai interpretato; immagini come testo alternativo, senza richieste di rete dal transcript. */
export function Markdown({ testo }: { testo: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} remarkRehypeOptions={{ footnoteLabel: "Note", footnoteBackLabel: "Torna al testo" }} skipHtml urlTransform={(u) => u} components={{
    pre: ({ children }) => <Codice>{children}</Codice>,
    a: ({ href = "", children, ...p }) => href.startsWith("#") ? <a href={href} {...p} onClick={(e) => {
      // richiamo di nota e «torna al testo»: scorrono dentro la stessa risposta (gli id sono uguali in ogni risposta)
      e.preventDefault();
      const el = e.currentTarget.closest(".markdown")?.querySelector<HTMLElement>(`[id="${href.slice(1)}"]`);
      el?.scrollIntoView({ block: "center" });
      (el?.matches("a") ? el : el?.querySelector<HTMLElement>("a"))?.focus({ preventScroll: true });
    }}>{children}</a> : web(href) ? <a href={href} title={href} target="_blank" rel="noreferrer noopener">{children}</a> : <span className="link-inerte" data-link={href} title={href}>{children}</span>,
    img: ({ alt }) => <span className="immagine"><Icona nome="immagine" />{alt || "Immagine"}</span>,
    ol: ({ start, children }) => <ol style={{ "--inizio": start ?? 1 } as CSSProperties}>{children}</ol>,
    table: ({ children }) => <Tabella>{children}</Tabella>,
    th: Th, td: Td,
  }}>{testo}</ReactMarkdown></div>;
}

// figma: 101-7216 — testo risposta; 101-7213 codice; 101-28289 link. Strutture Markdown: review visuale pendente.
import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { toString } from "mdast-util-to-string";
import type { Nodes } from "mdast";
import { BottoneIcona } from "../base/Bottone";

const parser = unified().use(remarkParse).use(remarkGfm);

/** Copia dagli stessi nodi del renderer, senza regex che alterano codice o link annidati. */
export function senzaMarkdown(testo: string): string {
  const leggi = (n: Nodes): string => {
    if (n.type === "html") return "";
    if (n.type === "break") return "\n";
    if (n.type === "paragraph" || n.type === "heading" || n.type === "emphasis" || n.type === "strong" || n.type === "delete" || n.type === "link" || n.type === "tableCell") return n.children.map(leggi).join("");
    if (n.type === "root" || n.type === "list" || n.type === "blockquote") return n.children.map(leggi).join("\n\n");
    if (n.type === "table") return n.children.map(leggi).join("\n");
    if (n.type === "tableRow") return n.children.map(leggi).join("\t");
    if (n.type === "listItem") return n.children.map(leggi).join("\n");
    return toString(n, { includeHtml: false });
  };
  return leggi(parser.parse(testo));
}

/** Solo destinazioni web e ancore del documento: mai percorsi locali o protocolli eseguibili. */
const destinazione = (url: string): string | undefined => {
  if (/[\u0000-\u0020\u007f]/.test(url)) return undefined;
  return /^(https?:\/\/|#)/i.test(url) ? url : undefined;
};

function Codice({ children }: { children?: ReactNode }) {
  const [copiato, setCopiato] = useState(false);
  const code = isValidElement<{ children?: ReactNode; className?: string }>(children) ? children : null;
  const testo = String(code?.props.children ?? "").replace(/\n$/, "");
  const lingua = code?.props.className?.replace(/^language-/, "");
  return <div className="blocco-codice markdown-codice">
    <div className="testata-codice">
      <span>{lingua}</span>
      <BottoneIcona icona={copiato ? "spunta" : "copia"} etichetta={copiato ? "Copiato" : "Copia codice"}
        onClick={() => { void navigator.clipboard.writeText(testo).then(() => setCopiato(true)).catch(() => setCopiato(false)); }} />
    </div>
    <pre>{children}</pre>
  </div>;
}

/** HTML mai interpretato; immagini come testo alternativo, senza richieste di rete dal transcript. */
export function Markdown({ testo }: { testo: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={destinazione} components={{
    pre: ({ children }) => <Codice>{children}</Codice>,
    a: ({ href, children }) => href ? <a href={href} target={href.startsWith("#") ? undefined : "_blank"} rel={href.startsWith("#") ? undefined : "noreferrer noopener"}>{children}</a> : <span>{children}</span>,
    img: ({ alt }) => <span>{alt}</span>,
    table: ({ children }) => <div className="tabella-markdown"><table>{children}</table></div>,
  }}>{testo}</ReactMarkdown>;
}

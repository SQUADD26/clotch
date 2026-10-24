// figma: 148-52243 — «menu ambiente» (Questo computer, Cloud, Remote Control, SSH); 148-52543 — «menu cartella» (recenti, Apri cartella…, Ramo, Worktree);
// 148-52864 — «menu ramo» (Predefiniti, Altri rami, ricerca); i selettori «Selettore avvio» (Riposo, Passaggio, Aperto, Spento, Errore).
import { useEffect, useState, type ReactNode } from "react";
import type { CartellaAvvio, ContestoCartella } from "../../tipi";
import { Icona, type NomeIcona } from "../base/Icona";
import { Sovrapposto } from "../base/Sovrapposto";
import { numero } from "../base/token";
import { Interruttore } from "../impostazioni/controlli";
import type { Macchina, Proposta } from "../../macchine-tipi";
import { gruppiRami, nomeAmbiente, type Ambiente } from "./avvio";
import type { ElencoMacchine } from "./usaMacchine";
import { PannelloSsh } from "./MenuMacchine";
import "./nuova-sessione.css";

export function Selettore({ icona, etichetta, aperto = false, stato, avviso = false, fisso = false, onClick, children }: {
  icona: NomeIcona; etichetta: string; aperto?: boolean; stato?: "spento" | "errore"; /** Icona gialla: la macchina non è pronta. */ avviso?: boolean; /** Si legge soltanto (ramo di una macchina SSH): senza menu. */ fisso?: boolean; onClick(): void; children?: ReactNode;
}) {
  const colore = stato === "errore" ? "errore" : avviso ? "lavoro" : stato === "spento" ? "terziaria" : "secondaria";
  return (
    <span className="selettore-avvio">
      <button type="button" className={`selettore${aperto ? " aperto" : ""}${stato ? ` ${stato}` : ""}`} aria-haspopup={fisso ? undefined : "menu"} aria-expanded={fisso ? undefined : aperto} disabled={fisso} onClick={onClick}>
        <Icona nome={icona} colore={colore} /><span className="etichetta">{etichetta}</span>
      </button>
      {children}
    </span>
  );
}

/** Menu sopra il suo selettore (base/Sovrapposto: Esc o un clic fuori lo chiudono, il fuoco torna al selettore): ricerca in cima, frecce tra le voci.
 *  `rif`: il menu, per il pannello SSH che gli sta a destra. */
function Menu({ segnaposto, cerca, onCerca, larga = false, rif, onChiudi, children }: {
  segnaposto: string; cerca: string; onCerca(t: string): void; larga?: boolean; rif?(el: HTMLDivElement | null): void; onChiudi(): void; children: ReactNode;
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el) return;
    el.querySelector("input")?.focus();
    const tasto = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const v = [...el.querySelectorAll<HTMLElement>("input, button.voce:not(:disabled)")], i = v.indexOf(document.activeElement as HTMLElement);
      v[(i + (e.key === "ArrowDown" ? 1 : v.length - 1)) % v.length]?.focus();
      e.preventDefault();
    };
    el.addEventListener("keydown", tasto);
    return () => el.removeEventListener("keydown", tasto);
  }, [el]);
  return (
    <Sovrapposto lato="sopra" scarto={numero("spazio-1")} className="menu-casella menu-avvio" role="menu" style={larga ? { width: numero("misura-menu-avvio-largo") } : undefined}
      rif={(x) => { setEl(x); rif?.(x); }} onChiudi={onChiudi}>
      <label className="ricerca-avvio"><Icona nome="cerca" /><input value={cerca} placeholder={segnaposto} aria-label={segnaposto} onChange={(e) => onCerca(e.target.value)} /></label>
      {children}
    </Sovrapposto>
  );
}

const Separatore = () => <div className="separatore" role="separator"><div className="linea" /></div>;
const Titolo = ({ children }: { children: string }) => <div className="titolo-gruppo">{children}</div>;

function Riga({ icona, etichetta, valore, fine, scelta = false, attiva = false, disabled, onClick }: {
  icona?: NomeIcona; etichetta: string; valore?: string; fine?: "spunta" | "freccia"; scelta?: boolean; attiva?: boolean; disabled?: boolean; onClick(): void;
}) {
  return (
    <button type="button" role="menuitem" className={`voce${attiva ? " scelta" : ""}`} disabled={disabled} onClick={onClick}>
      {icona && <Icona nome={icona} />}
      <span className="etichetta">{etichetta}</span>
      {valore && <span className="valore">{valore}</span>}
      {fine === "spunta" ? scelta && <Icona nome="spunta" colore="primaria" /> : fine === "freccia" && <Icona nome="destra" />}
    </button>
  );
}

export function MenuAmbiente({ ambiente, mac, ssh = false, mostraBase, onScegli, onAggiungi, onTogli, onChiudi }: {
  ambiente: Ambiente; mac: ElencoMacchine; ssh?: boolean; mostraBase?: string | null;
  onScegli(a: Ambiente): void; onAggiungi(p?: Proposta): void; onTogli(m: Macchina): void; onChiudi(): void;
}) {
  const [cerca, setCerca] = useState(""), [host, setHost] = useState(ssh), [menu, setMenu] = useState<HTMLDivElement | null>(null);
  const q = cerca.trim().toLowerCase(), trova = (t: string) => t.toLowerCase().includes(q);
  const scegli = (a: Ambiente) => { onScegli(a); onChiudi(); };
  const e = (a: Ambiente) => ambiente.tipo === a.tipo && ambiente.host === a.host;
  const voci: Ambiente[] = [{ tipo: "locale" }, { tipo: "cloud" }, { tipo: "remote_control" }, ...mac.macchine.filter((m) => !m.locale).map((m) => ({ tipo: "ssh" as const, host: m.nome }))];
  return (
    <>
      <Menu segnaposto="Cerca ambienti…" cerca={cerca} onCerca={setCerca} rif={setMenu} onChiudi={onChiudi}>
        {q ? voci.filter((a) => trova(nomeAmbiente(a))).map((a) => <Riga key={nomeAmbiente(a)} etichetta={nomeAmbiente(a)} fine="spunta" scelta={e(a)} onClick={() => scegli(a)} />) : (
          <>
            <Titolo>Locale</Titolo>
            <Riga icona="computer" etichetta="Questo computer" fine="spunta" scelta={e({ tipo: "locale" })} onClick={() => scegli({ tipo: "locale" })} />
            <Separatore />
            <Riga etichetta="Cloud" fine="freccia" onClick={() => scegli({ tipo: "cloud" })} />
            <Riga etichetta="Remote Control" fine="freccia" onClick={() => scegli({ tipo: "remote_control" })} />
            <Riga etichetta="SSH" fine="freccia" attiva={host} onClick={() => setHost(!host)} />
            <Separatore />
            {/* shortcut: gli ambienti nuovi sono le macchine SSH («Aggiungi macchina…»); il disegno non dice altro, la voce resta spenta */}
            <Riga icona="piu" etichetta="Crea ambiente" disabled onClick={() => {}} />
          </>
        )}
      </Menu>
      {host && !q && menu && (
        <Sovrapposto ancora={menu} lato="destra" scarto={numero("spazio-1")} className="menu-casella menu-ssh" role="menu" label="Macchine SSH" onChiudi={() => setHost(false)}>
          <PannelloSsh mac={mac} ambiente={ambiente} mostraBase={mostraBase} onScegli={scegli} onAggiungi={(p) => { onChiudi(); onAggiungi(p); }} onTogli={(m) => { onChiudi(); onTogli(m); }} />
        </Sovrapposto>
      )}
    </>
  );
}

export function MenuCartella({ recenti, cartella, ctx, ramo, worktree, inizio = "", onCartella, onApri, onRamo, onWorktree, onChiudi }: {
  recenti: CartellaAvvio[]; cartella: CartellaAvvio | null; ctx: ContestoCartella | null; ramo: string | null; worktree: boolean; inizio?: string;
  onCartella(c: CartellaAvvio | null): void; onApri(): void; onRamo(): void; onWorktree(acceso: boolean): void; onChiudi(): void;
}) {
  const [cerca, setCerca] = useState(inizio);
  const q = cerca.trim().toLowerCase(), trovate = recenti.filter((c) => c.nome.toLowerCase().includes(q));
  const scegli = (c: CartellaAvvio | null) => { onCartella(c); onChiudi(); };
  return (
    <Menu segnaposto="Cerca cartelle…" cerca={cerca} onCerca={setCerca} onChiudi={onChiudi}>
      <Riga etichetta="Nessuna cartella" fine="spunta" scelta={!cartella} onClick={() => scegli(null)} />
      {!!trovate.length && <><Separatore /><Titolo>Recenti</Titolo></>}
      {trovate.map((c) => <Riga key={c.percorso} etichetta={c.nome} fine="spunta" scelta={c.percorso === cartella?.percorso} onClick={() => scegli(c)} />)}
      <Separatore />
      <Riga etichetta="Apri cartella…" onClick={() => { onChiudi(); onApri(); }} />
      {cartella && ctx?.git && (
        <>
          <Separatore />
          <Riga etichetta="Ramo" valore={ramo ?? undefined} fine="freccia" onClick={() => { onChiudi(); onRamo(); }} />
          <div className="voce" role="menuitemcheckbox" aria-checked={worktree} onClick={() => onWorktree(!worktree)}>
            <span className="etichetta">Copia di lavoro</span>
            <span onClick={(e) => e.stopPropagation()}><Interruttore etichetta="Copia di lavoro" acceso={worktree} onCambia={onWorktree} /></span>
          </div>
        </>
      )}
    </Menu>
  );
}

export function MenuRamo({ rami, ramo, inizio = "", onScegli, onChiudi }: { rami: string[]; ramo: string | null; inizio?: string; onScegli(r: string): void; onChiudi(): void }) {
  const [cerca, setCerca] = useState(inizio);
  const gruppi = gruppiRami(rami, cerca);
  return (
    <Menu segnaposto="Cerca ramo…" cerca={cerca} onCerca={setCerca} larga onChiudi={onChiudi}>
      {gruppi.length ? gruppi.map((g, i) => (
        <div key={g.titolo ?? i} role="group" className="gruppo-rami">
          {g.titolo && <Titolo>{g.titolo}</Titolo>}
          {g.rami.map((r) => <Riga key={r} icona="ramo" etichetta={r} fine="spunta" scelta={r === ramo} onClick={() => { onScegli(r); onChiudi(); }} />)}
        </div>
      )) : <div className="vuoto">Nessun ramo trovato</div>}
    </Menu>
  );
}

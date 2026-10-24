// Un solo ledger per snapshot e live: le identità nascono dai byte del file, mai dal contenuto.
import { createHmac, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { parseRiga, msgErrore } from "./jsonl";
import { DIM_PAGINA, firmaFile, lettoreCronologia, versioneFile, type Campione } from "./messaggi";
import type { DeltaCronologia, ErroreCronologia, OpzioniCronologia, RigaCronologia, SnapshotPagina } from "./cronologia-tipi";
import type { PaginaMessaggi, Sessione } from "./tipi";

type Sorgente = Pick<Sessione, "id" | "file" | "sorgente">;
interface Stato {
  epoca: string; file: string; sorgente: Sessione["sorgente"]; identita: string; firma: string; offset: number; campioni: Campione[];
  seq: number; righe: RigaCronologia[]; chiavi: WeakMap<object, number>;
  leggi: ReturnType<typeof lettoreCronologia>; byte: number; invalido: boolean;
}
type Ancora = Omit<Stato, "righe" | "chiavi" | "leggi" | "byte" | "invalido"> & { revisioni: Float64Array };
interface Snapshot { dati: SnapshotPagina; righe: RigaCronologia[]; scade: number; byte: number }
export interface LimitiCronologia { statoByte?: number; snapshotByte?: number; snapshotNumero?: number; ttlMs?: number; fileByte?: number }
const inode = (file: string) => { const x = fs.statSync(file, { bigint: true }); return `${x.dev}:${x.ino}`; }; // stesso formato di versioneFile
const copia = <T>(v: T): T => structuredClone(v);

export class Cronologia {
  private stati = new Map<string, Stato>();
  private snapshots = new Map<string, Snapshot>();
  private sospesi = new Map<string, Ancora>();
  private segreto = randomUUID();
  private invia: (d: DeltaCronologia) => void = () => {};
  private limiti: Required<LimitiCronologia>;
  constructor(limiti: LimitiCronologia = {}, private ora = Date.now) {
    this.limiti = { statoByte: 96 * 1024 * 1024, snapshotByte: 128 * 1024 * 1024,
      snapshotNumero: 32, ttlMs: 300_000, fileByte: 128 * 1024 * 1024, ...limiti };
    if (Object.entries(this.limiti).some(([k, v]) => !Number.isSafeInteger(v) || v < (k === "ttlMs" ? 0 : 1)))
      throw new RangeError("Limiti cronologia non validi");
  }
  collega(cb: (d: DeltaCronologia) => void) { this.invia = cb; }
  private errore(e: unknown): ErroreCronologia {
    const testo = msgErrore(e), codice = testo === "file sparito" ? "sorgente_assente" : testo === "sorgente_instabile" ? "sorgente_instabile" : "non_letta";
    return { codice, testo, ripartenza: "stessa_pagina" };
  }
  private fallita(pagina: number, errore: ErroreCronologia): PaginaMessaggi {
    return { messaggi: [], pagina, haAltre: false, totale: null, errore: errore.testo, erroreCronologia: errore };
  }
  /** Il primo evento riscalda il parser dalla testa; pubblica solo ciò che segue il confine iniziale. */
  aggiorna(s: Sorgente, confineIniziale?: number): Stato | ErroreCronologia {
    const precedente = this.stati.get(s.id), sospeso = this.sospesi.get(s.id), ancora = precedente ?? sospeso;
    let parsing = false; // un errore prima del parser lascia il ledger intatto: non va invalidato
    try {
      if (precedente && !precedente.invalido && precedente.sorgente === s.sorgente && precedente.firma === firmaFile(s.file)) {
        this.stati.delete(s.id); this.stati.set(s.id, precedente);
        return precedente;
      }
      // Due percorsi dello stesso file (account con `projects` in link simbolico) non sono una rotazione: conta l'inode.
      const stessa = !!ancora && ancora.sorgente === s.sorgente && (ancora.file === s.file || ancora.identita === inode(s.file));
      // Con un ledger vivo legge solo la coda (più i campioni del prefisso); da zero se serve riscaldare il parser.
      const v = versioneFile(s.file, this.limiti.fileByte, stessa ? { identita: ancora!.identita, offset: ancora!.offset,
        campioni: precedente?.invalido ? null : ancora!.campioni } : undefined, !precedente);
      parsing = true;
      const motivo = ancora && (!stessa ? "percorso" : v.motivo);
      const nuovo = !precedente || !!motivo, ripristino = !!ancora && !precedente && !motivo;
      const pubblicaDa = ripristino ? ancora!.offset : confineIniziale;
      const stato: Stato = nuovo ? { epoca: ripristino ? ancora!.epoca : randomUUID(), file: s.file, sorgente: s.sorgente, identita: v.identita,
        firma: v.firma, offset: 0, campioni: [], seq: ripristino ? ancora!.seq : 0, righe: [], chiavi: new WeakMap(),
        leggi: lettoreCronologia(s), byte: 0, invalido: false } : precedente!;
      if (stato.offset === v.fine && !nuovo) {
        stato.firma = v.firma; stato.campioni = v.campioni;
        this.stati.delete(s.id); this.stati.set(s.id, stato);
        return stato;
      }
      const righe = stato.righe.slice(), cambiate = new Map<number, RigaCronologia>();
      const seq = stato.seq + 1;
      let da = v.da, mutato = false, byte = nuovo ? 512 : stato.byte;
      while (da < v.fine) {
        const fine = v.da + v.dati.indexOf(10, da - v.da), o = parseRiga(v.dati.subarray(da - v.da, fine - v.da).toString("utf8"));
        if (o) {
          const x = stato.leggi(o);
          if ((!ripristino || da >= pubblicaDa!) && (x.nuovi.length || x.aggiornati.length)) mutato = true;
          x.nuovi.forEach((m, i) => {
            const ordine = righe.length;
            stato.chiavi.set(m, ordine);
            const revisione = ripristino && da < pubblicaDa! ? sospeso!.revisioni[ordine] : seq;
            const r = { chiave: `${stato.epoca}:${da}:${i}`, ordine, revisione, messaggio: copia(m) };
            byte += 129 + Buffer.byteLength(JSON.stringify(r));
            righe.push(r);
            if (!nuovo || motivo || (pubblicaDa !== undefined && da >= pubblicaDa)) cambiate.set(ordine, r);
          });
          for (const m of x.aggiornati) {
            const ordine = stato.chiavi.get(m);
            if (ordine === undefined) throw new Error("Continuità dello strumento non verificata");
            const revisione = ripristino && da < pubblicaDa! ? sospeso!.revisioni[ordine] : seq;
            const r = { ...righe[ordine], revisione, messaggio: copia(m) };
            byte += Buffer.byteLength(JSON.stringify(r)) - Buffer.byteLength(JSON.stringify(righe[ordine]));
            righe[ordine] = r;
            if (!nuovo || motivo || (pubblicaDa !== undefined && da >= pubblicaDa)) cambiate.set(ordine, r);
          }
        }
        da = fine + 1;
      }
      if (byte > this.limiti.statoByte) throw new Error("Cronologia oltre il limite di memoria");
      Object.assign(stato, { righe, byte, seq: mutato ? seq : stato.seq,
        offset: v.fine, firma: v.firma, campioni: v.campioni, invalido: false });
      this.stati.delete(s.id); this.stati.set(s.id, stato); this.sospesi.delete(s.id);
      while ([...this.stati.values()].reduce((n, x) => n + x.byte, 0) > this.limiti.statoByte) {
        const [id, vecchio] = this.stati.entries().next().value!;
        const { righe: _righe, chiavi: _chiavi, leggi: _leggi, byte: _byte, invalido: _invalido, ...ancora } = vecchio;
        this.stati.delete(id); this.sospesi.delete(id); this.sospesi.set(id, { ...ancora, revisioni: Float64Array.from(_righe.map((r) => r.revisione)) });
      }
      // Solo metadati fisici: nessun messaggio o parser rimane nei ledger espulsi.
      while (this.sospesi.size > 4096 || [...this.sospesi.values()].reduce((n, a) => n + 512 + a.campioni.length * 128 + a.revisioni.byteLength, 0) > 8 * 1024 * 1024)
        this.sospesi.delete(this.sospesi.keys().next().value!);
      if (motivo && ancora) this.invia({ tipo: "reset", sessione: s.id, epocaPrecedente: ancora.epoca, epoca: stato.epoca, motivo });
      if (cambiate.size) this.invia({ tipo: "upsert", sessione: s.id, epoca: stato.epoca,
        daSeq: nuovo && !ripristino ? 0 : seq - 1, aSeq: stato.seq, righe: copia([...cambiate.values()]), totale: righe.length });
      return stato;
    } catch (e) {
      if (precedente && parsing) precedente.invalido = true;
      const errore = this.errore(e);
      this.invia({ tipo: "errore", sessione: s.id, epoca: ancora?.epoca ?? null, errore });
      return errore;
    }
  }
  private firma(token: string, prima: number) { return createHmac("sha256", this.segreto).update(`${token}.${prima}`).digest("hex"); }
  private cursore(token: string, prima: number) { return `${token}.${prima}.${this.firma(token, prima)}`; }
  private pota() {
    for (const [k, s] of this.snapshots) if (s.scade <= this.ora()) this.snapshots.delete(k);
    while (this.snapshots.size > this.limiti.snapshotNumero ||
      [...this.snapshots.values()].reduce((n, s) => n + s.byte, 0) > this.limiti.snapshotByte)
      this.snapshots.delete(this.snapshots.keys().next().value!);
  }
  pagina(s: Sorgente, pagina: number, opzioni: OpzioniCronologia): PaginaMessaggi {
    const err = (codice: ErroreCronologia["codice"], testo: string, ripartenza: ErroreCronologia["ripartenza"] = "nuova_snapshot") => this.fallita(pagina, { codice, testo, ripartenza });
    if (opzioni.v !== 1 || !Number.isSafeInteger(pagina) || pagina < 0) return err("cursore_invalido", "Richiesta cronologia non valida");
    if (!s.file.endsWith(".jsonl")) return err("non_letta", "Trascrizione non trovata sul disco");
    this.pota();
    let snapshot: Snapshot | undefined, prima = 0;
    if (opzioni.cursore !== undefined) {
      const pezzi = typeof opzioni.cursore === "string" && opzioni.cursore.length <= 4096 ? opzioni.cursore.split(".") : [];
      const [token, n, firma] = pezzi;
      if (pezzi.length !== 3 || !/^\d+$/.test(n) || !Number.isSafeInteger(Number(n)) || firma !== this.firma(token, Number(n)))
        return err("cursore_invalido", "Cursore cronologia non valido");
      snapshot = this.snapshots.get(token);
      if (!snapshot) return err("snapshot_scaduta", "Cronologia scaduta. Ricarica la sessione.");
      if (snapshot.dati.sessione !== s.id) return err("cursore_invalido", "Cursore di un'altra sessione");
      this.snapshots.delete(token); this.snapshots.set(token, snapshot);
      prima = Number(n);
      if (prima <= 0 || prima > snapshot.righe.length) return err("cursore_invalido", "Posizione cronologia non valida");
    }
    const stato = this.aggiorna(s);
    if ("codice" in stato) return this.fallita(pagina, stato);
    if (snapshot && snapshot.dati.epoca !== stato.epoca) return err("epoca_cambiata", "Cronologia cambiata. Ricarica la sessione.");
    if (!snapshot) {
      const token = randomUUID();
      snapshot = { dati: { v: 1, sessione: s.id, epoca: stato.epoca, snapshot: token, watermark: stato.seq,
        cursorePrima: null, righe: [], totaleSnapshot: stato.righe.length }, righe: stato.righe.slice(),
        scade: this.ora() + this.limiti.ttlMs, byte: stato.byte };
      if (snapshot.byte > this.limiti.snapshotByte || this.limiti.snapshotNumero < 1) return err("non_letta", "Snapshot oltre il limite di memoria", "stessa_pagina");
      this.snapshots.set(token, snapshot); this.pota();
      prima = snapshot.righe.length;
    }
    const inizio = Math.max(0, prima - DIM_PAGINA), righe = snapshot.righe.slice(inizio, prima);
    const cronologia = copia({ ...snapshot.dati, righe, cursorePrima: inizio ? this.cursore(snapshot.dati.snapshot, inizio) : null });
    return { messaggi: cronologia.righe.map((r) => r.messaggio), pagina, haAltre: inizio > 0,
      errore: null, totale: snapshot.dati.totaleSnapshot, cronologia };
  }
}

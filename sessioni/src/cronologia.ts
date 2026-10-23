// Un solo ledger per snapshot e live: le identità nascono dai byte del file, mai dal contenuto.
import { createHash, createHmac, randomUUID } from "node:crypto";
import { parseRiga, msgErrore } from "./jsonl";
import { DIM_PAGINA, firmaFile, lettoreCronologia, versioneFile } from "./messaggi";
import type { DeltaCronologia, ErroreCronologia, OpzioniCronologia, RigaCronologia, SnapshotPagina } from "./cronologia-tipi";
import type { PaginaMessaggi, Sessione } from "./tipi";

type Sorgente = Pick<Sessione, "id" | "file" | "sorgente">;
interface Stato {
  epoca: string; file: string; sorgente: Sessione["sorgente"]; identita: string; firma: string; offset: number; digest: string;
  seq: number; righe: RigaCronologia[]; chiavi: WeakMap<object, number>;
  leggi: ReturnType<typeof lettoreCronologia>; byte: number; invalido: boolean;
}
interface Snapshot { dati: SnapshotPagina; righe: RigaCronologia[]; scade: number; byte: number }
export interface LimitiCronologia { statoByte?: number; snapshotByte?: number; snapshotNumero?: number; ttlMs?: number; fileByte?: number }
const copia = <T>(v: T): T => structuredClone(v);
const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export class Cronologia {
  private stati = new Map<string, Stato>();
  private snapshots = new Map<string, Snapshot>();
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
    const precedente = this.stati.get(s.id);
    try {
      if (precedente && !precedente.invalido && precedente.file === s.file && precedente.sorgente === s.sorgente && precedente.firma === firmaFile(s.file)) {
        this.stati.delete(s.id); this.stati.set(s.id, precedente);
        return precedente;
      }
      const v = versioneFile(s.file, this.limiti.fileByte);
      const motivo = precedente && (precedente.file !== s.file || precedente.sorgente !== s.sorgente ? "percorso"
        : precedente.identita !== v.identita ? "replace" : v.dati.length < precedente.offset ? "truncate"
        : precedente.invalido || digest(v.dati.subarray(0, precedente.offset)) !== precedente.digest ? "riscrittura" : null);
      const nuovo = !precedente || !!motivo;
      const stato: Stato = nuovo ? { epoca: randomUUID(), file: s.file, sorgente: s.sorgente, identita: v.identita,
        firma: v.firma, offset: 0, digest: digest(Buffer.alloc(0)), seq: 0, righe: [], chiavi: new WeakMap(),
        leggi: lettoreCronologia(s), byte: 0, invalido: false } : precedente!;
      if (stato.offset === v.dati.length && !nuovo) {
        stato.firma = v.firma;
        this.stati.delete(s.id); this.stati.set(s.id, stato);
        return stato;
      }
      const righe = stato.righe.slice(), cambiate = new Map<number, RigaCronologia>();
      const seq = stato.seq + 1;
      let da = stato.offset, mutato = false, byte = nuovo ? 512 : stato.byte;
      while (da < v.dati.length) {
        const fine = v.dati.indexOf(10, da), o = parseRiga(v.dati.subarray(da, fine).toString("utf8"));
        if (o) {
          const x = stato.leggi(o);
          if (x.nuovi.length || x.aggiornati.length) mutato = true;
          x.nuovi.forEach((m, i) => {
            const ordine = righe.length;
            stato.chiavi.set(m, ordine);
            const r = { chiave: `${stato.epoca}:${da}:${i}`, ordine, revisione: seq, messaggio: copia(m) };
            byte += 129 + Buffer.byteLength(JSON.stringify(r));
            righe.push(r);
            if (!nuovo || motivo || (confineIniziale !== undefined && da >= confineIniziale)) cambiate.set(ordine, r);
          });
          for (const m of x.aggiornati) {
            const ordine = stato.chiavi.get(m);
            if (ordine === undefined) throw new Error("Continuità dello strumento non verificata");
            const r = { ...righe[ordine], revisione: seq, messaggio: copia(m) };
            byte += Buffer.byteLength(JSON.stringify(r)) - Buffer.byteLength(JSON.stringify(righe[ordine]));
            righe[ordine] = r;
            if (!nuovo || motivo || (confineIniziale !== undefined && da >= confineIniziale)) cambiate.set(ordine, r);
          }
        }
        da = fine + 1;
      }
      if (byte > this.limiti.statoByte) throw new Error("Cronologia oltre il limite di memoria");
      Object.assign(stato, { righe, byte, seq: mutato ? seq : stato.seq,
        offset: v.dati.length, firma: v.firma, digest: digest(v.dati), invalido: false });
      this.stati.delete(s.id); this.stati.set(s.id, stato);
      while ([...this.stati.values()].reduce((n, x) => n + x.byte, 0) > this.limiti.statoByte)
        this.stati.delete(this.stati.keys().next().value!);
      if (motivo && precedente) this.invia({ tipo: "reset", sessione: s.id, epocaPrecedente: precedente.epoca, epoca: stato.epoca, motivo });
      if (cambiate.size) this.invia({ tipo: "upsert", sessione: s.id, epoca: stato.epoca,
        daSeq: nuovo ? 0 : seq - 1, aSeq: stato.seq, righe: copia([...cambiate.values()]), totale: righe.length });
      return stato;
    } catch (e) {
      if (precedente) precedente.invalido = true;
      const errore = this.errore(e);
      this.invia({ tipo: "errore", sessione: s.id, epoca: precedente?.epoca ?? null, errore });
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

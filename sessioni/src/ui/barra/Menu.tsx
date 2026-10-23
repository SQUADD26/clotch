// figma: 101-21206 — menu della barra: sulla riga (101:21206), sulla cartella (101:21348), del profilo (101:21498). Testi dai frame.
// Ogni voce ha il suo effetto (Figma non ha la voce spenta): Rinomina… (nome in clotch, nelle preferenze della sessione),
// Rinomina etichetta… (nelle impostazioni), Nascondi cartella (la mette tra le cartelle escluse, con Annulla), Novità (note della versione).
import type { AzioneSessione, PreferenzeSessione, Sessione } from "../../tipi";
import { api } from "../base/dati";
import { avvisa } from "../base/Avvisi";
import { apriDialogo, apriNovita, verificaAggiornamenti } from "../base/dialoghi";
import { Menu, type VoceMenu } from "../base/Menu";
import { imposta, useImpostazioni } from "../impostazioni/stato";
import { conEtichetta, nuoveEscluse } from "./elenco";
import type { Punto } from "./Sovrapposti";

const azione = (id: string, a: AzioneSessione) => () => { void api().azione(id, a); };
const archivia = (id: string) => window.clotchAi.comando("archivia", { chat: id });
const posto = (a: Punto) => ({ position: "fixed" as const, left: a.x, top: a.y });

/** «Menu della sessione» (101:21206, 101:20859): lo stesso sulla riga della barra e sul «…» dell'intestazione della chat. */
export function vociMenuSessione(s: Sessione, pref?: PreferenzeSessione): VoceMenu[] {
  return [
    { icona: "spillo", etichetta: "Fissa in alto", fai: () => void api().impostaPreferenze(s.id, { fissa: pref?.fissa ? null : true }) },
    { icona: "matita", etichetta: "Rinomina…", fai: () => apriDialogo("rinomina", {
      titolo: "Rinomina sessione", valore: s.titolo, nota: "Il nome cambia solo in clotch.",
      salva: (nome) => void api().impostaPreferenze(s.id, { nome: nome || null }), // vuoto = torna il titolo della sessione
    }) },
    { icona: "archivia", etichetta: "Archivia", scorciatoia: "⇧⌘A", fai: () => void archivia(s.id) },
    "separatore",
    { icona: "posta", etichetta: "Segna come non letta", fai: () => void api().impostaPreferenze(s.id, { nonLetta: true }) },
    { icona: "finestra", etichetta: "Apri in una nuova finestra", fai: azione(s.id, "nuova-finestra") },
    "separatore",
    { icona: "copia", etichetta: "Copia ID sessione", fai: azione(s.id, "copia-id") },
    { icona: "cartella", etichetta: "Copia cartella di lavoro", fai: azione(s.id, "copia-cartella") },
    { icona: "link", etichetta: "Copia link alla sessione", fai: azione(s.id, "copia-link") },
    { icona: "finder", etichetta: "Mostra nel Finder", fai: azione(s.id, "mostra-nel-finder") },
  ];
}

export function MenuRiga({ s, pref, a, inizio, onChiudi }: { s: Sessione; pref?: PreferenzeSessione; a: Punto; inizio?: number; onChiudi(): void }) {
  return <Menu voci={vociMenuSessione(s, pref)} inizio={inizio} onChiudi={onChiudi} style={posto(a)} />;
}

/** `chiave` e `etichetta`: il nome della cartella nella barra e quello mostrato (con «Rinomina etichetta…»). */
export function MenuCartella({ sessioni, chiave, etichetta, a, inizio, onChiudi }: { sessioni: Sessione[]; chiave: string; etichetta: string; a: Punto; inizio?: number; onChiudi(): void }) {
  const prima = sessioni[0]?.id;
  const { etichetteCartelle, cartelleEscluse } = useImpostazioni();
  const nascondi = () => {
    const nuove = nuoveEscluse(sessioni, cartelleEscluse);
    if (!nuove.length) return avvisa({ tipo: "errore", messaggio: "Cartella senza percorso: non si può nascondere" });
    imposta("cartelleEscluse", [...cartelleEscluse, ...nuove]);
    avvisa({ tipo: "info", messaggio: "Cartella nascosta", azione: { etichetta: "Annulla", fai: () => imposta("cartelleEscluse", cartelleEscluse) } });
  };
  const voci: VoceMenu[] = [
    { icona: "finder", etichetta: "Mostra nel Finder", fai: azione(prima, "mostra-nel-finder") },
    { icona: "copia", etichetta: "Copia percorso", fai: azione(prima, "copia-cartella") },
    { icona: "matita", etichetta: "Rinomina etichetta…", fai: () => apriDialogo("rinomina", {
      titolo: "Rinomina etichetta", valore: etichetta, nota: "L’etichetta cambia solo in clotch.",
      salva: (nome) => imposta("etichetteCartelle", conEtichetta(etichetteCartelle, chiave, nome)),
    }) },
    { icona: "archivia", etichetta: "Archivia tutte le sessioni", fai: () => sessioni.forEach((s) => void archivia(s.id)) },
    "separatore",
    { icona: "nascondi", etichetta: "Nascondi cartella", pericolo: true, fai: nascondi },
  ];
  return <Menu voci={voci} inizio={inizio} onChiudi={onChiudi} style={posto(a)} />;
}

export function MenuProfilo({ dettaglio, a, inizio, onImpostazioni, onChiudi }: { dettaglio: string; a: Punto; inizio?: number; onImpostazioni(): void; onChiudi(): void }) {
  const voci: VoceMenu[] = [
    { icona: "impostazioni", etichetta: "Impostazioni", scorciatoia: "⌘,", fai: onImpostazioni },
    { icona: "tastiera", etichetta: "Scorciatoie da tastiera", scorciatoia: "⌘/", fai: () => apriDialogo("scorciatoie") },
    { icona: "scintille", etichetta: "Novità", fai: () => void apriNovita() },
    { icona: "aggiorna", etichetta: "Verifica aggiornamenti…", fai: () => void verificaAggiornamenti() },
    "separatore",
    { icona: "info", etichetta: "Info su clotch", fai: onImpostazioni },
  ];
  return <Menu testata={{ titolo: "Roberto Bondici", dettaglio }} voci={voci} inizio={inizio} onChiudi={onChiudi} style={posto(a)} />;
}

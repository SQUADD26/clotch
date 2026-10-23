// figma: 101-21206 — menu della barra: sulla riga (101:21206), sulla cartella (101:21348), del profilo (101:21498). Testi dai frame.
// Voci senza un comando o un'azione del main: disegnate ma spente (rinomina: comando Friday in arrivo; etichetta e nascondi cartella,
// scorciatoie, novità, aggiornamenti: nessuna API).
import type { AzioneSessione, PreferenzeSessione, Sessione } from "../../tipi";
import { api } from "../base/dati";
import { Menu, type VoceMenu } from "../base/Menu";
import type { Punto } from "./Sovrapposti";

const azione = (id: string, a: AzioneSessione) => () => { void api().azione(id, a); };
const archivia = (id: string) => window.friday.comando("archivia", { chat: id });
const posto = (a: Punto) => ({ position: "fixed" as const, left: a.x, top: a.y });

export function MenuRiga({ s, pref, a, onChiudi }: { s: Sessione; pref?: PreferenzeSessione; a: Punto; onChiudi(): void }) {
  const voci: VoceMenu[] = [
    { icona: "spillo", etichetta: "Fissa in alto", fai: () => void api().impostaPreferenze(s.id, { fissa: pref?.fissa ? null : true }) },
    { icona: "matita", etichetta: "Rinomina…", spenta: true, fai: () => {} },
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
  return <Menu voci={voci} onChiudi={onChiudi} style={posto(a)} />;
}

export function MenuCartella({ sessioni, a, onChiudi }: { sessioni: Sessione[]; a: Punto; onChiudi(): void }) {
  const prima = sessioni[0]?.id;
  const voci: VoceMenu[] = [
    { icona: "finder", etichetta: "Mostra nel Finder", fai: azione(prima, "mostra-nel-finder") },
    { icona: "copia", etichetta: "Copia percorso", fai: azione(prima, "copia-cartella") },
    { icona: "matita", etichetta: "Rinomina etichetta…", spenta: true, fai: () => {} },
    { icona: "archivia", etichetta: "Archivia tutte le sessioni", fai: () => sessioni.forEach((s) => void archivia(s.id)) },
    "separatore",
    { icona: "nascondi", etichetta: "Nascondi cartella", pericolo: true, spenta: true, fai: () => {} },
  ];
  return <Menu voci={voci} onChiudi={onChiudi} style={posto(a)} />;
}

export function MenuProfilo({ dettaglio, a, onImpostazioni, onChiudi }: { dettaglio: string; a: Punto; onImpostazioni(): void; onChiudi(): void }) {
  const voci: VoceMenu[] = [
    { icona: "impostazioni", etichetta: "Impostazioni", scorciatoia: "⌘,", fai: onImpostazioni },
    { icona: "tastiera", etichetta: "Scorciatoie da tastiera", scorciatoia: "⌘/", spenta: true, fai: () => {} },
    { icona: "scintille", etichetta: "Novità", spenta: true, fai: () => {} },
    { icona: "aggiorna", etichetta: "Verifica aggiornamenti…", spenta: true, fai: () => {} },
    "separatore",
    { icona: "info", etichetta: "Info su Sessioni", fai: onImpostazioni },
  ];
  return <Menu testata={{ titolo: "Roberto Bondici", dettaglio }} voci={voci} onChiudi={onChiudi} style={posto(a)} />;
}

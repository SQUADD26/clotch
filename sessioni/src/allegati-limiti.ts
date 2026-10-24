// Limiti degli allegati della casella (#469), uguali a quelli del motore (claude-config #2568): l'app li fa valere prima dell'invio, il motore rifiuta col solo nome del file.
// Un file lo dice «troppo grande» il disegno 148:49251. Si contano i byte a mille, come il Finder e `peso`.
const IMMAGINE = /\.(png|jpe?g|gif|webp|bmp|svg|heic|tiff?)$/i;
export const eImmagine = (percorso: string) => IMMAGINE.test(percorso);

export const MAX_ALLEGATI = 10;
export const MAX_TOTALE_BYTE = 25_000_000;
/** Immagine 5 MB, PDF 20 MB, ogni altro file (testo utf-8) 200 KB. */
export const limiteAllegato = (nome: string) => (eImmagine(nome) ? 5_000_000 : /\.pdf$/i.test(nome) ? 20_000_000 : 200_000);

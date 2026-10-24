// «Chiedi a clotch AI» sul testo scelto nel filo (101-28471): il testo aspetta qui finché la casella di clotch AI si apre e lo prende.
let inAttesa: string | null = null;

export const chiediA = (testo: string) => { inAttesa = testo; };
export const prendiChiesta = () => { const t = inAttesa; inAttesa = null; return t; };

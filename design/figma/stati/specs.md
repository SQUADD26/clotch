# Notch nero pieno: misure dal Figma

Fonte: file Figma `gayvkX0IaLjZghH2otVbJt`, sezione «✅ Scelta definitiva · Notch nero pieno» (node 4-2281), colonna Scuro.
Tutte le misure sono in pt (1x). I PNG di questa cartella sono a 2x, ritagliati sul notch con circa 40 pt attorno. Il 13 e il 14 sono un po' sotto 2x (1,78x e 1,82x), perché lo strumento non esporta oltre 1568 px sul lato lungo.

## Schermo e notch fisico
- Schermo di riferimento: MacBook Pro 14", 1512 × 982 pt. I riquadri Figma sono un ritaglio centrale largo 880 pt.
- Notch fisico: 185 × 32, raggi in basso 10, nero `#000000`.
- Barra dei menu: testo 13 Medium, bianco al 88% (modo scuro).

## Forma dell'app (isola)
- Riempimento `#000000` pieno: niente vetro, niente bordo, niente ombra.
- In alto, ai due angoli, un raccordo concavo di raggio 9 che si unisce al bordo dello schermo. La larghezza totale del vettore è Bw + 18.
- Ali: 84 per lato attorno al notch (185 + 2 × 84 = 353).

| Stato | Larghezza Bw | Altezza | Raggio in basso |
|---|---|---|---|
| 01 riposo, 04 notifica che sparisce, 11 passaggio sugli account, 14 impostazioni (barra) | 353 | 32 | 10 |
| 02 notifica arriva, 03 notifica presa | 440 | 74 | 26 |
| 05 obiettivi, 12 PR unita | 560 | 372 | 30 |
| 06 scorrimento | 560 | 378 | 30 |
| 07 richieste, 15 richieste pagina 2 | 560 | 346 | 30 |
| 08 account | 560 | 296 | 30 |
| 09 / 10 senza notch | 560 | 32 | 12 |
| 13 account estesi (senza notch) | 824 | 32 | 12 |

Aperto: altezza = fondo del contenuto + 22.

## Colori (modo scuro)
- Testo `#FFFFFF`, livelli di opacità: primario 100%, righe 92%, secondario 80%, descrizione 66%, schede spente 60%, etichette 55–56%, in attesa / sbarrato 45%.
- Verde `#30D158` · Giallo `#FFD60A` · Rosso `#FF453A` · Arancione `#FF9F0A` (PR in conflitto) · Viola `#BF5AF2` (PR unita) · Blu `#0A84FF` (bottone Fine).
- Spunta dentro il cerchio verde: `#06210F`, tratto 1,9.
- Fondo binari e anelli: bianco 16% (barre), bianco 22% (anelli), bianco 18% (barrette account).
- Separatori: 1 pt, bianco 8%.
- Soglie dei colori: obiettivi (prove / totale) ≥ 0,75 verde, ≥ 0,4 giallo, sotto rosso; senza prove: solo contorno bianco 35%, tratto 1,4. Uso account: ≥ 90% rosso, ≥ 50% giallo, sotto verde.

## Barra in alto (y 0–32)
- Ala sinistra: 4 anelli obiettivo, diametro 12, tratto 2,2, distanza tra i centri 17, centrati su y 16. Arco dalle ore 12 in senso orario.
- Ala destra: 3 barrette account in uso, 6 × 16, raggio 3, passo 10. Fondo bianco 18%; riempimento dal basso = uso settimanale × 16 (minimo 4).
- Notifica 3 (sparisce): al posto delle barrette un cerchio verde con spunta, diametro 16, al centro dell'ala destra.

## Notifiche (02, 03)
- Riga a y 41–52. Cerchio a x = L + 28, centro y 52. In attesa: cerchio 15, tratto 1,5, bianco 42%. Presa: cerchio verde 17 con spunta.
- Testo della richiesta: 14 Semi Bold, spaziatura −1%, x = L + 46. In 03: opacità 50% e barrato.
- A destra, a R − 24: «In attesa» 11 Medium 50%, oppure «Presa in carico» 11 Semi Bold verde.

## Schede (aperto)
- Barra: larghezza 3 × 142 + 8 = 434, altezza 38, raggio 19, bianco 7%, y 42, centrata.
- Scheda attiva: 142 × 30, raggio 15, bianco 16%.
- Etichetta: 13, Semi Bold se attiva, altrimenti Medium al 60%. Icona 14 (tratto 1,5), spazio 6.
- Contenuto: x = bordo isola + 26, larghezza 508, inizio y 96.

## Pagina obiettivo (05, 06, 12)
- Testata: icona bersaglio 13 + «Obiettivo 1 di 4» 12 Medium 55%.
- Stato a destra: 11 Semi Bold nel colore dello stato; fondo dello stesso colore al 16%, altezza 20, raggio 10, margine 9 per lato.
- Titolo: 20 Semi Bold, spaziatura −1,2%, a y + 28; freccia «apri sessione» 14 al 50%, 6 pt dopo il titolo.
- Descrizione: 13 Regular 66%, a y + 58, larghezza 412.
- Anello grande: diametro 64, tratto 5, centro a (x + w − 32, y + 70); «3/6» 16 Semi Bold; «prove» 10 Medium 55%.
- Riga dati: icona terminale 14 + «2 sessioni al lavoro» 12 Medium 80%; icona cronometro 15 + «2:04:17» 12 Semi Bold 92%, spaziatura +2%; a destra «3 prove su 6» 12 Semi Bold nel colore dello stato.
- Pull request: separatore, poi testata (icona 13 + «Pull request» 12 Medium 55%), poi righe con passo 26.
  - Icona 15 colorata, «#n» 12 Medium 50% a x + 22, titolo 13 Medium 90% a x + 70, stato 11 Semi Bold colorato a destra.
  - Colori: In corso giallo, Verde verde, Rossa rosso, In conflitto arancione (icona con la X), Unita viola (icona merge).
  - PR appena unita (12): fondo viola 18%, raggio 9, che sporge di 10 per lato. Etichetta «Unita».
- Scorrimento (06): le due pagine si muovono con opacità 35% (quella che esce) e 55% (quella che entra), sfocatura 2,5.

## Indicatori di pagina e bottoni
- Trattini 14 × 4, raggio 2, distanza 6. Attivo bianco 90%, gli altri 25%.
- Bottoni ‹ ›: cerchio 22, a 22 pt oltre il bordo dei trattini. Fondo bianco 12% (spento 6%), freccia 12 bianca 90% (spenta 35%).

## Richieste (07, 15)
- Testata: icona vassoio 13 + «Richieste» 12 Medium 55%; a destra «9 in tutto · 3 prese in carico» 12 Medium 55%.
- Righe con passo 32, al massimo 5 per pagina.
  - Presa: cerchio verde 16 con spunta; testo 14 Medium 45% barrato; «Presa in carico» 11 Semi Bold verde.
  - In attesa: cerchio 15 con tratto bianco 42%; testo 14 Medium 92%; «In attesa» 11 Medium 45%.
- Piede: «Altre 4 ›» (pagina 2: «‹ Prime 5») 12 Semi Bold 75%; trattini e bottoni al centro; «1 di 2» 12 Medium 50%.

## Account (08)
- Testata: «Account» + a destra icona portatile + «3 in uso su questo Mac».
- Riquadri su 2 colonne, (508 − 10) / 2 × 70, raggio 14, distanza 10. Fondo bianco 9% se in uso, 5% se no.
- Nome 13 Semi Bold; icona portatile 14 al 60% in alto a destra se in uso.
- Righe «5 ore» e «Settimana» 11 Medium 55%; barra alta 4, raggio 2; percentuale 11 (Semi Bold rosso se ≥ 90%).

## Passaggio del mouse sugli account (11)
- Riquadro 292 × 160, raggio 16, nero, bordo bianco 12%, a 42 dall'alto.
- «Account in uso su questo Mac» 11 Medium 55%. Righe con passo 40: nome 13 Semi Bold; «5 ore» e «Sett.» 10 Medium 55%; barre 52 × 4; percentuale 11.

## Schermo senza notch (09, 10, 13)
- Al centro, 09: «Notch: goal sul notch» 13 Semi Bold + cronometro 15 + «2:04:17» 13 Semi Bold 75%, spaziatura +2%.
- 10: cerchio verde 16 + «Presa in carico» 12 Semi Bold verde + richiesta 13 Medium 55% barrata.
- 13: dopo un separatore 1 × 14, per ogni account il nome 12 Medium 85%, poi due barre 26 × 3 una sopra l'altra (sopra 5 ore, sotto settimana) e le percentuali 9 Semi Bold.

## Impostazioni (14, scure di base)
- Finestra 780 × 556, raggio 14; fondo `#1E1E20`, riquadri `#2A2A2D`, controlli segmentati `#141416`.
- Anteprima con 3 zone tratteggiate (sinistra, centro, destra).
- 12 elementi su 4 colonne, riquadri alti 74, raggio 10.
- In fondo: Schermo, Posizione (Fissa / Segue il mouse), Mostra (Icone e testo / Solo icone), Larghezza, «Ripristina predefiniti», «Fine» (blu).

## Tipografia
- Nel disegno c'è Inter perché SF Pro non si misura nel plugin. L'app usa SF Pro: Text fino a 19 pt, Display da 20 pt.
- Pesi: Regular 400, Medium 500, Semi Bold 600. Spaziatura di base −1% sul testo, 0 su etichette e numeri.

## Voce (sezione «✅ Scelta definitiva · Voce, luce sul bordo», node 4-6398)
- Si accende 0,5 s prima della prima parola, con intensità k = 0,6; mentre parla k = 1, e k segue il volume.
- Luce: tratto esterno di 1,5 + 1,5k sul contorno dell'isola.
- Alone: tratto di 3 + 6k, sfocatura 5 + 6k, opacità 0,55 + 0,45k.
- Gradiente orizzontale che gira piano: `#FF9E0A` → `#FF3880` → `#995CFF` → `#3399FF`.

## Nota gialla di comportamento (testo intero)
Nel disegno: Inter al posto di SF Pro. L’app usa SF Pro (Text fino a 19 pt, Display da 20 pt). Movimento: una sola molla per tutto, da provare nel laboratorio animazioni.
Scorrimento: con il cursore sul notch aperto, due dita a destra o sinistra spostano di un solo passo, anche se lo scorrimento è forte; scorrendo, i dati si attenuano.
Clic sul nome dell’obiettivo: apre la sessione master che lo insegue. Pull request: solo quelle aperte; una appena unita si colora di viola, poi esce.

## File della voce (16–21, scuro, 2x)
- 16-voce-prima: 0,5 s prima della prima parola (k = 0,6).
- 17-voce-parla: mentre parla (k = 1).
- 18–21: i colori girano e la luce segue la voce. 18 voce bassa (k 0,35, fase 0), 19 voce forte (k 1, fase 0,25), 20 voce media (k 0,65, fase 0,5), 21 pausa tra due frasi (k 0,2, fase 0,75). Fase = spostamento del gradiente lungo il bordo, da 0 a 1 per un giro.

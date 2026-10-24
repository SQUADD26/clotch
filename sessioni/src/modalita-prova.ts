/** Silenzio della sola istanza di prova: nessuna preferenza o volume del Mac cambia. */
export function provaSilenziosa(): boolean {
  return process.env.CLOTCH_TEST_SILENT === "1";
}

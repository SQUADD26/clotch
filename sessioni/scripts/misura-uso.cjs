// Misura la prima risposta di quoteConGiorni con la home vera (sola lettura: ~/.claude*/projects + il feed pubblico).
// Uso: tsc && node scripts/misura-uso.cjs [cartella-dist]   (default ./dist). Stesso comando su due commit = prima/dopo.
const os = require("node:os"), path = require("node:path");
const dist = path.resolve(process.argv[2] ?? "dist");
const { quoteConGiorni } = require(path.join(dist, "src/quote-uso.js"));
const { trovaRadici } = require(path.join(dist, "src/radici.js"));
(async () => {
  const radici = trovaRadici(os.homedir());
  for (const n of [1, 2, 3]) {
    const t = Date.now(), q = await quoteConGiorni(radici);
    console.log(`giro ${n}: ${Date.now() - t} ms, account=${q.length}, con giorni=${q.filter((x) => x.giorni).length}`);
    if (n === 2) await new Promise((r) => setTimeout(r, 40_000)); // il dopo: lascia finire il conteggio in background
  }
  process.exit(0);
})();

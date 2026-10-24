// Sonda del processo main (caricata con `electron -r`): ogni blocco del ciclo eventi oltre 50 ms va in $SONDA_FILE come «<ora ms> <durata ms>».
const fs = require("node:fs");
let ultimo = performance.now();
setInterval(() => {
  const ora = performance.now(), ritardo = ora - ultimo - 10;
  ultimo = ora;
  if (ritardo > 50) fs.appendFileSync(process.env.SONDA_FILE, `${Date.now()} ${Math.round(ritardo)}\n`);
}, 10);

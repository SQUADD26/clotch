// `npm run elenco`: stampa in JSON le sessioni trovate sulla macchina dove gira.
import * as os from "node:os";
import { leggiElenco } from "./elenco";

const e = leggiElenco({ home: os.homedir() });
const n = Number(process.argv[2]);
process.stdout.write(JSON.stringify(n > 0 ? { ...e, sessioni: e.sessioni.slice(0, n) } : e, null, 2) + "\n");

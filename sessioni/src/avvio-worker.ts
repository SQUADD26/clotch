// Worker d'avvio (#463): la prima lettura di tutte le sessioni (30 s sul Mac con migliaia di trascrizioni) fuori dal main.
// Risponde con lo stato dell'osservatore e le cache già riempite; il main le copia (api.ts).
import { parentPort, workerData } from "node:worker_threads";
import { copiaCache } from "./altre-sorgenti";
import { cache } from "./claude-code";
import { statoIniziale } from "./osserva";

parentPort?.postMessage({ stato: statoIniziale(workerData.home, workerData.env, workerData.imp), claude: [...cache], altre: copiaCache() });

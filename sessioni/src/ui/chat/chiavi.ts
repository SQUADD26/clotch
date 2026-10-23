// Impostazioni «Dati»: chiavi coperte con •••• (`nascondiChiavi`) e comando ridotto al nome (`comandiInteri`). Funzioni pure.
const COPERTO = "••••";
const PRIMA = "(?<![A-Za-z0-9_-])"; // un prefisso vale solo a inizio parola: «task-…» non è «sk-…»
const CHIAVI: [RegExp, string][] = [
  [new RegExp(`${PRIMA}sk-[A-Za-z0-9_-]{20,}`, "g"), COPERTO], // sk-ant-… compresa
  [new RegExp(`${PRIMA}(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})`, "g"), COPERTO],
  [new RegExp(`${PRIMA}xox[abprs]-[A-Za-z0-9-]{10,}`, "g"), COPERTO],
  [new RegExp(`${PRIMA}AKIA[0-9A-Z]{16}(?![A-Za-z0-9])`, "g"), COPERTO],
  [/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/g, `$1${COPERTO}`],
  [/(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, COPERTO], // JWT
  // KEY=valore / TOKEN= / SECRET= / PASSWORD= nelle variabili d'ambiente (nome in maiuscolo, la parola intera tra i trattini bassi): resta il nome, il valore si copre
  [/(?<![A-Za-z0-9_])((?:[A-Z0-9]+_)*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD)(?:_[A-Z0-9]+)*=)("[^"]*"|'[^']*'|[^\s"']+)/g, `$1${COPERTO}`],
];

/** Il testo con chiavi e token sostituiti da ••••. Un hash git o un uuid non sono chiavi e restano. */
export const copriChiavi = (testo: string) => CHIAVI.reduce((t, [re, con]) => t.replace(re, con), testo);

/** Il nome del comando (la prima parola, senza le variabili `A=b` davanti): «git push origin main» -> «git». */
export const nomeComando = (comando: string) => comando.trim().split(/\s+/).find((p) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(p)) ?? "";

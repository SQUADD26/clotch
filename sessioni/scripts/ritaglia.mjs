#!/usr/bin/env node
// Ritaglio PNG per la parità di un pezzo (#352): toglie dalle due immagini la parte disegnata da un altro pezzo (la barra
// laterale), così `parita.mjs immagine` confronta solo il pezzo. Uso: node scripts/ritaglia.mjs <in.png> <out.png> <x0> [x1]
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { homedir } from "node:os";
import { join } from "node:path";

const { png } = await import(join(homedir(), ".claude/skills/figma-ui-design/parita.mjs"));
const [ingresso, uscita, x0s, x1s] = process.argv.slice(2);
const { w, h, px } = png(readFileSync(ingresso));
const x0 = Number(x0s), x1 = x1s ? Number(x1s) : w, larga = x1 - x0;

const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const pezzo = (tipo, dati) => {
  const t = Buffer.concat([Buffer.from(tipo, "ascii"), dati]), l = Buffer.alloc(4), c = Buffer.alloc(4);
  l.writeUInt32BE(dati.length); c.writeUInt32BE(crc(t));
  return Buffer.concat([l, t, c]);
};
const righe = Buffer.alloc((larga * 4 + 1) * h);
for (let y = 0; y < h; y++) px.copy(righe, y * (larga * 4 + 1) + 1, (y * w + x0) * 4, (y * w + x1) * 4); // filtro 0 per riga
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(larga, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(uscita, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pezzo("IHDR", ihdr), pezzo("IDAT", deflateSync(righe)), pezzo("IEND", Buffer.alloc(0))]));
console.log(`ritaglio: ${uscita} ${larga}x${h} (x ${x0}..${x1})`);

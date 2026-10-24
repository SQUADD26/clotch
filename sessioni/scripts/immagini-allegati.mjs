// Le tre immagini finte dei frame degli allegati (148:47483): `node scripts/immagini-allegati.mjs` scrive design/scene/immagini/allegato-{scura,chiara,blu}.png.
// Scura e chiara sono l'«anteprima» del componente «Allegato nella casella» esportata da Figma a scala 1 (118 x 118); la blu è la stessa, ridisegnata con i colori del frame.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const D = new URL("../design/scene/immagini/", import.meta.url);
const FIGMA = {
  scura: "iVBORw0KGgoAAAANSUhEUgAAAHYAAAB2CAYAAAAdp2cRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAAAyBJREFUeAHt3dtqGlEUh/E1HhKNiggJCM0LtC/QvP9V8gLtC6RXFUTxVA9jXZZAL8S1heJs//1+MHfeTD5n73GP7hTD4XBvkFMzSCKsKMKKIqwowooirCjCimqkvKjf71uv17NajfdBlcqytPl8buPxOHxtGHYwGByjonp+YXkLDzyZTM6/1gLdbteQl5QLjbFVVBh2Op0a8uLzbCScY30s97Hdh+SiKAzV2e/3xwstml9dwdMdTcyxoggrirCiCCuKsKKS1ord80PNvj7W7Klldl+73Y8974u9fZ+U9u1wKEsK60FfHuum4PmhOBx16zULexvtTFU4FH/p60T928vhzeqjkKrwzD73dU/eRyJV4Zn50KXqqaV7bv/1XfG98NnzcUcUYUURVhRhRRFWFGFFEVZUGPaX9lq5rDDsz5XuV6J+LHTPLQyr/ARE+dFdGNafXyrGfRtpP5NNeh77evgjTDd/HuF9uuGHAn6/MDpMLa+HN+q78DDs+F6xKD7uiCKsKMKKIqwowopK+rjT6XSs3W7zM8qK+c8oV6uVzWaz8LVhWP9drEdF9fzC8hYeOPrxczgUt1otQ15SLjTmWFFh2OVyaciLz7ORcI79GMu5eaqez62LxeJ4RJLuij1uyk4lyAdzrCjCiiKsKMKKIqwo1opPuGRNNlesFZ9wyZpsrlgrPuOW39DMsaJYKz4jZU02V6wVn3DJmmyuWCsWxRwrirCiCCuKsKIIKyp5v+J6vW7NZvP4r1r4isz17XY72263xyNFUlgPend3Z6iOX1h++EW12WzC14dDcaPRIGpGvIUHjiSFRV58BI2EYVPeHbiulP/jy13xDUq5eSWsKMKKIqwowooirCjCiiKsKMKKIqwowooirCjCiiKsKMKKIqwowooirCjCiiKsKMKKIqwowooirCjCiiKsKMKKIqwowooirCjCiiKsKMKKIqwowooirCjCiiKsqDCs7yuI2xOGLcvSkJeUJmHYlB1KcF3/ZNcY31+IuPnwFil7PSVtCbNer4+X/8cGXrguv8/xwzv4hZYiea+fS3YFQ/W4/EQRVhRhRRFWFGFFEVYUYUX9BiAL6E/Ykw3oAAAAAElFTkSuQmCC",
  chiara: "iVBORw0KGgoAAAANSUhEUgAAAHYAAAB2CAYAAAAdp2cRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAAAtlJREFUeAHt3b9xE0EUgPG9k84iIiSjAKAAcBvuwxSD+6ANQwFAAWSEjAL05yT8rHGm8Vsl0t7n7zfjTInmk/b29jTP3XK53Bfh9EVIhoUyLJRhoQwLZVgow0LNa1602Wwe/say33vLe0ld15X5fFaurob0tWnY9TqibosuL75YTy2yuOlSvN2ORW2paeI1FioNG2u62jKb5U3Sa2ys5bFnGkc3T5d22DzNH5rke96qXfFiERfqfCemdniNhTIslGGhDAtlWKiqXXH4/ntb7r6tyq8/Y/m7mu5tz8e383Lzfig3H64KWVfzY7a7+1X5cv+vkHy+flVurxeFKl2Kv/5Y46KGeE+xClHlYX9uClVcWqjSsORPdewXqF70rnjKm8CMtztQhoUyLJRhoQwLZVgow0KlYV8vuqLpScO+e8P9lWI86aFKw95+4j4Bicd3VGnY+FQTH2/FeyI/k+1qh4vE47t40jPlhwKxX4hLS6xC5GU4dE6NYfJ2B8qwUIaFMiyUYaGcQTEhzqCAcgYFnDMoXjBnUEyQMyhgnEEhr7FUhoUyLJRhoQwL5VnxEaecybbKs+IjTjmTbZVnxc+Y8nv3GgvlWfEzas5kW+VZ8RGnnMm2yrNiKK+xUIaFMiyUYaEMC1W9n4/bnThm2+32/kTmAmaz/vFMIW7DalQ/BFiv/W3xJY3j7vEvvlTDkN96Vp0VG7Ud0SICZyrCGrU1sYJm0rA1nw6dV+xzMu6KJ6hm82pYKMNCGRbKsFCGhTIslGGhDAtlWCjDQhkWyrBQhoUyLJRhoQwLZVgow0IZFsqwUIaFMiyUYaEMC2VYKMNCGRbKsFCGhTIslGGh0rAxV1DTk4bte8O2pu/zhTZ9Rc2EEp3XMOTjdtOwMV/IuO2IFjWznqrmPMXc3liSDwO8HDZybrHPib+YHR1ftBrVk9kOU8H8z5RT4e0OlGGhDAtlWCjDQhkWyrBQ/wHzg+vPeYCUiwAAAABJRU5ErkJggg==",
};
for (const [nome, b64] of Object.entries(FIGMA)) writeFileSync(new URL(`allegato-${nome}.png`, D), Buffer.from(b64, "base64"));

// blu: sfondo #145694, barra, due righe e pannello #339cff, bolla #f2c14e (misure in px dentro 118 x 118, angoli da 5)
const W = 118, H = 118;
const rette = [[0, 0, 118, 118, "#145694", 0], [8, 8, 102, 6, "#339cff", 5], [8, 20, 56, 18, "#f2c14e", 5], [8, 44, 102, 6, "#339cff", 5], [8, 56, 64, 6, "#339cff", 5], [8, 68, 102, 42, "#339cff", 5]];
const px = Buffer.alloc(W * H * 4);
const dentro = (x, y, [rx, ry, rw, rh, , r]) => {
  if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) return false;
  const cx = x < rx + r ? rx + r : x >= rx + rw - r ? rx + rw - r : x, cy = y < ry + r ? ry + r : y >= ry + rh - r ? ry + rh - r : y;
  return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r || (cx === x + 0.5 && cy === y + 0.5) || (x >= rx + r && x < rx + rw - r) || (y >= ry + r && y < ry + rh - r);
};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const t of rette) if (dentro(x, y, t)) px.set([...Buffer.from(t[4].slice(1), "hex"), 255], (y * W + x) * 4);
const riga = (y) => Buffer.concat([Buffer.from([0]), px.subarray(y * W * 4, (y + 1) * W * 4)]);
const crc = (b) => { let c, t = [], r = -1; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ -1) >>> 0; };
const pezzo = (tipo, dati) => { const l = Buffer.alloc(4), c = Buffer.alloc(4), b = Buffer.concat([Buffer.from(tipo), dati]); l.writeUInt32BE(dati.length); c.writeUInt32BE(crc(b)); return Buffer.concat([l, b, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr.set([8, 6, 0, 0, 0], 8);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pezzo("IHDR", ihdr),
  pezzo("IDAT", deflateSync(Buffer.concat(Array.from({ length: H }, (_, y) => riga(y))))), pezzo("IEND", Buffer.alloc(0))]);
writeFileSync(new URL("allegato-blu.png", D), png);

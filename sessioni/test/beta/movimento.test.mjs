// node --test sessioni/test/beta/movimento.test.mjs: i criteri di movimento su campioni finti.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { difettiInterruzione, difettiMovimento } from './movimento.mjs';

const serie = (ms, f, x = () => 0) => Array.from({ length: Math.round(ms / 16) + 1 }, (_, i) => { const p = Math.min(1, (i * 16) / ms); return [100 + i * 16, f(p), x(p), 0, 1]; });
const anim = (o) => ({ dove: 'div.menu', nome: 'opacity', proprieta: ['opacity'], durata: 200, infinita: false, curva: 'ease-out', ...o });
const giro = (a, evento = 95) => ({ evento, T: a[0].serie.map((s) => s[0]), animazioni: a });
const criteri = (d) => d.map((x) => x.criterio).sort();

test('token e curva viva: nessun difetto', () => assert.deepEqual(difettiMovimento(giro([anim({ serie: serie(200, (p) => 1 - (1 - p) ** 3) })])), []));
test('durata fuori token, lineare, parte tardi', () =>
  assert.deepEqual(criteri(difettiMovimento(giro([anim({ durata: 300, curva: 'linear', serie: serie(300, (p) => p) })], 0))), ['M2', 'M3', 'M5']));
test('proprietà di layout', () => assert.deepEqual(criteri(difettiMovimento(giro([anim({ proprieta: ['height'], serie: serie(200, (p) => 1 - (1 - p) ** 3) })]))), ['MLAYOUT']));
test('M5 dal clic, non dal premuto: parte subito dopo il rilascio', () => {
  const a = [anim({ serie: serie(200, (p) => 1 - (1 - p) ** 3).map((s) => [s[0] + 240, ...s.slice(1)]) })];
  assert.deepEqual(criteri(difettiMovimento({ evento: 0, eventi: [0, 330], T: a[0].serie.map((s) => s[0]), animazioni: a })), []);
  assert.deepEqual(criteri(difettiMovimento({ evento: 0, eventi: [0], T: a[0].serie.map((s) => s[0]), animazioni: a })), ['M5']);
});
test('M5: il rilascio arriva dopo l\'inizio del fotogramma che lo disegna', () => {
  const a = [anim({ serie: serie(200, (p) => 1 - (1 - p) ** 3).map((s) => [s[0] + 88, ...s.slice(1)]) })];
  assert.deepEqual(criteri(difettiMovimento({ evento: 100, eventi: [100, 195], T: a[0].serie.map((s) => s[0]), animazioni: a })), []);
});
test('M5 dall\'inizio vero dell\'animazione, non dal primo campione arrivato tardi', () => {
  const a = [anim({ inizio: 105, serie: serie(200, (p) => 1 - (1 - p) ** 3).map((s) => [s[0] + 90, ...s.slice(1)]) })];
  assert.deepEqual(criteri(difettiMovimento({ evento: 100, eventi: [100], T: a[0].serie.map((s) => s[0]), animazioni: a })), []);
  assert.deepEqual(criteri(difettiMovimento({ evento: 100, eventi: [100], T: a[0].serie.map((s) => s[0]), animazioni: [{ ...a[0], inizio: undefined }] })), ['M5']);
});
test('gruppo di una View Transition: la misura della foto non è layout', () => assert.deepEqual(criteri(difettiMovimento(giro([anim({ dove: 'html::view-transition-group(superficie)', proprieta: ['width', 'height', 'transform'], serie: serie(200, (p) => 1 - (1 - p) ** 3) })]))), []));
test('movimento ridotto: si sposta', () =>
  assert.deepEqual(criteri(difettiMovimento(giro([anim({ proprieta: ['transform'], serie: serie(200, () => 1, (p) => 8 * p) })]), { ridotto: true })), ['M8']));
test('interruzione: l\'uscita riparte da 1 invece che da dove era arrivata', () => {
  const entra = anim({ dove: 'div.sovrapposto.menu', serie: [[0, 0, 0, 0, 1], [16, 0.2, 0, 0, 1], [33, 0.35, 0, 0, 1], [50, 0.47, 0, 0, 1], [66, 0.55, 0, 0, 1]] });
  const esce = (da) => anim({ dove: 'div.sovrapposto.menu.esce', serie: [[100, da, 0, 0, 1], [133, da * 0.8, 0, 0, 1], [166, da * 0.4, 0, 0, 1], [200, 0, 0, 0, 1]] });
  assert.deepEqual(criteri(difettiInterruzione({ eventi: [0, 80], animazioni: [entra, esce(1)] })), ['M10']);
  assert.deepEqual(criteri(difettiInterruzione({ eventi: [0, 80], animazioni: [entra, esce(0.55)] })), []);
});
test('interruzione: un\'entrata veloce a pochi fotogrammi non è un salto', () =>
  assert.deepEqual(criteri(difettiInterruzione({ eventi: [0, 200], animazioni: [anim({ serie: [[0, 0, 0, 0, 1], [33, 0.53, 0, 0, 1], [66, 0.85, 0, 0, 1], [100, 0.97, 0, 0, 1], [150, 1, 0, 0, 1]] })] })), []));
test('M5: tooltip con attesa voluta e transizioni sotto una View Transition non contano', () => {
  const a = (o) => [anim({ ...o, serie: serie(200, (p) => 1 - (1 - p) ** 3).map((s) => [s[0] + 400, ...s.slice(1)]) })];
  const g = (x) => criteri(difettiMovimento({ evento: 100, eventi: [100], T: x[0].serie.map((s) => s[0]), animazioni: x }));
  assert.deepEqual(g(a({ attesa: true })), []); assert.deepEqual(g(a({ coperta: true })), []); assert.deepEqual(g(a({})), ['M5']);
});
test('M5: conta il primo cambio dopo il gesto, non le conseguenze', () => {
  const sposta = (ms) => serie(200, (p) => 1 - (1 - p) ** 3).map((s) => [s[0] + ms, ...s.slice(1)]);
  const x = [anim({ serie: sposta(10) }), anim({ dove: 'button.altro', serie: sposta(300) })];
  assert.deepEqual(criteri(difettiMovimento({ evento: 100, eventi: [100], T: x[0].serie.map((s) => s[0]), animazioni: x })), []);
});
test('interruzione con salto', () => assert.deepEqual(criteri(difettiInterruzione({ animazioni: [anim({ serie: [[0, 0, 0, 0, 1], [16, 0.2, 0, 0, 1], [32, 1, 0, 0, 1]] })] })), ['M10']));

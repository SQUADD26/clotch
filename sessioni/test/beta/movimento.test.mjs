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
test('gruppo di una View Transition: la misura della foto non è layout', () => assert.deepEqual(criteri(difettiMovimento(giro([anim({ dove: 'html::view-transition-group(superficie)', proprieta: ['width', 'height', 'transform'], serie: serie(200, (p) => 1 - (1 - p) ** 3) })]))), []));
test('movimento ridotto: si sposta', () =>
  assert.deepEqual(criteri(difettiMovimento(giro([anim({ proprieta: ['transform'], serie: serie(200, () => 1, (p) => 8 * p) })]), { ridotto: true })), ['M8']));
test('interruzione con salto', () => assert.deepEqual(criteri(difettiInterruzione({ animazioni: [anim({ serie: [[0, 0, 0, 0, 1], [16, 0.2, 0, 0, 1], [32, 1, 0, 0, 1]] })] })), ['M10']));

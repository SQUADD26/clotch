// wrapper provvisorio, non committato: aggiunge le scene «cri-*» alle aree del cliccatore
const { AREE } = await import(process.cwd() + '/test/beta/avvio.mjs');
for (const n of process.env.SCENE.split(',')) AREE['cri-' + n] = { scena: 'cri-' + n, radice: '.pezzo-chat' };
process.argv.splice(2, 0, '--area', process.env.AREA);
await import(process.cwd() + '/test/beta/clicca.mjs');

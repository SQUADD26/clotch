// wrapper del cliccatore: aggiunge le scene «cst-*» alle aree. SCENE=errori,lavoro AREA=nome
const { AREE } = await import(process.cwd() + '/test/beta/avvio.mjs');
for (const n of process.env.SCENE.split(',')) AREE['cst-' + n] = { scena: 'cst-' + n, radice: '.pezzo-chat' };
process.argv.splice(2, 0, '--area', process.env.AREA);
await import(process.cwd() + '/test/beta/clicca.mjs');

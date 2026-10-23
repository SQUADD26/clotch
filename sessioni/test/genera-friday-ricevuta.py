#!/usr/bin/env python3
"""Fixture tramite decidi del motore. Uso: python3 test/genera-friday-ricevuta.py <cartella-hook>.
Solo HOME temporanea; nessun modello, voce o comando inverso eseguito.
"""
import os, pathlib, shutil, sys, tempfile
hooks = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(__file__).resolve().parent / 'fixtures/friday-ricevuta'
with tempfile.TemporaryDirectory() as d:
    home = pathlib.Path(d)
    os.environ.update(HOME=d, REGISTRI_PROVA='1', REGISTRI_PROVA_DIR=d, FRIDAY_DIR=str(home / '.claude/friday'),
                      FRIDAY_REGISTRO=str(home / '.claude/registro'))
    sys.path.insert(0, str(hooks))
    from friday_annulla import decidi
    from friday_fiducia import locale
    from friday_registro import leggi
    decidi('Azione locale città 🚀 "citazione"\nseconda riga', 'Percorso C:\\locale\tcontrollato', ['python3', 'azione-finta.py'], chat='s-1')
    # Dominio annidato accettato dal produttore: chiavi numeriche e codepoint oltre UTF-16.
    decidi('Dati annidati', 'Ordine delle chiavi', ['python3', 'azione-finta.py'], chat={'\U00010000': ['città', {'2': True, '10': None}], '\ue000': {'z': 7, 'a': '\b'}})
    eventi = list(leggi(d=str(home / '.claude/registro')))
    assert len(eventi) == 2 and all(locale(e) for e in eventi)
    if out.exists():
        shutil.rmtree(out)
    registro = out / '.claude/registro'
    registro.mkdir(parents=True)
    for f in (home / '.claude/registro').glob('*.jsonl'):
        shutil.copyfile(f, registro / f.name)
    shutil.copytree(home / '.claude/friday/eventi-locali', out / '.claude/friday/eventi-locali')
    print('FIXTURE_PRODUTTORE_PYTHON_OK decisioni=2 receipt_verificate=2')

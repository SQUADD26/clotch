import json,sys
b=json.load(open('design/scene/101-13650.json'))
def mk(nome, richieste, msgs):
    s=json.loads(json.dumps(b)); s['registro']['chat']['s1']['richieste']=richieste; s['messaggi']={'s1':msgs}
    json.dump(s,open(f'design/scene/cri-{nome}.json','w'))
t=1792793046531
u=lambda x,d=0:{"tipo":"utente","testo":x,"t":t+d}
a=lambda x,d=0:{"tipo":"assistente","testo":x,"modello":"claude-opus-5-5","t":t+d}
def st(nome,ing,es=None,i=0,d=0):
    return {"tipo":"strumento","nome":nome,"ingresso":ing,"esito":es,"t":t+d,"id":f"t{i}"}
LONG=" && ".join(f"find ./sessioni/src/ui/chat -name '*.tsx' -newer /tmp/marker{i} -exec grep -n 'registraAzione' {{}} +" for i in range(12))
mk('permessi',[
 {"rid":"r1","genere":"permesso","strumento":"Bash","ingresso":{"command":LONG,"description":"Cerca dove si registrano le scorciatoie in tutti i file della chat, uno alla volta, e poi stampa le righe trovate con il numero di riga accanto."},"domande":[],"t":t},
 {"rid":"r2","genere":"permesso","strumento":"Write","ingresso":{"file_path":"/work/x/y.ts"},"domande":[]},
 {"rid":"r3","genere":"permesso","strumento":"Bash","ingresso":{"command":"ls"},"domande":[]}],
 [u("Fai tutto."),a("Chiedo tre permessi.",1)])
qs=[{"question":"Dove salvo le immagini della prova di parità, visto che la cartella di destinazione potrebbe già contenere file di prove vecchie da non toccare?","header":"Dove","multiSelect":False,"options":[{"label":"Nel repo, in sessioni/design/app (Recommended)","description":"d"},{"label":"Nella cartella appunti della sessione, quella temporanea che sparisce alla chiusura della sessione stessa","description":"d"},{"label":"Non salvarle: mostrale e basta","description":"d"}]},
 {"question":"Quali schermate?","header":"Quali","multiSelect":True,"options":[{"label":"Barra"},{"label":"Chat"},{"label":"Impostazioni"}]},
 {"question":"Tema?","header":"T","multiSelect":False,"options":[{"label":"Chiaro"},{"label":"Scuro"}]}]
mk('domande',[{"rid":"r2","genere":"domanda","strumento":"AskUserQuestion","ingresso":{"questions":qs},"domande":[]}],
 [u("Prova."),a("Ho dubbi.",1),st("AskUserQuestion",{"questions":qs},None,1,2)])
mk('domanda-senza-rid',[],[u("Prova."),a("Ho dubbi.",1),st("AskUserQuestion",{"questions":qs[:1]},None,1,2)])
plan="Porto la pagina nel codice.\n"+"\n".join(f"{i}. Passo numero {i}: faccio una cosa abbastanza lunga da andare a capo almeno una volta sulla riga della finestra stretta" for i in range(1,26))
mk('piano',[{"rid":"r3","genere":"piano","strumento":"ExitPlanMode","ingresso":{"plan":plan},"domande":[]}],[u("Piano."),st("ExitPlanMode",{"plan":plan},None,0,1)])
mk('piano-senza-rid',[],[u("Piano."),st("ExitPlanMode",{"plan":plan},None,0,1)])
mk('esiti',[],[u("Esiti."),
 st("AskUserQuestion",{"questions":qs[:1]},{"testo":'User has answered your questions: "Dove"="Nel repo, in sessioni/design/app, la cartella con le immagini della prova di parità di tutte le schermate dell\'app e anche altro testo".',"errore":False},0,1),
 st("AskUserQuestion",{"questions":qs[:1]},{"testo":"Request interrupted by user for tool use","errore":True},1,2),
 st("ExitPlanMode",{"plan":plan},{"testo":"User has approved your plan.","errore":False},2,3),
 st("ExitPlanMode",{"plan":plan},{"testo":"The user doesn't want to proceed with this tool use. The tool use was rejected","errore":True},3,4),
 st("Edit",{"file_path":"sessioni/src/ui/chat/Richieste.tsx","old_string":"a\nb","new_string":"a\nc\n"+"x"*300},{"testo":"ok","errore":False},4,5),
 st("Bash",{"command":"rm -rf x"},{"testo":"The user doesn't want to proceed with this tool use. The tool use was rejected","errore":True},5,6)])
# giro 2: piani veri di Claude (markdown con titoli, sotto-voci, testo dopo l'elenco) e in sola prosa
p2="## Piano\n\nCapisco il problema: la barra non si apre a 480.\n\n### Passi\n1. Leggo la barra\n   - controllo il breakpoint\n   - controllo il CSS\n2. Correggo la regola\n3. Provo a 480 e a 1440\n\n**Verifica**: lancio i test e confronto con Figma.\n\n### Rischi\nNessuno, tocco un solo file."
mk('piano-markdown',[{"rid":"r3","genere":"piano","strumento":"ExitPlanMode","ingresso":{"plan":p2},"domande":[]}],[u("Piano."),st("ExitPlanMode",{"plan":p2},None,0,1)])
p3="Il problema è nel breakpoint della barra. Ho letto il CSS e la regola a 480 non scatta perché il contenitore ha una larghezza fissa.\n\nCorreggo la regola, poi provo la finestra stretta e quella larga e confronto con il disegno.\n\nNon tocco altri file."
mk('piano-prosa',[{"rid":"r3","genere":"piano","strumento":"ExitPlanMode","ingresso":{"plan":p3},"domande":[]}],[u("Piano."),st("ExitPlanMode",{"plan":p3},None,0,1)])

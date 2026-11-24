# Parcheggio Raduno

App per l'ingresso al raduno: elenco iscritti dal modulo Google, e per ognuno **Entrato**, **Pagato**, **Gara scarichi**, **Foto con ragazze immagine**. Si aggiorna su tutti i telefoni ogni 5 secondi.

- **App web:** https://capofusnez.github.io/parcheggio-raduno/
- **APK Android:** https://github.com/capofusnez/parcheggio-raduno/releases/latest/download/parcheggio-raduno.apk

## Come funziona

I dati stanno solo nel foglio Google dell'organizzatore, che resta privato. Uno script attaccato al foglio (`apps-script/Code.gs`) fa da tramite e risponde solo a chi ha il link con la chiave segreta. In questo repository c'è solo il codice: niente dati, niente chiavi.

L'app aggiunge in fondo al foglio le colonne `ID app`, `Entrato`, `Ora ingresso`, `Pagato`, `Scarichi`, `Foto`, `N° gara`, `Note app`. Le domande del modulo (nome, cognome, auto, targa, telefono, scarichi, foto) vengono riconosciute dal titolo della colonna.

## Messa in funzione (dal telefono)

1. Apri `apps-script/Code.gs` qui su GitHub, tocca i tre puntini → **Copia**.
2. Apri il foglio delle risposte in Chrome in **modalità desktop** → **Estensioni → Apps Script**, cancella tutto e incolla. Salva.
3. **Esegui il deployment → Nuovo deployment** → ingranaggio → **App web**. Esegui come: *Me*. Chi ha accesso: *Chiunque*. Autorizza (Avanzate → Vai al progetto).
4. In alto scegli la funzione **creaLink** → **Esegui**. Nel foglio compare la scheda **Link app** con il link da condividere.

Per invalidare il link: esegui di nuovo **creaLink**. Se modifichi lo script: *Gestisci deployment* → matita → *Nuova versione*.

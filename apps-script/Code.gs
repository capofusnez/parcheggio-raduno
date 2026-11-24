/**
 * Parcheggio Raduno – script da incollare nel foglio dei partecipanti
 * (Foglio Google → Estensioni → Apps Script → incolla tutto al posto del contenuto).
 *
 * L'app parla solo con questo script, che legge e scrive il foglio a nome del proprietario.
 * Senza la chiave segreta non risponde nulla. Il foglio resta privato.
 *
 * Passi:
 *  1. Salva (icona dischetto).
 *  2. Esegui il deployment → Nuovo deployment → tipo "App web"
 *     Esegui come: Me · Chi ha accesso: Chiunque → Esegui il deployment → autorizza.
 *  3. In alto scegli la funzione "creaLink" e premi Esegui.
 *     Nel foglio compare la scheda "Link app" con il link da condividere.
 *  Per cambiare la chiave (vecchi link non più validi): esegui di nuovo "creaLink".
 */

var APP_URL = 'https://capofusnez.github.io/parcheggio-raduno/';

// colonne aggiunte dall'app in fondo al foglio
var APP_COLS = ['ID app', 'Entrato', 'Ora ingresso', 'Pagato', 'Scarichi', 'Foto', 'N° gara', 'dB gara', 'Note app'];
var KEYS = { 'ID app': 'id', 'Entrato': 'entrato', 'Ora ingresso': 'ora', 'Pagato': 'pagato', 'Scarichi': 'scarichi', 'Foto': 'foto', 'N° gara': 'num', 'dB gara': 'db', 'Note app': 'note' };

// riconoscimento delle domande del modulo dal titolo della colonna
var FIELDS = [
  ['cognome', /cognome|surname/i],
  ['nome', /^\s*(nome|name|nominativo|pilota|concorrente|nome e cognome)/i],
  ['auto', /auto|macchina|vettura|modello|veicolo|marca/i],
  ['targa', /targa|plate/i],
  ['tel', /tel|cell|whatsapp|phone|numero di/i],
  ['scarichiForm', /scaric|exhaust|sound/i],
  ['fotoForm', /foto|ragazz|photo|immagine/i]
];

function creaLink() {
  var chiave = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  PropertiesService.getScriptProperties().setProperty('CHIAVE', chiave);
  var url = ScriptApp.getService().getUrl();
  if (!url) throw new Error('Prima fai Esegui il deployment → Nuovo deployment → App web, poi esegui di nuovo creaLink.');
  var id = (url.match(/\/s\/([^/]+)\/exec/) || [])[1] || url;
  var link = APP_URL + '#s=' + id + '&k=' + chiave;
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Link app') || ss.insertSheet('Link app');
  sh.clear();
  sh.getRange('A1:A4').setValues([['Link da condividere con i collaboratori (chi ha questo link entra nell\'app):'], [link], ['Per invalidare il link: Estensioni → Apps Script → esegui di nuovo creaLink.'], ['Creato il ' + new Date().toLocaleString('it-IT')]]);
  sh.setColumnWidth(1, 900);
  getSheet_(); preparaColonne_();
  Logger.log(link);
  return link;
}

function doGet(e) { return risposta_(gestisci_(e && e.parameter || {})); }
function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (x) { p = e && e.parameter || {}; }
  return risposta_(gestisci_(p));
}

function risposta_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function gestisci_(p) {
  var chiave = PropertiesService.getScriptProperties().getProperty('CHIAVE');
  if (!chiave || p.k !== chiave) return { ok: false, errore: 'chiave' };
  try {
    if (p.a === 'set') return scrivi_(p);
    if (p.a === 'add') return aggiungi_(p);
    if (p.a === 'cfg') return impostazioni_(p);
    return elenco_();
  } catch (x) {
    return { ok: false, errore: String(x && x.message || x) };
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActive();
  var nome = PropertiesService.getScriptProperties().getProperty('FOGLIO');
  var sh = nome && ss.getSheetByName(nome);
  if (!sh) {
    var tutti = ss.getSheets();
    sh = tutti.filter(function (s) { return /risposte|responses/i.test(s.getName()); })[0] ||
         tutti.filter(function (s) { return s.getName() !== 'Link app'; })[0];
  }
  return sh;
}

function intestazioni_(sh) {
  var n = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, n).getValues()[0].map(function (h) { return String(h).trim(); });
}

function preparaColonne_() {
  var sh = getSheet_();
  var head = intestazioni_(sh);
  var mancanti = APP_COLS.filter(function (c) { return head.indexOf(c) < 0; });
  if (mancanti.length) {
    var start = head.filter(String).length ? sh.getLastColumn() + 1 : 1;
    sh.getRange(1, start, 1, mancanti.length).setValues([mancanti]).setFontWeight('bold');
    head = intestazioni_(sh);
  }
  return head;
}

function mappa_(head) {
  var m = {}, usate = {};
  APP_COLS.forEach(function (c) { m[KEYS[c]] = head.indexOf(c); usate[head.indexOf(c)] = 1; });
  FIELDS.forEach(function (f) {
    for (var i = 0; i < head.length; i++) {
      if (usate[i] || !head[i]) continue;
      if (f[0] === 'nome' && /cognome/i.test(head[i])) continue;
      if (f[1].test(head[i])) { m[f[0]] = i; usate[i] = 1; return; }
    }
    m[f[0]] = -1;
  });
  m.timestamp = /informazioni cronologiche|timestamp|data/i.test(head[0] || '') ? 0 : -1;
  return m;
}

var SI = /^\s*(s[iìí]|yes|y|x|true|1|ok|certo|voglio|vero)/i;

function elenco_() {
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = getSheet_(), head = preparaColonne_(), m = mappa_(head);
    var last = sh.getLastRow(), rows = [];
    if (last >= 2) {
      var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
      var nuoviId = [], servono = false;
      vals.forEach(function (r) {
        var id = String(r[m.id] || '');
        var vuota = r.every(function (v, i) { return i === m.id || v === '' || v === null; });
        if (!id && !vuota) { id = Utilities.getUuid().replace(/-/g, '').slice(0, 12); servono = true; }
        nuoviId.push([id]);
        if (vuota) return;
        var g = function (k) { return m[k] >= 0 ? r[m[k]] : ''; };
        var flag = function (k, form) { var v = String(g(k)); if (v) return SI.test(v); return form ? SI.test(String(g(form))) : false; };
        var ora = g('ora');
        rows.push({
          id: id, nome: String(g('nome')), cognome: String(g('cognome')), auto: String(g('auto')),
          targa: String(g('targa')).toUpperCase(), tel: String(g('tel')),
          entrato: flag('entrato'), pagato: flag('pagato'),
          scarichi: flag('scarichi', 'scarichiForm'), foto: flag('foto', 'fotoForm'),
          ora: ora instanceof Date ? Utilities.formatDate(ora, Session.getScriptTimeZone(), 'HH:mm') : String(ora),
          num: String(g('num')), db: String(g('db')), note: String(g('note'))
        });
      });
      if (servono) sh.getRange(2, m.id + 1, nuoviId.length, 1).setValues(nuoviId);
    }
    var pr = PropertiesService.getScriptProperties();
    return {
      ok: true, rows: rows, foglio: sh.getName(),
      cfg: { prezzo: +pr.getProperty('PREZZO') || 0, prezzoScarichi: +pr.getProperty('PREZZO_SCARICHI') || 0, nome: pr.getProperty('NOME_RADUNO') || '' },
      colonne: Object.keys(m).filter(function (k) { return m[k] >= 0; })
    };
  } finally { lock.releaseLock(); }
}

function trovaRiga_(sh, m, id) {
  var last = sh.getLastRow(); if (last < 2) return -1;
  var ids = sh.getRange(2, m.id + 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

// p.id, p.f (campo), p.v (valore)
function scrivi_(p) {
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = getSheet_(), head = preparaColonne_(), m = mappa_(head);
    var riga = trovaRiga_(sh, m, p.id);
    if (riga < 0) return { ok: false, errore: 'non trovato' };
    var flags = { entrato: 1, pagato: 1, scarichi: 1, foto: 1 };
    var campi = { nome: 1, cognome: 1, auto: 1, targa: 1, tel: 1, num: 1, db: 1, note: 1 };
    var f = String(p.f || '');
    if (flags[f]) {
      var on = String(p.v) === '1';
      sh.getRange(riga, m[f] + 1).setValue(f === 'scarichi' || f === 'foto' ? (on ? 'SI' : 'NO') : (on ? 'SI' : ''));
      if (f === 'entrato') sh.getRange(riga, m.ora + 1).setValue(on ? new Date() : '');
    } else if (campi[f]) {
      var col = m[f];
      if (col < 0) col = m.note;
      var v = String(p.v || '').slice(0, 200);
      if (f === 'db' && v !== '') { var n = parseFloat(v.replace(',', '.')); v = isNaN(n) ? '' : n; }
      sh.getRange(riga, col + 1).setValue(v);
    } else return { ok: false, errore: 'campo' };
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// iscrizione fatta al cancello
function aggiungi_(p) {
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = getSheet_(), head = preparaColonne_(), m = mappa_(head);
    var r = head.map(function () { return ''; });
    if (m.timestamp >= 0) r[m.timestamp] = new Date();
    var extra = [];
    ['nome', 'cognome', 'auto', 'targa', 'tel'].forEach(function (k) {
      var v = String(p[k] || '').slice(0, 200); if (!v) return;
      if (m[k] >= 0) r[m[k]] = k === 'targa' ? v.toUpperCase() : v; else extra.push(v);
    });
    var id = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
    r[m.id] = id; r[m.num] = String(p.num || '');
    r[m.note] = [String(p.note || '')].concat(extra, ['iscritto al cancello']).filter(String).join(' · ');
    sh.appendRow(r);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

function impostazioni_(p) {
  var pr = PropertiesService.getScriptProperties();
  if (p.prezzo !== undefined) pr.setProperty('PREZZO', String(+p.prezzo || 0));
  if (p.prezzoScarichi !== undefined) pr.setProperty('PREZZO_SCARICHI', String(+p.prezzoScarichi || 0));
  if (p.nome !== undefined) pr.setProperty('NOME_RADUNO', String(p.nome).slice(0, 80));
  return { ok: true };
}

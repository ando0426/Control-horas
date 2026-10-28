/**
 * Control de horas — backend en Google Apps Script
 *
 * Este código va dentro de la hoja de Google (Extensiones > Apps Script).
 * Guarda y lee los registros de horas que envía la página web.
 *
 * PASO 1: cambie el PIN de abajo por uno que solo su mamá conozca.
 * PASO 2: ejecute la función "configurar" una vez (botón ▶ Ejecutar).
 * PASO 3: Implementar > Nueva implementación > Aplicación web.
 */

const PIN_INICIAL = '1234'; // <-- CAMBIE ESTE PIN (4 a 8 números)

const HOJA_REGISTRO = 'Registro';
const HOJA_CONFIG = 'Configuracion';
const HOJA_FESTIVOS = 'Festivos';

const ENCABEZADOS = [
  'ID', 'Fecha', 'Entrada', 'Salida', 'Descanso (min)', 'Tipo de día',
  'Horas trabajadas', 'Ordinarias diurnas', 'Ordinarias nocturnas',
  'Extra diurnas', 'Extra nocturnas', 'Pago ordinario', 'Pago extra',
  'Total del día', 'Notas', 'Actualizado'
];

// Valores 2026 (Colombia). Se pueden cambiar después en la hoja "Configuracion".
const CONFIG_INICIAL = [
  ['salario', 1750905, 'Salario mínimo mensual 2026 (Decreto 1469 de 2025)'],
  ['horasMes', 210, 'Horas ordinarias al mes (jornada de 42 h desde 15-jul-2026)'],
  ['jornadaDiaria', 8, 'Horas máximas al día. Lo que pase de aquí es hora extra'],
  ['jornadaSemanal', 42, 'Horas máximas a la semana (solo para aviso)'],
  ['recargoNocturno', 0.35, 'Recargo nocturno (7:00 p.m. a 6:00 a.m.)'],
  ['recargoDominical', 0.90, 'Recargo domingo/festivo (sube a 100% el 1-jul-2027)'],
  ['extraDiurna', 0.25, 'Recargo hora extra diurna'],
  ['extraNocturna', 0.75, 'Recargo hora extra nocturna'],
  ['inicioNoche', 19, 'Hora en que empieza la jornada nocturna (19 = 7 p.m.)'],
  ['finNoche', 6, 'Hora en que termina la jornada nocturna (6 = 6 a.m.)']
];

const FESTIVOS_INICIALES = [
  ['2026-01-01', 'Año Nuevo'], ['2026-01-12', 'Reyes Magos'], ['2026-03-23', 'San José'],
  ['2026-04-02', 'Jueves Santo'], ['2026-04-03', 'Viernes Santo'], ['2026-05-01', 'Día del Trabajo'],
  ['2026-05-18', 'Ascensión'], ['2026-06-08', 'Corpus Christi'], ['2026-06-15', 'Sagrado Corazón'],
  ['2026-06-29', 'San Pedro y San Pablo'], ['2026-07-20', 'Independencia'], ['2026-08-07', 'Batalla de Boyacá'],
  ['2026-08-17', 'Asunción de la Virgen'], ['2026-10-12', 'Día de la Raza'], ['2026-11-02', 'Todos los Santos'],
  ['2026-11-16', 'Independencia de Cartagena'], ['2026-12-08', 'Inmaculada Concepción'], ['2026-12-25', 'Navidad'],
  ['2027-01-01', 'Año Nuevo'], ['2027-01-11', 'Reyes Magos'], ['2027-03-22', 'San José'],
  ['2027-03-25', 'Jueves Santo'], ['2027-03-26', 'Viernes Santo'], ['2027-05-01', 'Día del Trabajo'],
  ['2027-05-10', 'Ascensión'], ['2027-05-31', 'Corpus Christi'], ['2027-06-07', 'Sagrado Corazón'],
  ['2027-07-05', 'San Pedro y San Pablo'], ['2027-07-20', 'Independencia'], ['2027-08-07', 'Batalla de Boyacá'],
  ['2027-08-16', 'Asunción de la Virgen'], ['2027-10-18', 'Día de la Raza'], ['2027-11-01', 'Todos los Santos'],
  ['2027-11-15', 'Independencia de Cartagena'], ['2027-12-08', 'Inmaculada Concepción'], ['2027-12-25', 'Navidad']
];

/** Ejecutar UNA vez: crea las hojas y guarda el PIN. Se puede repetir sin perder datos. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let reg = ss.getSheetByName(HOJA_REGISTRO);
  if (!reg) reg = ss.insertSheet(HOJA_REGISTRO, 0);
  reg.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS])
    .setFontWeight('bold').setBackground('#1F4E78').setFontColor('#FFFFFF').setWrap(true);
  reg.setFrozenRows(1);
  reg.getRange('A:F').setNumberFormat('@');
  reg.getRange('O:P').setNumberFormat('@');
  reg.getRange('G:K').setNumberFormat('0.00');
  reg.getRange('L:N').setNumberFormat('$#,##0');
  reg.hideColumns(1);

  let cfg = ss.getSheetByName(HOJA_CONFIG);
  if (!cfg) {
    cfg = ss.insertSheet(HOJA_CONFIG);
    cfg.getRange(1, 1, 1, 3).setValues([['Clave (no cambiar)', 'Valor', 'Descripción']]).setFontWeight('bold');
    cfg.getRange(2, 1, CONFIG_INICIAL.length, 3).setValues(CONFIG_INICIAL);
    ['recargoNocturno', 'recargoDominical', 'extraDiurna', 'extraNocturna'].forEach(function (k) {
      const fila = CONFIG_INICIAL.findIndex(function (r) { return r[0] === k; }) + 2;
      cfg.getRange(fila, 2).setNumberFormat('0%');
    });
    cfg.getRange(2, 2, CONFIG_INICIAL.length, 1).setBackground('#FFF2CC');
    cfg.autoResizeColumns(1, 3);
  }

  let fes = ss.getSheetByName(HOJA_FESTIVOS);
  if (!fes) {
    fes = ss.insertSheet(HOJA_FESTIVOS);
    fes.getRange('A:A').setNumberFormat('@');
    fes.getRange(1, 1, 1, 2).setValues([['Fecha (AAAA-MM-DD)', 'Festivo']]).setFontWeight('bold');
    fes.getRange(2, 1, FESTIVOS_INICIALES.length, 2).setValues(FESTIVOS_INICIALES);
    fes.autoResizeColumns(1, 2);
  }

  PropertiesService.getScriptProperties().setProperty('PIN', String(PIN_INICIAL));
  Logger.log('Listo. Hojas creadas y PIN guardado.');
}

/* ---------------- Web app ---------------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!pinCorrecto(p.pin)) return responder({ ok: false, error: 'PIN incorrecto' });
  return responder({ ok: true, config: leerConfig(), festivos: leerFestivos(), registros: leerRegistros() });
}

function doPost(e) {
  let datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder({ ok: false, error: 'Solicitud no válida' });
  }
  if (!pinCorrecto(datos.pin)) return responder({ ok: false, error: 'PIN incorrecto' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (datos.accion === 'guardar') guardarRegistro(datos.registro);
    else if (datos.accion === 'borrar') borrarRegistro(datos.id);
    else return responder({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return responder({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
  return responder({ ok: true, registros: leerRegistros() });
}

/* ---------------- Lógica ---------------- */

function pinCorrecto(pin) {
  const guardado = PropertiesService.getScriptProperties().getProperty('PIN');
  return guardado && String(pin || '') === guardado;
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hoja(nombre) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h) throw new Error('Falta la hoja "' + nombre + '". Ejecute la función configurar.');
  return h;
}

function leerConfig() {
  const filas = hoja(HOJA_CONFIG).getDataRange().getValues().slice(1);
  const cfg = {};
  filas.forEach(function (r) {
    if (r[0] !== '' && r[1] !== '' && !isNaN(Number(r[1]))) cfg[String(r[0]).trim()] = Number(r[1]);
  });
  return cfg;
}

function zonaHoja() {
  return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
}

/** Convierte lo que haya en la celda (fecha real o texto) a 'AAAA-MM-DD'. */
function normalizarFecha(valor, mostrado) {
  if (valor instanceof Date && !isNaN(valor)) return Utilities.formatDate(valor, zonaHoja(), 'yyyy-MM-dd');
  const t = String(mostrado || valor || '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // día/mes/año
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

/** Convierte '7:00', '07:00', '1:30 p. m.' o una hora real a 'HH:mm'. Usa el texto que se ve en la celda. */
function normalizarHora(mostrado) {
  const t = String(mostrado || '').toLowerCase().replace(/\s|\./g, '');
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  let h = Number(m[1]);
  if (/pm/.test(t) && h < 12) h += 12;
  if (/am/.test(t) && h === 12) h = 0;
  return ('0' + h).slice(-2) + ':' + m[2];
}

function leerFestivos() {
  const r = hoja(HOJA_FESTIVOS).getDataRange();
  const v = r.getValues(), d = r.getDisplayValues();
  const lista = [];
  for (let i = 1; i < v.length; i++) {
    const f = normalizarFecha(v[i][0], d[i][0]);
    if (f) lista.push(f);
  }
  return lista;
}

function leerRegistros() {
  const h = hoja(HOJA_REGISTRO);
  if (h.getLastRow() < 2) return [];
  const rango = h.getRange(2, 1, h.getLastRow() - 1, ENCABEZADOS.length);
  const v = rango.getValues(), d = rango.getDisplayValues();
  const lista = [];
  for (let i = 0; i < v.length; i++) {
    const reg = {
      id: String(d[i][0]).trim(),
      fecha: normalizarFecha(v[i][1], d[i][1]),
      entrada: normalizarHora(d[i][2]),
      salida: normalizarHora(d[i][3]),
      descanso: Number(v[i][4]) || 0,
      notas: String(d[i][14] || '')
    };
    if (reg.fecha && reg.entrada && reg.salida) {
      if (!reg.id) reg.id = 'fila' + (i + 2) + '-' + reg.fecha;
      lista.push(reg);
    }
  }
  return lista;
}

function validar(r) {
  if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) throw new Error('Fecha no válida');
  if (!/^\d{2}:\d{2}$/.test(r.entrada) || !/^\d{2}:\d{2}$/.test(r.salida)) throw new Error('Hora no válida');
  if (!r.id) throw new Error('Falta el identificador');
}

function filaDeRegistro(r) {
  const c = r.calculo || {};
  const redondo = function (x) { return Math.round((Number(x) || 0) * 100) / 100; };
  return [
    String(r.id), r.fecha, r.entrada, r.salida, Number(r.descanso) || 0, c.tipo || '',
    redondo(c.horas), redondo(c.ordDiu), redondo(c.ordNoc), redondo(c.extraDiu), redondo(c.extraNoc),
    Math.round(c.pagoOrd || 0), Math.round(c.pagoExtra || 0), Math.round(c.total || 0),
    String(r.notas || '').slice(0, 300),
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
  ];
}

function buscarFila(h, id) {
  if (h.getLastRow() < 2) return -1;
  const ids = h.getRange(2, 1, h.getLastRow() - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function guardarRegistro(r) {
  validar(r);
  const h = hoja(HOJA_REGISTRO);
  const fila = filaDeRegistro(r);
  let n = buscarFila(h, r.id);
  if (n < 0) n = h.getLastRow() + 1;
  // Forzar texto en ID, fecha, horas y tipo para que Google no los convierta
  h.getRange(n, 1, 1, 6).setNumberFormat('@');
  h.getRange(n, 15, 1, 2).setNumberFormat('@');
  h.getRange(n, 1, 1, fila.length).setValues([fila]);
  // Mantener ordenado por fecha y hora de entrada
  if (h.getLastRow() > 2) h.getRange(2, 1, h.getLastRow() - 1, ENCABEZADOS.length).sort([{ column: 2 }, { column: 3 }]);
}

function borrarRegistro(id) {
  const h = hoja(HOJA_REGISTRO);
  const n = buscarFila(h, id);
  if (n > 0) h.deleteRow(n);
}

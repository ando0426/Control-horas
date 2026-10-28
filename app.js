/* Control de horas — lógica de la página */
(function () {
  'use strict';

  const CONF = window.APP_CONFIG || {};
  const URL_SCRIPT = String(CONF.URL_SCRIPT || '').trim();
  const MODO_PRUEBA = !URL_SCRIPT;
  const CLAVE_PIN = 'horas_pin';
  const CLAVE_DEMO = 'horas_demo_registros';
  const CLAVE_CACHE = 'horas_cache';

  const FESTIVOS_PRED = ['2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03','2026-05-01','2026-05-18','2026-06-08','2026-06-15','2026-06-29','2026-07-20','2026-08-07','2026-08-17','2026-10-12','2026-11-02','2026-11-16','2026-12-08','2026-12-25','2027-01-01','2027-01-11','2027-03-22','2027-03-25','2027-03-26','2027-05-01','2027-05-10','2027-05-31','2027-06-07','2027-07-05','2027-07-20','2027-08-07','2027-08-16','2027-10-18','2027-11-01','2027-11-15','2027-12-08','2027-12-25'];

  const estado = {
    cfg: Object.assign({}, Calculo.PREDETERMINADO),
    festivos: new Set(FESTIVOS_PRED),
    registros: [],
    modo: 'quincena',
    ref: hoyISO(),
    editId: null
  };

  const $ = function (id) { return document.getElementById(id); };
  const moneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  /* ---------- Almacenamiento seguro ---------- */
  function leerLS(clave, def) {
    try { const v = localStorage.getItem(clave); return v === null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function guardarLS(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ }
  }
  function borrarLS(clave) { try { localStorage.removeItem(clave); } catch (e) {} }

  /* ---------- Fechas y formato ---------- */
  function hoyISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function aFecha(iso) { return new Date(iso + 'T12:00:00'); }
  function aISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function hora12(hhmm) {
    const p = hhmm.split(':'); let h = +p[0]; const m = p[1];
    const suf = h < 12 ? 'a. m.' : 'p. m.';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + suf;
  }
  function horasTexto(h) {
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60), mm = total % 60;
    if (!mm) return hh + ' h';
    if (!hh) return mm + ' min';
    return hh + ' h ' + mm + ' min';
  }
  function diaTexto(iso) {
    const t = aFecha(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function rangoPeriodo() {
    const d = aFecha(estado.ref);
    const y = d.getFullYear(), m = d.getMonth();
    const ultimo = new Date(y, m + 1, 0).getDate();
    let ini, fin;
    if (estado.modo === 'mes') { ini = 1; fin = ultimo; }
    else if (d.getDate() <= 15) { ini = 1; fin = 15; }
    else { ini = 16; fin = ultimo; }
    return { desde: aISO(new Date(y, m, ini)), hasta: aISO(new Date(y, m, fin)), y: y, m: m, ini: ini, fin: fin };
  }
  function moverPeriodo(paso) {
    const r = rangoPeriodo();
    let d;
    if (estado.modo === 'mes') d = new Date(r.y, r.m + paso, 1);
    else d = paso > 0 ? new Date(r.y, r.m, r.fin + 1) : new Date(r.y, r.m, r.ini - 1);
    estado.ref = aISO(d);
    pintar();
  }
  function tituloPeriodo(r) {
    const mes = new Date(r.y, r.m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    if (estado.modo === 'mes') return mes.charAt(0).toUpperCase() + mes.slice(1);
    const corto = new Date(r.y, r.m, 1).toLocaleDateString('es-CO', { month: 'short' }).replace(/\./g, '');
    return r.ini + ' – ' + r.fin + ' ' + corto + ' ' + r.y;
  }
  function lunesDe(iso) {
    const d = aFecha(iso); const dia = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dia); return aISO(d);
  }

  /* ---------- Comunicación con Google ---------- */
  async function pedir(metodo, cuerpo) {
    const pin = leerLS(CLAVE_PIN, '');
    if (MODO_PRUEBA) return pedirPrueba(metodo, cuerpo);
    let resp;
    if (metodo === 'GET') {
      resp = await fetch(URL_SCRIPT + '?pin=' + encodeURIComponent(pin) + '&t=' + Date.now(), { redirect: 'follow' });
    } else {
      resp = await fetch(URL_SCRIPT, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ pin: pin }, cuerpo))
      });
    }
    if (!resp.ok) throw new Error('El servidor respondió con error ' + resp.status);
    const datos = await resp.json();
    if (!datos.ok) {
      const err = new Error(datos.error || 'Error desconocido');
      err.pin = datos.error === 'PIN incorrecto';
      throw err;
    }
    return datos;
  }

  function pedirPrueba(metodo, cuerpo) {
    let regs = leerLS(CLAVE_DEMO, []);
    if (metodo === 'POST') {
      if (cuerpo.accion === 'guardar') {
        regs = regs.filter(function (r) { return r.id !== cuerpo.registro.id; });
        regs.push(cuerpo.registro);
      } else if (cuerpo.accion === 'borrar') {
        regs = regs.filter(function (r) { return r.id !== cuerpo.id; });
      }
      guardarLS(CLAVE_DEMO, regs);
    }
    return Promise.resolve({ ok: true, registros: regs, config: null, festivos: null });
  }

  function normHora(v) {
    const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
    return m ? m[1].padStart(2, '0') + ':' + m[2] : '';
  }
  function normFecha(v) {
    const t = String(v || '');
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return '';
  }

  function aplicarDatos(datos) {
    if (datos.config && Object.keys(datos.config).length) estado.cfg = Object.assign({}, Calculo.PREDETERMINADO, datos.config);
    if (datos.festivos && datos.festivos.length) estado.festivos = new Set(datos.festivos);
    if (datos.registros) {
      estado.registros = datos.registros.map(function (r) {
        return { id: String(r.id), fecha: normFecha(r.fecha), entrada: normHora(r.entrada), salida: normHora(r.salida), descanso: Number(r.descanso) || 0, notas: r.notas || '' };
      }).filter(function (r) { return r.fecha && r.entrada && r.salida; });
    }
    guardarLS(CLAVE_CACHE, { cfg: estado.cfg, festivos: Array.from(estado.festivos), registros: estado.registros });
  }

  async function cargar(silencioso) {
    if (!silencioso) mostrarCarga(true);
    try {
      aplicarDatos(await pedir('GET'));
      pintar();
      return true;
    } catch (e) {
      if (e.pin) { borrarLS(CLAVE_PIN); mostrarPin('PIN incorrecto. Intente de nuevo.'); return false; }
      aviso('No se pudo conectar. Revise el internet.');
      return false;
    } finally {
      mostrarCarga(false);
    }
  }

  /* ---------- Interfaz ---------- */
  function mostrarCarga(si) { $('cargando').hidden = !si; }
  let temporizador;
  function aviso(texto) {
    const t = $('toast'); t.textContent = texto; t.classList.add('visible');
    clearTimeout(temporizador); temporizador = setTimeout(function () { t.classList.remove('visible'); }, 2800);
  }

  function mostrarPin(error) {
    $('app').hidden = true; $('pantalla-pin').hidden = false;
    $('pin-error').textContent = error || ''; $('pin').value = ''; $('pin').focus();
  }
  function mostrarApp() {
    $('pantalla-pin').hidden = true; $('app').hidden = false;
  }

  function calcularRegistro(r) { return Calculo.calcular(r, estado.cfg, estado.festivos); }

  function horasSemana() {
    const mapa = {};
    estado.registros.forEach(function (r) {
      const c = calcularRegistro(r); const k = lunesDe(r.fecha);
      mapa[k] = (mapa[k] || 0) + c.ordDiu + c.ordNoc;
    });
    return mapa;
  }

  function pintar() {
    $('valor-hora').textContent = moneda.format(Calculo.valorHora(estado.cfg));
    const r = rangoPeriodo();
    $('periodo-titulo').textContent = tituloPeriodo(r);
    document.querySelectorAll('.segmento button').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.modo === estado.modo);
      b.setAttribute('aria-selected', b.dataset.modo === estado.modo);
    });

    const enPeriodo = estado.registros
      .filter(function (x) { return x.fecha >= r.desde && x.fecha <= r.hasta; })
      .sort(function (a, b) { return (b.fecha + b.entrada).localeCompare(a.fecha + a.entrada); });

    const semanas = horasSemana();
    let total = 0, horas = 0, extra = 0, dom = 0;
    const dias = new Set();
    const lista = $('lista'); lista.innerHTML = '';

    enPeriodo.forEach(function (reg) {
      const c = calcularRegistro(reg);
      total += c.total; horas += c.horas; extra += c.extraDiu + c.extraNoc;
      if (c.tipo !== 'Ordinario') dom += c.horas;
      if (c.horas > 0) dias.add(reg.fecha);

      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML =
        '<span class="dia"></span><span class="total"></span>' +
        '<span class="horario"></span><span class="horario" style="text-align:right"></span>' +
        '<span class="etiquetas"></span>';
      const sp = b.querySelectorAll('span');
      sp[0].textContent = diaTexto(reg.fecha);
      sp[1].textContent = moneda.format(c.total);
      sp[2].textContent = hora12(reg.entrada) + ' – ' + hora12(reg.salida);
      sp[3].textContent = horasTexto(c.horas);
      const etq = sp[4];
      const extraH = c.extraDiu + c.extraNoc;
      if (extraH > 0) agregarEtq(etq, horasTexto(extraH) + ' extra', 'etq--extra');
      if (c.ordNoc > 0) agregarEtq(etq, horasTexto(c.ordNoc) + ' nocturnas', '');
      if (c.tipo !== 'Ordinario') agregarEtq(etq, c.tipo, 'etq--dom');
      if ((semanas[lunesDe(reg.fecha)] || 0) > estado.cfg.jornadaSemanal + 1e-9) agregarEtq(etq, 'Semana de más de ' + estado.cfg.jornadaSemanal + ' h', 'etq--semana');
      if (reg.notas) agregarEtq(etq, reg.notas, '');
      if (!etq.childNodes.length) etq.remove();
      b.addEventListener('click', function () { editar(reg.id); });
      li.appendChild(b); lista.appendChild(li);
    });

    $('lista-vacia').hidden = enPeriodo.length > 0;
    // Si este período está vacío, ofrecer ir al último período con días guardados
    const ir = $('ir-ultimo');
    const anteriores = estado.registros.filter(function (x) { return x.fecha < r.desde; })
      .sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
    if (!enPeriodo.length && anteriores.length) {
      ir.hidden = false;
      ir.textContent = 'Ver días anteriores (último: ' + diaTexto(anteriores[0].fecha) + ')';
      ir.onclick = function () { estado.ref = anteriores[0].fecha; pintar(); };
    } else {
      ir.hidden = true;
    }
    $('res-total').textContent = moneda.format(total);
    $('res-dias').textContent = dias.size;
    $('res-horas').textContent = redondear(horas);
    $('res-extra').textContent = redondear(extra);
    $('res-dom').textContent = redondear(dom);
  }
  function redondear(h) { return (Math.round(h * 10) / 10).toLocaleString('es-CO'); }
  function agregarEtq(cont, texto, clase) {
    const s = document.createElement('span'); s.className = 'etq ' + clase; s.textContent = texto; cont.appendChild(s);
  }

  /* ---------- Formulario ---------- */
  function leerForm() {
    return {
      id: estado.editId || ('r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      fecha: $('f-fecha').value,
      entrada: $('f-entrada').value,
      salida: $('f-salida').value,
      descanso: Number($('f-descanso').value) || 0,
      notas: $('f-notas').value.trim()
    };
  }

  function validarForm(r) {
    if (!r.fecha) return 'Escriba la fecha.';
    if (!r.entrada || !r.salida) return 'Escriba la hora de entrada y de salida.';
    if (r.entrada === r.salida) return 'La hora de salida no puede ser igual a la de entrada.';
    const c = calcularRegistro(r);
    if (c.horas <= 0) return 'El descanso es mayor que el tiempo trabajado.';
    if (c.horas > 16) return 'Son más de 16 horas. Revise las horas de entrada y salida.';
    const choque = estado.registros.find(function (x) { return x.fecha === r.fecha && x.id !== r.id && x.entrada === r.entrada; });
    if (choque) return 'Ya hay un registro ese día con la misma hora de entrada.';
    return '';
  }

  function vistaPrevia() {
    const r = leerForm(); const caja = $('vista-previa');
    if (!r.fecha || !r.entrada || !r.salida || r.entrada === r.salida) { caja.classList.remove('visible'); return; }
    const c = calcularRegistro(r);
    if (c.horas <= 0) { caja.classList.remove('visible'); return; }
    const partes = [];
    if (c.ordDiu) partes.push(horasTexto(c.ordDiu) + ' diurnas');
    if (c.ordNoc) partes.push(horasTexto(c.ordNoc) + ' nocturnas');
    if (c.extraDiu) partes.push(horasTexto(c.extraDiu) + ' extra diurnas');
    if (c.extraNoc) partes.push(horasTexto(c.extraNoc) + ' extra nocturnas');
    caja.innerHTML = '';
    const linea = document.createElement('div');
    linea.innerHTML = '<strong></strong> · <span></span>';
    linea.querySelector('strong').textContent = moneda.format(c.total);
    linea.querySelector('span').textContent = horasTexto(c.horas) + ' trabajadas' + (c.tipo !== 'Ordinario' ? ' · ' + c.tipo : '');
    const det = document.createElement('div'); det.className = 'detalle'; det.textContent = partes.join(' · ');
    caja.appendChild(linea); caja.appendChild(det);
    caja.classList.add('visible');
  }

  // Valores que se ponen solos en el formulario (los más comunes)
  const ENTRADA_FIJA = '07:00';
  const SALIDA_FIJA = '17:00';
  const DESCANSO_FIJO = '0';
  function ponerValoresFijos() {
    $('f-entrada').value = ENTRADA_FIJA;
    $('f-salida').value = SALIDA_FIJA;
    $('f-descanso').value = DESCANSO_FIJO;
  }

  function limpiarForm(mantenerFecha) {
    ponerValoresFijos();
    estado.editId = null;
    if (!mantenerFecha) $('f-fecha').value = hoyISO();
    $('f-notas').value = '';
    $('form-titulo').textContent = 'Registrar un día';
    $('btn-guardar').textContent = 'Guardar';
    $('btn-cancelar').hidden = true; $('btn-borrar').hidden = true;
    document.querySelector('.acciones').classList.remove('editando');
    $('form-error').textContent = '';
    vistaPrevia();
  }

  function editar(id) {
    const r = estado.registros.find(function (x) { return x.id === id; });
    if (!r) return;
    estado.editId = id;
    $('f-fecha').value = r.fecha; $('f-entrada').value = r.entrada; $('f-salida').value = r.salida;
    const sel = $('f-descanso');
    if (!Array.from(sel.options).some(function (o) { return Number(o.value) === r.descanso; })) {
      const o = document.createElement('option'); o.value = r.descanso; o.textContent = r.descanso + ' minutos'; sel.appendChild(o);
    }
    sel.value = String(r.descanso);
    $('f-notas').value = r.notas || '';
    $('form-titulo').textContent = 'Corregir: ' + diaTexto(r.fecha);
    $('btn-guardar').textContent = 'Guardar cambios';
    $('btn-cancelar').hidden = false; $('btn-borrar').hidden = false;
    document.querySelector('.acciones').classList.add('editando');
    $('form-error').textContent = '';
    vistaPrevia();
    $('form-titulo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function guardar(ev) {
    ev.preventDefault();
    const r = leerForm();
    const error = validarForm(r);
    $('form-error').textContent = error;
    if (error) return;
    const registro = Object.assign({}, r, { calculo: calcularRegistro(r) });
    const btn = $('btn-guardar'); btn.disabled = true; mostrarCarga(true);
    try {
      aplicarDatos(await pedir('POST', { accion: 'guardar', registro: registro }));
      const eraEdicion = !!estado.editId;
      // Ir al período del día guardado
      estado.ref = r.fecha;
      limpiarForm(true);
      pintar();
      aviso(eraEdicion ? 'Cambios guardados' : 'Día guardado');
    } catch (e) {
      if (e.pin) { borrarLS(CLAVE_PIN); mostrarPin('El PIN cambió. Escríbalo de nuevo.'); }
      else $('form-error').textContent = 'No se pudo guardar. Revise el internet e intente de nuevo.';
    } finally {
      btn.disabled = false; mostrarCarga(false);
    }
  }

  async function borrar() {
    if (!estado.editId) return;
    if (!confirm('¿Borrar este día? Esta acción no se puede deshacer.')) return;
    mostrarCarga(true);
    try {
      aplicarDatos(await pedir('POST', { accion: 'borrar', id: estado.editId }));
      limpiarForm(); pintar(); aviso('Día borrado');
    } catch (e) {
      $('form-error').textContent = 'No se pudo borrar. Intente de nuevo.';
    } finally {
      mostrarCarga(false);
    }
  }

  /* ---------- Reporte ---------- */
  async function descargarReporte(ev) {
    const formato = ev && ev.currentTarget && ev.currentTarget.id === 'btn-pdf' ? 'pdf' : 'excel';
    const r = rangoPeriodo();
    const semanas = horasSemana();
    const filas = estado.registros
      .filter(function (x) { return x.fecha >= r.desde && x.fecha <= r.hasta; })
      .sort(function (a, b) { return (a.fecha + a.entrada).localeCompare(b.fecha + b.entrada); })
      .map(function (reg) {
        const dia = aFecha(reg.fecha).toLocaleDateString('es-CO', { weekday: 'long' });
        return {
          fecha: reg.fecha,
          dia: dia.charAt(0).toUpperCase() + dia.slice(1),
          entradaTexto: hora12(reg.entrada),
          salidaTexto: hora12(reg.salida),
          descanso: reg.descanso,
          notas: reg.notas,
          c: calcularRegistro(reg),
          semana42: (semanas[lunesDe(reg.fecha)] || 0) > estado.cfg.jornadaSemanal + 1e-9
        };
      });
    if (!filas.length) { aviso('No hay días en este período para el reporte.'); return; }
    const btn = $(formato === 'pdf' ? 'btn-pdf' : 'btn-reporte'); btn.disabled = true; mostrarCarga(true);
    try {
      await Reporte[formato === 'pdf' ? 'descargarPDF' : 'descargar']({
        titulo: tituloPeriodo(r), desde: r.desde, hasta: r.hasta,
        cfg: estado.cfg, valorHora: Calculo.valorHora(estado.cfg), filas: filas
      });
      aviso('Reporte descargado');
    } catch (e) {
      aviso('No se pudo crear el reporte. Revise el internet.');
    } finally {
      btn.disabled = false; mostrarCarga(false);
    }
  }

  /* ---------- Inicio ---------- */
  function iniciar() {
    if (CONF.TITULO) { $('titulo').textContent = CONF.TITULO; document.title = CONF.TITULO; }
    $('aviso-prueba').hidden = !MODO_PRUEBA;

    $('form-pin').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      const pin = $('pin').value.trim();
      if (!pin) return;
      guardarLS(CLAVE_PIN, pin);
      mostrarApp();
      await cargar();
    });
    $('form-registro').addEventListener('submit', guardar);
    ['f-fecha', 'f-entrada', 'f-salida', 'f-descanso'].forEach(function (id) {
      $(id).addEventListener('input', function () { $('form-error').textContent = ''; vistaPrevia(); });
    });
    $('btn-cancelar').addEventListener('click', function () { limpiarForm(); });
    $('btn-borrar').addEventListener('click', borrar);
    $('periodo-ant').addEventListener('click', function () { moverPeriodo(-1); });
    $('periodo-sig').addEventListener('click', function () { moverPeriodo(1); });
    document.querySelectorAll('.segmento button').forEach(function (b) {
      b.addEventListener('click', function () { estado.modo = b.dataset.modo; pintar(); });
    });
    $('btn-reporte').addEventListener('click', descargarReporte);
    $('btn-pdf').addEventListener('click', descargarReporte);
    $('btn-actualizar').addEventListener('click', function () { cargar().then(function (ok) { if (ok) aviso('Actualizado'); }); });
    $('btn-salir').addEventListener('click', function () {
      if (!confirm('¿Cerrar sesión en este teléfono? Sus datos quedan guardados en Google.')) return;
      borrarLS(CLAVE_PIN); borrarLS(CLAVE_CACHE); mostrarPin();
    });

    $('f-fecha').value = hoyISO();
    ponerValoresFijos();

    // Mostrar lo último guardado mientras carga
    const cache = leerLS(CLAVE_CACHE, null);
    if (cache && !MODO_PRUEBA) aplicarDatos(cache);

    if (MODO_PRUEBA) {
      $('btn-salir').hidden = true;
      mostrarApp(); cargar(true); vistaPrevia(); return;
    }
    if (!leerLS(CLAVE_PIN, '')) { mostrarPin(); return; }
    mostrarApp(); pintar(); vistaPrevia(); cargar(!!cache);
  }

  iniciar();
})();

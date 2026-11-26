/* Cálculo de horas y pago — legislación laboral colombiana 2026.
   Funciona en el navegador (window.Calculo) y en Node (module.exports). */
(function (raiz) {
  const PREDETERMINADO = {
    salario: 1750905,      // Salario mínimo 2026
    horasMes: 210,         // Jornada de 42 h semanales (desde 15-jul-2026)
    jornadaDiaria: 8,      // Más de esto en un día = hora extra
    jornadaSemanal: 42,
    recargoNocturno: 0.35,
    recargoDominical: 0.90,
    extraDiurna: 0.25,
    extraNocturna: 0.75,
    inicioNoche: 19,       // 7:00 p.m.
    finNoche: 6            // 6:00 a.m.
  };

  function aMinutos(hhmm) {
    const p = String(hhmm).split(':');
    return Number(p[0]) * 60 + Number(p[1]);
  }

  function esNoche(minutoDelDia, cfg) {
    const h = minutoDelDia / 60;
    return cfg.inicioNoche > cfg.finNoche
      ? (h >= cfg.inicioNoche || h < cfg.finNoche)
      : (h >= cfg.inicioNoche && h < cfg.finNoche);
  }

  // Jornada por día de la semana: si en la hoja Configuracion existe, por ejemplo,
  // "jornadaViernes = 8.5", ese día se usa ese valor; si no, se usa jornadaDiaria.
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const DIAS_TEXTO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function jornadaDelDia(fecha, cfg) {
    const dia = new Date(fecha + 'T12:00:00').getDay();
    const v = Number(cfg['jornada' + DIAS[dia]]);
    return v > 0 ? v : cfg.jornadaDiaria;
  }

  /** Texto como "9 h al día (viernes: 8,5 h)" para notas y reportes. */
  function descripcionJornada(cfgEntrada) {
    const cfg = Object.assign({}, PREDETERMINADO, cfgEntrada || {});
    const num = function (n) { return String(Math.round(n * 100) / 100).replace('.', ','); };
    const especiales = [];
    for (let i = 1; i <= 7; i++) {
      const d = i % 7, v = Number(cfg['jornada' + DIAS[d]]);
      if (v > 0 && v !== cfg.jornadaDiaria) especiales.push(DIAS_TEXTO[d] + ': ' + num(v) + ' h');
    }
    return num(cfg.jornadaDiaria) + ' h al día' + (especiales.length ? ' (' + especiales.join(', ') + ')' : '');
  }

  function tipoDeDia(fecha, festivos) {
    if (festivos && festivos.has(fecha)) return 'Festivo';
    const d = new Date(fecha + 'T12:00:00');
    return d.getDay() === 0 ? 'Domingo' : 'Ordinario';
  }

  /** Calcula horas y pago de un turno.
   *  r = { fecha:'2026-10-05', entrada:'08:00', salida:'17:00', descanso:60 } */
  function calcular(r, cfgEntrada, festivos) {
    const cfg = Object.assign({}, PREDETERMINADO, cfgEntrada || {});
    const ini = aMinutos(r.entrada);
    let fin = aMinutos(r.salida);
    if (fin <= ini) fin += 1440; // salió después de medianoche

    const trabajados = Math.max(0, fin - ini - (Number(r.descanso) || 0));
    const jornada = jornadaDelDia(r.fecha, cfg);
    const extra = Math.max(0, trabajados - Math.round(jornada * 60));

    // Las horas extra son las últimas del turno
    let nocheTotal = 0, nocheExtra = 0;
    for (let m = ini; m < fin; m++) {
      if (esNoche(m % 1440, cfg)) {
        nocheTotal++;
        if (m >= fin - extra) nocheExtra++;
      }
    }
    nocheExtra = Math.min(nocheExtra, extra);
    const extraDiu = extra - nocheExtra;
    const ordNoc = Math.max(0, Math.min(Math.min(nocheTotal, trabajados) - nocheExtra, trabajados - extra));
    const ordDiu = trabajados - extra - ordNoc;

    const tipo = tipoDeDia(r.fecha, festivos);
    const dom = tipo === 'Ordinario' ? 0 : cfg.recargoDominical;
    const vh = cfg.salario / cfg.horasMes;
    const h = function (min) { return min / 60; };

    const pagoOrd = Math.round(h(ordDiu) * vh * (1 + dom) + h(ordNoc) * vh * (1 + cfg.recargoNocturno + dom));
    const pagoExtra = Math.round(h(extraDiu) * vh * (1 + cfg.extraDiurna + dom) + h(nocheExtra) * vh * (1 + cfg.extraNocturna + dom));

    return {
      tipo: tipo,
      horas: h(trabajados),
      ordDiu: h(ordDiu), ordNoc: h(ordNoc),
      extraDiu: h(extraDiu), extraNoc: h(nocheExtra),
      pagoOrd: pagoOrd, pagoExtra: pagoExtra, total: pagoOrd + pagoExtra
    };
  }

  function valorHora(cfg) {
    const c = Object.assign({}, PREDETERMINADO, cfg || {});
    return c.salario / c.horasMes;
  }

  const api = { PREDETERMINADO: PREDETERMINADO, calcular: calcular, valorHora: valorHora, tipoDeDia: tipoDeDia, jornadaDelDia: jornadaDelDia, descripcionJornada: descripcionJornada };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Calculo = api;
})(this);

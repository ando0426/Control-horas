/* Reporte en Excel para comparar con lo que reporta la empresa.
   Usa ExcelJS, que se descarga solo cuando se presiona el botón. */
(function () {
  'use strict';

  const URL_EXCELJS = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  let cargaLib = null;

  function cargarExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (cargaLib) return cargaLib;
    cargaLib = new Promise(function (ok, falla) {
      const s = document.createElement('script');
      s.src = URL_EXCELJS;
      s.onload = function () { window.ExcelJS ? ok(window.ExcelJS) : falla(new Error('No cargó ExcelJS')); };
      s.onerror = function () { cargaLib = null; falla(new Error('Sin conexión para generar el Excel')); };
      document.head.appendChild(s);
    });
    return cargaLib;
  }

  const AZUL = 'FF1F4E78', AMARILLO = 'FFFFF2CC', GRIS = 'FFF2F2F2', VERDE = 'FFE2EFDA';
  const MONEDA = '"$"#,##0;[Red]-"$"#,##0;"-"';
  const HORAS = '0.00;[Red]-0.00;"-"';
  const borde = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  const BORDES = { top: borde, left: borde, bottom: borde, right: borde };

  function aFechaExcel(iso) {
    const p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }

  /**
   * datos = {
   *   titulo: '16 – 31 oct 2026', desde: '2026-10-16', hasta: '2026-10-31',
   *   cfg: {...}, valorHora: 8337.64,
   *   filas: [{ fecha, dia, entrada, salida, descanso, notas, c: {tipo, horas, ordDiu, ordNoc, extraDiu, extraNoc, pagoOrd, pagoExtra, total}, semana42: bool }]
   * }
   */
  async function descargar(datos) {
    const ExcelJS = await cargarExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Mis horas de trabajo';
    wb.created = new Date();

    const ws = wb.addWorksheet('Comparativo', {
      views: [{ state: 'frozen', ySplit: 12 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
    });
    const fuente = { name: 'Arial', size: 10 };

    // ---- Encabezado ----
    ws.getCell('A1').value = 'Reporte de horas trabajadas';
    ws.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: AZUL } };
    ws.getCell('A2').value = 'Período: ' + datos.titulo;
    ws.getCell('A2').font = { name: 'Arial', size: 11, bold: true };
    ws.getCell('A3').value = 'Generado: ' + new Date().toLocaleDateString('es-CO') +
      ' · Valor hora ordinaria: $' + Math.round(datos.valorHora).toLocaleString('es-CO') +
      ' (salario $' + Math.round(datos.cfg.salario).toLocaleString('es-CO') + ' ÷ ' + datos.cfg.horasMes + ' h).';
    ws.getCell('A3').font = { name: 'Arial', size: 9, color: { argb: 'FF595959' } };
    ws.getCell('A4').value = 'Escriba en las columnas amarillas lo que reportó o pagó la empresa. La diferencia se calcula sola: positiva = la empresa le debe; negativa = la empresa reportó de más.';
    ws.getCell('A4').font = { name: 'Arial', size: 9, italic: true };

    // ---- Resumen (filas 6 a 10) ----
    const PRIMERA = 13;
    const ultima = PRIMERA + Math.max(datos.filas.length, 1) - 1;
    const rango = function (col) { return col + PRIMERA + ':' + col + ultima; };
    ws.getCell('A6').value = 'Resumen'; ws.getCell('A6').font = { name: 'Arial', size: 11, bold: true };
    const resumen = [
      ['', 'Mis registros', 'Según la empresa', 'Diferencia'],
      ['Días trabajados', { formula: 'COUNTIF(' + rango('G') + ',">0")' }, { formula: 'COUNTIF(' + rango('O') + ',">0")' }, { formula: 'B8-C8' }],
      ['Horas trabajadas', { formula: 'SUM(' + rango('G') + ')' }, { formula: 'SUM(' + rango('O') + ')' }, { formula: 'B9-C9' }],
      ['Horas extra', { formula: 'SUM(' + rango('J') + ')+SUM(' + rango('K') + ')' }, '', ''],
      ['Total a recibir', { formula: 'SUM(' + rango('N') + ')' }, { formula: 'SUM(' + rango('P') + ')' }, { formula: 'B11-C11' }]
    ];
    resumen.forEach(function (fila, i) {
      const r = ws.getRow(7 + i);
      fila.forEach(function (v, j) {
        const cel = r.getCell(1 + j);
        cel.value = v;
        cel.font = Object.assign({}, fuente, { bold: i === 0 || j === 0 });
        cel.border = BORDES;
        if (i === 0) { cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }; cel.alignment = { horizontal: 'center' }; }
        if (i > 0 && j > 0) cel.numFmt = i === 4 ? MONEDA : (i === 1 ? '0;[Red]-0;"-"' : HORAS);
      });
    });
    ws.getCell('B11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    ws.getCell('B11').font = Object.assign({}, fuente, { bold: true });
    ws.getCell('D11').font = Object.assign({}, fuente, { bold: true });

    // ---- Tabla de días ----
    const encabezados = [
      'Fecha', 'Día', 'Entrada', 'Salida', 'Descanso (min)', 'Tipo de día',
      'Horas trabajadas', 'Ordinarias diurnas', 'Ordinarias nocturnas', 'Extra diurnas', 'Extra nocturnas',
      'Pago ordinario', 'Pago extra', 'Total (mis cálculos)',
      'Horas según empresa', 'Pago según empresa', 'Diferencia horas', 'Diferencia pago', 'Observaciones'
    ];
    const enc = ws.getRow(12);
    encabezados.forEach(function (t, j) {
      const cel = enc.getCell(1 + j);
      cel.value = t;
      cel.font = { name: 'Arial', size: 10, bold: true, color: { argb: j === 14 || j === 15 ? 'FF000000' : 'FFFFFFFF' } };
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: j === 14 || j === 15 ? 'FFFFD966' : AZUL } };
      cel.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cel.border = BORDES;
    });
    enc.height = 32;

    datos.filas.forEach(function (f, i) {
      const n = PRIMERA + i;
      const r = ws.getRow(n);
      const obs = [];
      if (f.semana42) obs.push('Semana de más de ' + datos.cfg.jornadaSemanal + ' h');
      if (f.notas) obs.push(f.notas);
      const valores = [
        aFechaExcel(f.fecha), f.dia, f.entradaTexto, f.salidaTexto, f.descanso, f.c.tipo,
        f.c.horas, f.c.ordDiu, f.c.ordNoc, f.c.extraDiu, f.c.extraNoc,
        f.c.pagoOrd, f.c.pagoExtra, { formula: 'L' + n + '+M' + n, result: f.c.total },
        null, null,
        { formula: 'IF(O' + n + '="","",G' + n + '-O' + n + ')' },
        { formula: 'IF(P' + n + '="","",N' + n + '-P' + n + ')' },
        obs.join(' · ')
      ];
      const formatos = ['dd/mm/yyyy', null, null, null, '0', null, HORAS, HORAS, HORAS, HORAS, HORAS, MONEDA, MONEDA, MONEDA, HORAS, MONEDA, HORAS, MONEDA, null];
      valores.forEach(function (v, j) {
        const cel = r.getCell(1 + j);
        cel.value = v;
        cel.font = Object.assign({}, fuente, { bold: j === 13 });
        cel.border = BORDES;
        if (formatos[j]) cel.numFmt = formatos[j];
        if (j === 14 || j === 15) cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } };
        if (j === 5 && f.c.tipo !== 'Ordinario') cel.font = Object.assign({}, fuente, { bold: true, color: { argb: 'FF7030A0' } });
        if ((j === 9 || j === 10) && v > 0) cel.font = Object.assign({}, fuente, { bold: true, color: { argb: 'FFC55A11' } });
      });
    });

    // ---- Fila de totales ----
    const nt = ultima + 1;
    const rt = ws.getRow(nt);
    rt.getCell(1).value = 'TOTAL';
    ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'].forEach(function (col) {
      const cel = ws.getCell(col + nt);
      cel.value = { formula: 'SUM(' + rango(col) + ')' };
      cel.numFmt = 'LMNPR'.indexOf(col) >= 0 ? MONEDA : HORAS;
    });
    for (let j = 1; j <= encabezados.length; j++) {
      const cel = rt.getCell(j);
      cel.font = Object.assign({}, fuente, { bold: true });
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
      cel.border = BORDES;
    }

    // ---- Notas al pie ----
    const pie = [
      'Cómo se calculó:',
      '• Hora ordinaria = salario mínimo ÷ ' + datos.cfg.horasMes + ' horas al mes.',
      '• Hora extra: lo que pase de ' + datos.cfg.jornadaDiaria + ' horas en el día (+' + Math.round(datos.cfg.extraDiurna * 100) + '% de día, +' + Math.round(datos.cfg.extraNocturna * 100) + '% de noche).',
      '• Recargo nocturno +' + Math.round(datos.cfg.recargoNocturno * 100) + '% (de ' + datos.cfg.inicioNoche + ':00 a ' + datos.cfg.finNoche + ':00). Domingo o festivo +' + Math.round(datos.cfg.recargoDominical * 100) + '%.',
      '• No incluye auxilio de transporte ni prestaciones (prima, cesantías, vacaciones).'
    ];
    pie.forEach(function (t, i) {
      const cel = ws.getCell('A' + (nt + 2 + i));
      cel.value = t;
      cel.font = { name: 'Arial', size: 9, bold: i === 0, color: { argb: 'FF595959' } };
    });

    const anchos = [16, 14, 16, 13, 10, 11, 10, 10, 10, 10, 10, 13, 12, 14, 12, 14, 11, 13, 32];
    anchos.forEach(function (w, j) { ws.getColumn(1 + j).width = w; });
    ws.getColumn(1).width = Math.max(18, anchos[0]);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const nombre = 'Reporte_horas_' + datos.desde + '_a_' + datos.hasta + '.xlsx';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return nombre;
  }

  /* ---------- PDF básico ---------- */
  const URL_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const URL_AUTOTABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
  const cargados = {};
  function cargarScript(url) {
    if (cargados[url]) return cargados[url];
    cargados[url] = new Promise(function (ok, falla) {
      const s = document.createElement('script');
      s.src = url;
      s.onload = function () { ok(); };
      s.onerror = function () { delete cargados[url]; falla(new Error('Sin conexión para generar el PDF')); };
      document.head.appendChild(s);
    });
    return cargados[url];
  }

  // Las fuentes básicas del PDF no tienen algunos símbolos: se cambian por equivalentes
  function limpio(t) {
    return String(t == null ? '' : t).replace(/[–—]/g, '-').replace(/[  ]/g, ' ');
  }
  function plata(n) { return '$ ' + Math.round(n).toLocaleString('es-CO'); }
  function hrs(n) {
    const t = Math.round(n * 60), h = Math.floor(t / 60), m = t % 60;
    return m ? h + ' h ' + m + ' min' : h + ' h';
  }
  function fechaCorta(iso) { const p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  async function descargarPDF(datos) {
    if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript(URL_JSPDF);
    await cargarScript(URL_AUTOTABLE);
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter' });
    const ancho = doc.internal.pageSize.getWidth();
    const M = 15;

    // Encabezado
    doc.setFillColor(31, 78, 120); doc.rect(0, 0, ancho, 26, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text('Reporte de horas trabajadas', M, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(limpio('Período: ' + datos.titulo), M, 20);
    doc.setFontSize(8);
    doc.text(limpio('Generado: ' + new Date().toLocaleDateString('es-CO')), ancho - M, 20, { align: 'right' });

    // Totales
    let dias = new Set(), horas = 0, extra = 0, total = 0;
    datos.filas.forEach(function (f) {
      if (f.c.horas > 0) dias.add(f.fecha);
      horas += f.c.horas; extra += f.c.extraDiu + f.c.extraNoc; total += f.c.total;
    });
    const cajas = [['Días trabajados', String(dias.size)], ['Horas trabajadas', hrs(horas)], ['Horas extra', hrs(extra)], ['Total a recibir', plata(total)]];
    const anchoCaja = (ancho - 2 * M - 3 * 4) / 4;
    cajas.forEach(function (c, i) {
      const x = M + i * (anchoCaja + 4), y = 33;
      doc.setDrawColor(210); doc.setFillColor(i === 3 ? 226 : 245, i === 3 ? 239 : 245, i === 3 ? 218 : 245);
      doc.roundedRect(x, y, anchoCaja, 18, 2, 2, 'FD');
      doc.setTextColor(90); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text(c[0], x + anchoCaja / 2, y + 6, { align: 'center' });
      doc.setTextColor(i === 3 ? 46 : 29, i === 3 ? 125 : 36, i === 3 ? 79 : 48);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text(limpio(c[1]), x + anchoCaja / 2, y + 14, { align: 'center' });
    });

    // Tabla
    const cuerpo = datos.filas.map(function (f) {
      const ex = f.c.extraDiu + f.c.extraNoc;
      return [
        fechaCorta(f.fecha), f.dia, limpio(f.entradaTexto), limpio(f.salidaTexto),
        f.descanso ? f.descanso + ' min' : '-', hrs(f.c.horas), ex ? hrs(ex) : '-',
        f.c.tipo === 'Ordinario' ? '' : f.c.tipo, plata(f.c.total)
      ];
    });
    doc.autoTable({
      startY: 58,
      margin: { left: M, right: M },
      head: [['Fecha', 'Día', 'Entrada', 'Salida', 'Descanso', 'Horas', 'Extra', 'Tipo', 'Total']],
      body: cuerpo,
      foot: [['TOTAL', '', '', '', '', hrs(horas), extra ? hrs(extra) : '-', '', plata(total)]],
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, textColor: 30 },
      headStyles: { fillColor: [31, 78, 120], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 8: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: function (d) {
        if (d.section === 'head' && (d.column.index === 5 || d.column.index === 6 || d.column.index === 8)) d.cell.styles.halign = 'right';
        if (d.section === 'foot' && (d.column.index === 5 || d.column.index === 6 || d.column.index === 8)) d.cell.styles.halign = 'right';
        if (d.section === 'body' && d.column.index === 6 && d.cell.raw !== '-') d.cell.styles.textColor = [197, 90, 17];
        if (d.section === 'body' && d.column.index === 7 && d.cell.raw) d.cell.styles.textColor = [112, 48, 160];
      }
    });

    // Notas
    let y = doc.lastAutoTable.finalY + 8;
    const alto = doc.internal.pageSize.getHeight();
    const cfg = datos.cfg;
    const notas = [
      'Valor hora ordinaria: ' + plata(datos.valorHora) + ' (salario ' + plata(cfg.salario) + ' / ' + cfg.horasMes + ' h al mes).',
      'Hora extra: lo que pase de ' + cfg.jornadaDiaria + ' h en el día (+' + Math.round(cfg.extraDiurna * 100) + '% de día, +' + Math.round(cfg.extraNocturna * 100) + '% de noche).',
      'Recargo nocturno +' + Math.round(cfg.recargoNocturno * 100) + '% (7:00 p. m. a 6:00 a. m.). Domingo o festivo +' + Math.round(cfg.recargoDominical * 100) + '%.',
      'No incluye auxilio de transporte ni prestaciones (prima, cesantías, vacaciones).'
    ];
    if (y + notas.length * 5 > alto - 12) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100);
    notas.forEach(function (t, i) { doc.text(limpio(t), M, y + i * 4.5); });

    // Número de página
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
      doc.text('Página ' + i + ' de ' + n, ancho - M, alto - 8, { align: 'right' });
    }

    const nombre = 'Reporte_horas_' + datos.desde + '_a_' + datos.hasta + '.pdf';
    doc.save(nombre);
    return nombre;
  }

  window.Reporte = { descargar: descargar, descargarPDF: descargarPDF };
})();

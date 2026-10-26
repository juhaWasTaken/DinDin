/*
 * reportes.js — Análisis de tus movimientos por periodo:
 * totales con comparación contra el periodo anterior, gráfico de ingresos vs gastos,
 * gastos e ingresos por categoría, mayores gastos y observaciones automáticas.
 * Todo se calcula en Store.reporte(); aquí solo se dibuja.
 */
(function () {
    'use strict';

    var esc = Fmt.esc;
    var periodo = '6meses';
    var ultimo = null;           // último reporte dibujado (lo usan Exportar CSV e Imprimir)

    function $(id) { return document.getElementById(id); }

    /* ---------------- Piezas de dibujo ---------------- */
    function delta(valor, bueno) {
        // bueno: 'sube' (ingresos) o 'baja' (gastos)
        if (valor === null) return null;
        if (Math.abs(valor) < 0.05) return '<span class="delta">Igual</span> que el periodo anterior';
        var sube = valor > 0;
        var cls = (sube === (bueno === 'sube')) ? 'good' : 'bad';
        return '<span class="delta ' + cls + '">' + Fmt.percent(Math.abs(valor)) + (sube ? ' más' : ' menos') + '</span> que el periodo anterior';
    }

    function renderCards(r) {
        var t = r.totales, rot = esc(r.periodo.rotulo);
        $('r-ing').textContent = Fmt.money(t.ingresos);
        $('r-gas').textContent = Fmt.money(t.gastos);
        $('r-aho').textContent = Fmt.money(t.balance);
        $('r-ing-d').innerHTML = delta(r.deltaIngresos, 'sube') || rot;
        $('r-gas-d').innerHTML = delta(r.deltaGastos, 'baja') || rot;
        $('r-aho-d').textContent = r.tasaAhorro === null ? 'Sin ingresos en este periodo'
            : (t.balance < 0 ? 'Gastaste más de lo que ingresaste' : Fmt.percent(r.tasaAhorro) + ' de tus ingresos');
    }

    function renderGrafico(r) {
        var serie = r.serie, n = serie.length, max = 0;
        serie.forEach(function (s) { max = Math.max(max, s.ingresos, s.gastos); });
        var dense = n > 8;

        function barra(v, cls, nombre, titulo) {
            var h = v > 0 ? (v / max * 100).toFixed(1) : 0;
            return '<span' + (cls ? ' class="' + cls + '"' : '') + ' style="height:' + h + '%;min-height:' + (v > 0 ? 3 : 0) + 'px;" title="' +
                   esc(titulo + ' · ' + nombre + ': ' + Fmt.money(v)) + '"></span>';
        }
        var grupos = serie.map(function (s) {
            return '<div class="bar-group" role="img" aria-label="' + esc(s.titulo + ': ingresos ' + Fmt.money(s.ingresos) + ', gastos ' + Fmt.money(s.gastos)) + '">' +
                   barra(s.ingresos, '', 'Ingresos', s.titulo) + barra(s.gastos, 'alt', 'Gastos', s.titulo) + '</div>';
        }).join('');
        var cols = 'grid-template-columns:repeat(' + n + ',1fr)';
        var etiquetas = serie.map(function (s) { return '<span>' + esc(s.etiqueta) + '</span>'; }).join('');

        var filas = serie.map(function (s) {
            var bal = Fmt.money(s.ingresos - s.gastos);
            return '<tr><td>' + esc(s.titulo) + '</td><td>' + esc(Fmt.money(s.ingresos)) + '</td><td>' + esc(Fmt.money(s.gastos)) + '</td><td>' + esc(bal) + '</td></tr>';
        }).join('');

        $('r-chart').innerHTML =
            '<div class="chart-placeholder"><div class="chart-bars grouped' + (dense ? ' dense' : '') + '" style="' + cols + '">' + grupos + '</div>' +
            '<div class="chart-labels grouped" style="' + cols + '">' + etiquetas + '</div></div>' +
            '<details class="chart-table"><summary>Ver detalle</summary><table class="mini-table"><thead><tr>' +
            '<th>' + (r.periodo.n === 1 ? 'Semana' : 'Mes') + '</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead><tbody>' + filas + '</tbody></table></details>';

        $('r-chart-sub').textContent = (r.periodo.n === 1 ? 'Por semana · ' : 'Por mes · ') + r.periodo.rotulo;
    }

    function filaCategoria(emoji, nombre, sub, total, pct, cls) {
        return '<div class="budget-item"><div class="budget-item-header"><div class="budget-category">' +
               '<div class="budget-category-icon">' + esc(emoji) + '</div><div><strong>' + esc(nombre) + '</strong><span>' + esc(sub) + '</span></div></div>' +
               '<div class="budget-values"><strong>' + esc(Fmt.money(total)) + '</strong><span>' + Fmt.percent(pct) + '</span></div></div>' +
               '<div class="budget-progress"><span class="' + cls + '" style="width:' + Math.min(100, pct).toFixed(1) + '%;"></span></div></div>';
    }

    function listaCategorias(items, total, cls, vacio) {
        if (!items.length) return '<p class="side-empty">' + vacio + '</p>';
        var MAX = 6, mostrar = items.slice(0, items.length > MAX ? MAX - 1 : MAX);
        var html = mostrar.map(function (x) {
            return filaCategoria(x.categoria.emoji, x.categoria.nombre, x.movimientos + ' movimiento' + (x.movimientos === 1 ? '' : 's'), x.total, x.total / total * 100, cls);
        }).join('');
        if (items.length > MAX) {
            var resto = items.slice(MAX - 1), suma = 0, cuenta = 0;
            resto.forEach(function (x) { suma += x.total; cuenta += x.movimientos; });
            html += filaCategoria('📊', 'Otras categorías (' + resto.length + ')', cuenta + ' movimientos', suma, suma / total * 100, cls);
        }
        return html;
    }

    function renderCategorias(r) {
        var t = r.totales;
        $('r-cats').innerHTML = listaCategorias(r.gastosPorCategoria, t.gastos, 'progress-normal', 'No registraste gastos en este periodo.');
        $('r-cat-sub').textContent = t.gastos > 0 ? 'Distribución de los ' + Fmt.money(t.gastos) + ' gastados.' : 'Sin gastos en este periodo.';
        $('r-ing-cats').innerHTML = listaCategorias(r.ingresosPorCategoria, t.ingresos, 'progress-income', 'No registraste ingresos en este periodo.');
    }

    function renderTop(r) {
        var box = $('r-top');
        if (!r.mayoresGastos.length) { box.innerHTML = '<p class="side-empty">No registraste gastos en este periodo.</p>'; return; }
        box.innerHTML = r.mayoresGastos.map(function (m) {
            var c = Store.categorias.get(m.categoriaId) || { emoji: '📦', nombre: 'Otros' };
            return '<div class="transaction"><div class="transaction-icon expense">' + esc(c.emoji) + '</div>' +
                   '<div class="transaction-info"><strong>' + esc(m.descripcion) + '</strong><span>' + Fmt.date(m.fecha) + ' · ' + esc(c.nombre) + '</span></div>' +
                   '<strong class="transaction-amount">' + esc(Fmt.money(-m.monto)) + '</strong></div>';
        }).join('');
    }

    function renderObservaciones(r) {
        var t = r.totales, out = [];
        var top = r.gastosPorCategoria[0];
        if (top && t.gastos > 0) {
            out.push(['pie-chart', 'En «' + top.categoria.nombre + '» se fue el ' + Fmt.percent(top.total / t.gastos * 100) + ' de tus gastos (' + Fmt.money(top.total) + ').']);
        }
        if (r.tasaAhorro !== null) {
            out.push(['piggy-bank', t.balance < 0
                ? 'Gastaste ' + Fmt.money(-t.balance) + ' más de lo que ingresaste en este periodo.'
                : 'Ahorraste el ' + Fmt.percent(r.tasaAhorro) + ' de tus ingresos.' + (r.tasaAhorro < 20 ? ' Una meta habitual es llegar al 20%.' : ' ¡Buen ritmo!')]);
        }
        if (t.gastos > 0) {
            out.push(['calendar', r.periodo.n > 1 && r.promedioMensual !== null
                ? 'En promedio gastas ' + Fmt.money(r.promedioMensual) + ' al mes.'
                : 'En promedio gastas ' + Fmt.money(r.gastoDiario) + ' al día.']);
        }
        if (r.mayorMes && r.serie.length > 1) {
            out.push(['trending-up', 'Tu mes con más gastos fue ' + r.mayorMes.titulo + ' (' + Fmt.money(r.mayorMes.gastos) + ').']);
        } else if (r.mayoresGastos[0]) {
            var g = r.mayoresGastos[0];
            out.push(['trending-up', 'Tu gasto más grande fue «' + g.descripcion + '» por ' + Fmt.money(g.monto) + ' el ' + Fmt.dateShort(g.fecha) + '.']);
        }
        out = out.slice(0, 4);
        $('r-insights').innerHTML = out.length
            ? out.map(function (x) {
                return '<div class="budget-alert"><div class="alert-icon neutral" data-icon="' + x[0] + '"></div><div><p class="insight-text">' + esc(x[1]) + '</p></div></div>';
            }).join('')
            : '<p class="side-empty">Registra movimientos para ver observaciones.</p>';
    }

    /* ---------------- Render principal ---------------- */
    function render() {
        var r = Store.reporte(periodo);
        ultimo = r;
        var total = Store.counts().movimientos;
        var vacio = r.cantidad === 0;

        $('r-content').hidden = vacio;
        $('r-empty').hidden = !vacio;
        $('btn-exportar').disabled = vacio;
        $('btn-imprimir').disabled = vacio;

        if (vacio) {
            $('r-empty').innerHTML = total === 0
                ? UI.emptyState({
                    icon: 'bar-chart', title: 'Aún no hay nada que analizar',
                    text: 'Registra algunos ingresos y gastos y aquí verás tus reportes.',
                    actions: '<a class="primary-button" href="movimientos.html?nuevo=1"><span data-icon="plus"></span>Agregar movimiento</a>'
                })
                : UI.emptyState({
                    icon: 'search', title: 'No hay movimientos en este periodo',
                    text: 'Tienes movimientos en otras fechas. Prueba con un periodo más amplio.',
                    actions: '<button type="button" class="secondary-button inline" data-act="ver12">Ver últimos 12 meses</button>'
                });
            Icons.render($('r-empty'));
            return;
        }

        renderCards(r);
        renderGrafico(r);
        renderCategorias(r);
        renderTop(r);
        renderObservaciones(r);
        $('r-print').textContent = r.periodo.etiqueta + ' (' + r.periodo.rotulo + ') · Generado el ' + Fmt.date(Store.today());
        Icons.render($('r-content'));
    }

    /* ---------------- Exportar CSV ---------------- */
    function celda(v) {
        v = String(v == null ? '' : v);
        if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
        return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }

    function exportarCSV() {
        var r = ultimo;
        if (!r || !r.cantidad) return;
        var t = r.totales, f = function (n) { return n.toFixed(2); };
        var rows = [
            ['Reporte', r.periodo.etiqueta], ['Periodo', r.periodo.desde + ' a ' + r.periodo.hasta], [],
            ['Ingresos', f(t.ingresos)], ['Gastos', f(t.gastos)], ['Balance', f(t.balance)],
            ['Tasa de ahorro', r.tasaAhorro === null ? '' : Fmt.percent(r.tasaAhorro)], [],
            [r.periodo.n === 1 ? 'Semana' : 'Mes', 'Ingresos', 'Gastos', 'Balance']
        ];
        r.serie.forEach(function (s) { rows.push([s.titulo, f(s.ingresos), f(s.gastos), f(s.ingresos - s.gastos)]); });
        rows.push([], ['Gastos por categoría', 'Monto', '% del total', 'Movimientos']);
        r.gastosPorCategoria.forEach(function (x) { rows.push([x.categoria.nombre, f(x.total), Fmt.percent(x.total / t.gastos * 100), x.movimientos]); });
        rows.push([], ['Ingresos por categoría', 'Monto', '% del total', 'Movimientos']);
        r.ingresosPorCategoria.forEach(function (x) { rows.push([x.categoria.nombre, f(x.total), Fmt.percent(x.total / t.ingresos * 100), x.movimientos]); });

        var csv = '\uFEFF' + rows.map(function (row) { return row.map(celda).join(','); }).join('\r\n');
        var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        var a = document.createElement('a');
        a.href = url; a.download = 'reporte-' + r.periodo.clave + '-' + Store.today() + '.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        UI.toast('Reporte exportado.');
    }

    /* ---------------- Eventos ---------------- */
    var sel = $('r-periodo');
    sel.innerHTML = Store.PERIODOS_REPORTE.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join('');
    sel.value = periodo;
    sel.addEventListener('change', function () { periodo = sel.value; render(); });

    $('btn-exportar').addEventListener('click', exportarCSV);
    $('btn-imprimir').addEventListener('click', function () { window.print(); });

    // Al imprimir, el detalle del gráfico debe verse abierto.
    window.addEventListener('beforeprint', function () {
        Array.prototype.forEach.call(document.querySelectorAll('details'), function (d) { d.open = true; });
    });

    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-act="ver12"]')) { periodo = '12meses'; sel.value = periodo; render(); }
    });

    window.addEventListener('store:change', render);
    render();
})();

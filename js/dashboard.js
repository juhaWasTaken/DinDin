/*
 * dashboard.js — Todo el Dashboard se calcula a partir de Store.
 * No hay cifras escritas a mano: si cambias un movimiento, cambia aquí.
 */
(function () {
    'use strict';

    var esc = Fmt.esc;
    var periodo = 'mes';

    function $(id) { return document.getElementById(id); }

    /* ---------------- Saludo ---------------- */
    function renderSaludo() {
        var n = Store.settings.get().nombre;
        $('greeting').textContent = n ? 'Hola, ' + n.split(/\s+/)[0] : 'Bienvenido';
    }

    /* ---------------- Tarjetas ---------------- */
    function renderCards() {
        var r = Store.rango(periodo);
        var t = Store.totales(Store.movimientos.list({ desde: r.desde, hasta: r.hasta }));
        $('c-balance').textContent = Fmt.money(Store.balanceTotal());
        $('c-ingresos').textContent = Fmt.money(t.ingresos);
        $('c-gastos').textContent = Fmt.money(t.gastos);
        $('c-ahorrado').textContent = Fmt.money(Store.metas.totalAhorrado());
        $('d-ingresos').textContent = r.etiqueta;
        $('d-gastos').textContent = r.etiqueta;
    }

    /* ---------------- Gráfico: últimos 6 meses ---------------- */
    function renderChart() {
        var box = $('chart-box');
        var serie = Store.serieMensual(6);
        var max = 0;
        serie.forEach(function (s) { max = Math.max(max, s.ingresos, s.gastos); });

        if (max === 0) {
            box.innerHTML = UI.emptyState({
                icon: 'bar-chart', compact: true, title: 'Todavía no hay datos para graficar',
                text: 'Cuando registres ingresos y gastos verás aquí cómo evolucionan mes a mes.'
            });
            Icons.render(box);
            return;
        }

        function bar(valor, cls, nombre) {
            var h = valor > 0 ? (valor / max * 100).toFixed(1) : 0;
            return '<span' + (cls ? ' class="' + cls + '"' : '') + ' style="height:' + h + '%;' + (valor > 0 ? 'min-height:3px;' : 'min-height:0;') +
                   '" title="' + nombre + ': ' + esc(Fmt.money(valor)) + '"></span>';
        }
        var groups = serie.map(function (s) {
            return '<div class="bar-group">' + bar(s.ingresos, '', 'Ingresos') + bar(s.gastos, 'alt', 'Gastos') + '</div>';
        }).join('');
        var labels = serie.map(function (s) { return '<span>' + s.etiqueta + '</span>'; }).join('');

        box.innerHTML =
            '<div class="legend"><span><i></i>Ingresos</span><span><i class="alt"></i>Gastos</span></div>' +
            '<div class="chart-placeholder"><div class="chart-bars grouped">' + groups + '</div>' +
            '<div class="chart-labels grouped">' + labels + '</div></div>';
    }

    /* ---------------- Presupuesto del mes ---------------- */
    function renderPresupuesto() {
        var p = Store.presupuestoMes(Store.mesClave(0));
        var hay = p.limiteTotal > 0;
        var gastado = hay ? p.gastado : p.gastadoTotal;

        var ring = $('budget-ring');
        ring.style.setProperty('--pct', (hay ? Math.min(100, p.pct) : 0).toFixed(1));
        ring.classList.toggle('over', hay && p.gastado > p.limiteTotal);
        ring.innerHTML = '<div><span>Gastado</span><strong>' + esc(Fmt.money(gastado)) + '</strong>' +
            '<span>' + (hay ? 'de ' + esc(Fmt.money(p.limiteTotal)) : 'este mes') + '</span></div>';

        var top = p.filas.filter(function (f) { return f.gastado > 0; })
            .sort(function (x, y) { return y.gastado - x.gastado; }).slice(0, 4);
        $('budget-chips').innerHTML = top.length
            ? top.map(function (f) { return '<span>' + esc(f.categoria.emoji + ' ' + f.categoria.nombre) + '</span>'; }).join('')
            : '<span>Sin gastos este mes</span>';
    }

    /* ---------------- Movimientos recientes ---------------- */
    function renderRecientes() {
        var box = $('recent');
        var list = Store.movimientos.list({}).slice(0, 3);
        if (!list.length) {
            box.innerHTML = UI.emptyState({
                icon: 'inbox', compact: true, title: 'Aún no hay movimientos',
                text: 'Registra tu primer ingreso o gasto.',
                actions: '<a class="primary-button" href="pages/movimientos.html?nuevo=1"><span data-icon="plus"></span>Agregar movimiento</a>'
            });
            Icons.render(box);
            return;
        }
        box.innerHTML = list.map(function (m) {
            var ingreso = m.tipo === 'ingreso';
            var c = Store.categorias.get(m.categoriaId);
            return '<div class="transaction">' +
                '<div class="transaction-icon ' + (ingreso ? 'income' : 'expense') + '" data-icon="' + (ingreso ? 'arrow-up' : 'arrow-down') + '"></div>' +
                '<div class="transaction-info"><strong>' + esc(m.descripcion) + '</strong>' +
                '<span>' + Fmt.dateShort(m.fecha) + ' · ' + esc(c ? c.nombre : 'Otros') + '</span></div>' +
                '<strong class="transaction-amount' + (ingreso ? ' positive' : '') + '">' + esc(Fmt.money(ingreso ? m.monto : -m.monto, { sign: true })) + '</strong></div>';
        }).join('');
        Icons.render(box);
    }

    /* ---------------- Metas de ahorro ---------------- */
    function renderMetas() {
        var box = $('goals');
        var todas = Store.metas.list();
        if (!todas.length) {
            box.innerHTML = UI.emptyState({
                icon: 'target', compact: true, title: 'Aún no tienes metas',
                text: 'Define un objetivo de ahorro y sigue tu progreso.',
                actions: '<a class="secondary-button inline" href="pages/metas.html">Ir a Metas</a>'
            });
            Icons.render(box);
            return;
        }
        var activas = todas.map(function (g) {
            var ah = Store.metas.ahorrado(g);
            return { g: g, ah: ah, pct: Math.max(0, Math.min(100, ah / g.objetivo * 100)) };
        }).filter(function (x) { return x.ah < x.g.objetivo; })
          .sort(function (a, b) { return b.pct - a.pct; }).slice(0, 2);

        if (!activas.length) {
            box.innerHTML = UI.emptyState({ emoji: '🎉', compact: true, title: '¡Todas tus metas están completadas!', text: 'Puedes crear una nueva cuando quieras.' });
            return;
        }
        box.innerHTML = activas.map(function (x) {
            return '<div class="goal"><div class="goal-header"><strong>' + esc(x.g.emoji + ' ' + x.g.nombre) + '</strong>' +
                '<span>' + esc(Fmt.money(x.g.objetivo)) + '</span></div>' +
                '<div class="progress"><span style="width:' + x.pct.toFixed(1) + '%;"></span></div>' +
                '<small>' + Fmt.percent(x.pct) + ' completado</small></div>';
        }).join('');
    }

    function render() {
        renderSaludo();
        renderCards();
        renderChart();
        renderPresupuesto();
        renderRecientes();
        renderMetas();
    }

    /* ---------------- Inicio ---------------- */
    var sel = $('periodo');
    sel.innerHTML = Store.PERIODOS.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join('');
    sel.value = periodo;
    sel.addEventListener('change', function () { periodo = sel.value; renderCards(); });

    window.addEventListener('store:change', render);
    render();
})();

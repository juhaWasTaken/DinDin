/*
 * movimientos.js — Historial de movimientos:
 * alta / edición / eliminación (con deshacer), búsqueda, filtros,
 * paginación y exportación a CSV.
 */
(function () {
    'use strict';

    var PAGE_SIZE = 10;
    var esc = Fmt.esc;
    var state = { q: '', tipo: '', categoriaId: '', periodo: 'mes', page: 1 };

    function $(id) { return document.getElementById(id); }
    var el = {
        q: $('f-q'), tipo: $('f-tipo'), cat: $('f-cat'), periodo: $('f-periodo'),
        body: $('mov-body'), table: $('mov-table'), empty: $('mov-empty'),
        footer: $('mov-footer'), info: $('mov-info'), pages: $('mov-pages'),
        ing: $('s-ingresos'), gas: $('s-gastos'), bal: $('s-balance')
    };

    function filtros() {
        var r = Store.rango(state.periodo);
        return { desde: r.desde, hasta: r.hasta, tipo: state.tipo || null, categoriaId: state.categoriaId || null, q: state.q };
    }

    /* ---------------- Filtros ---------------- */
    function fillPeriodos() {
        el.periodo.innerHTML = Store.PERIODOS.map(function (p) {
            return '<option value="' + p[0] + '">' + p[1] + '</option>';
        }).join('');
        el.periodo.value = state.periodo;
    }

    function fillCategorias() {
        function group(label, list) {
            return '<optgroup label="' + label + '">' + list.map(function (c) {
                return '<option value="' + esc(c.id) + '">' + esc(c.emoji + ' ' + c.nombre) + '</option>';
            }).join('') + '</optgroup>';
        }
        var html = '<option value="">Todas las categorías</option>';
        if (state.tipo !== 'ingreso') html += group('Gastos', Store.categorias.list('gasto'));
        if (state.tipo !== 'gasto') html += group('Ingresos', Store.categorias.list('ingreso'));
        el.cat.innerHTML = html;
        var ok = Array.prototype.some.call(el.cat.options, function (o) { return o.value === state.categoriaId; });
        if (!ok) state.categoriaId = '';
        el.cat.value = state.categoriaId;
    }

    /* ---------------- Dibujo ---------------- */
    function renderResumen() {
        var r = Store.rango(state.periodo);
        var t = Store.totales(Store.movimientos.list({ desde: r.desde, hasta: r.hasta }));
        el.ing.textContent = Fmt.money(t.ingresos, { sign: true });
        el.gas.textContent = t.gastos ? Fmt.money(-t.gastos) : Fmt.money(0);
        el.bal.textContent = Fmt.money(t.balance);
    }

    function rowHTML(m) {
        var c = Store.categorias.get(m.categoriaId) || { emoji: '📦', nombre: 'Otros' };
        var ingreso = m.tipo === 'ingreso';
        return '<tr data-id="' + esc(m.id) + '">' +
            '<td>' + Fmt.date(m.fecha) + '</td>' +
            '<td><strong>' + esc(m.descripcion) + '</strong>' + (m.nota ? '<small class="row-note">' + esc(m.nota) + '</small>' : '') + '</td>' +
            '<td><span class="category">' + esc(c.emoji + ' ' + c.nombre) + '</span></td>' +
            '<td><span class="type-badge ' + (ingreso ? 'income' : 'expense') + '">' + (ingreso ? 'Ingreso' : 'Gasto') + '</span></td>' +
            '<td>' + esc(m.metodo) + '</td>' +
            '<td class="' + (ingreso ? 'amount-positive' : 'amount-negative') + '">' + Fmt.money(ingreso ? m.monto : -m.monto, { sign: true }) + '</td>' +
            '<td><button type="button" class="action-button" data-icon="more-vertical" aria-haspopup="menu" aria-expanded="false" ' +
            'aria-label="Acciones de ' + esc(m.descripcion) + '"></button></td></tr>';
    }

    function pageNumbers(cur, total) {
        var out = [], last = 0;
        for (var p = 1; p <= total; p++) {
            if (p === 1 || p === total || Math.abs(p - cur) <= 1) {
                if (p - last > 1) out.push('…');
                out.push(p);
                last = p;
            }
        }
        return out;
    }

    function render() {
        renderResumen();
        var total = Store.counts().movimientos;
        var list = Store.movimientos.list(filtros());
        var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        if (state.page > pages) state.page = pages;

        if (total === 0 || list.length === 0) {
            el.table.hidden = true;
            el.footer.hidden = true;
            el.empty.hidden = false;
            el.empty.innerHTML = total === 0
                ? UI.emptyState({
                    icon: 'inbox', title: 'Aún no tienes movimientos',
                    text: 'Registra tu primer ingreso o gasto para empezar a ver tu resumen.',
                    actions: '<button type="button" class="primary-button" data-act="nuevo"><span data-icon="plus"></span>Agregar mi primer movimiento</button>'
                })
                : UI.emptyState({
                    icon: 'search', title: 'No hay movimientos con estos filtros',
                    text: 'Prueba con otra búsqueda o revisa todo el historial.',
                    actions: '<button type="button" class="secondary-button inline" data-act="limpiar">Quitar filtros</button>'
                });
            Icons.render(el.empty);
            return;
        }

        el.empty.hidden = true;
        el.table.hidden = false;
        el.footer.hidden = false;

        var from = (state.page - 1) * PAGE_SIZE;
        var slice = list.slice(from, from + PAGE_SIZE);
        el.body.innerHTML = slice.map(rowHTML).join('');
        Icons.render(el.body);

        el.info.textContent = 'Mostrando ' + (from + 1) + '–' + (from + slice.length) + ' de ' + list.length + ' movimiento' + (list.length === 1 ? '' : 's');

        var btns = '<button type="button" data-icon="arrow-left" aria-label="Página anterior"' + (state.page === 1 ? ' disabled' : '') + ' data-page="' + (state.page - 1) + '"></button>';
        pageNumbers(state.page, pages).forEach(function (p) {
            if (p === '…') btns += '<span class="page-dots" aria-hidden="true">…</span>';
            else btns += '<button type="button" data-page="' + p + '"' + (p === state.page ? ' class="current-page" aria-current="page"' : '') + '>' + p + '</button>';
        });
        btns += '<button type="button" data-icon="arrow-right" aria-label="Página siguiente"' + (state.page === pages ? ' disabled' : '') + ' data-page="' + (state.page + 1) + '"></button>';
        el.pages.innerHTML = btns;
        Icons.render(el.pages);
    }

    /* ---------------- Formulario ---------------- */
    function openForm(mov) {
        var editing = !!mov;
        var m = mov || { tipo: 'gasto', monto: '', descripcion: '', categoriaId: '', fecha: Store.today(), metodo: 'Efectivo', nota: '' };

        var wrap = document.createElement('div');
        wrap.innerHTML =
            '<form class="mov-form" novalidate>' +
            '<div class="segmented" role="radiogroup" aria-label="Tipo de movimiento">' +
            '<label><input type="radio" name="tipo" value="gasto"><span>Gasto</span></label>' +
            '<label><input type="radio" name="tipo" value="ingreso"><span>Ingreso</span></label></div>' +
            '<div class="form-grid">' +
            '<label class="field">Monto<input name="monto" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" required><span class="field-error" data-for="monto"></span></label>' +
            '<label class="field">Fecha<input name="fecha" type="date" required><span class="field-error" data-for="fecha"></span></label></div>' +
            '<label class="field">Descripción<input name="descripcion" maxlength="80" placeholder="Ej. Supermercado" required><span class="field-error" data-for="descripcion"></span></label>' +
            '<div class="form-grid">' +
            '<label class="field">Categoría<select name="categoriaId"></select><span class="field-error" data-for="categoriaId"></span></label>' +
            '<label class="field">Método de pago<select name="metodo">' +
            Store.METODOS.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select></label></div>' +
            '<label class="field">Nota (opcional)<textarea name="nota" rows="2" maxlength="200" placeholder="Algún detalle que quieras recordar"></textarea></label>' +
            '<div class="modal-actions"><button type="button" class="secondary-button" data-cancel>Cancelar</button>' +
            '<button type="submit" class="primary-button">' + (editing ? 'Guardar cambios' : 'Guardar') + '</button></div>' +
            '</form>';

        var form = wrap.firstChild;
        var f = form.elements;

        function fillCats(tipo, selected) {
            var list = Store.categorias.list(tipo);
            f.categoriaId.innerHTML = '<option value="">Selecciona una categoría</option>' + list.map(function (c) {
                return '<option value="' + esc(c.id) + '">' + esc(c.emoji + ' ' + c.nombre) + '</option>';
            }).join('');
            var ok = list.some(function (c) { return c.id === selected; });
            f.categoriaId.value = ok ? selected : '';
        }

        function selectedTipo() { return form.querySelector('input[name="tipo"]:checked').value; }

        form.querySelector('input[name="tipo"][value="' + m.tipo + '"]').checked = true;
        f.monto.value = m.monto;
        f.fecha.value = m.fecha;
        f.descripcion.value = m.descripcion;
        f.metodo.value = m.metodo;
        f.nota.value = m.nota || '';
        fillCats(m.tipo, m.categoriaId);

        Array.prototype.forEach.call(form.querySelectorAll('input[name="tipo"]'), function (r) {
            r.addEventListener('change', function () { fillCats(selectedTipo(), f.categoriaId.value); });
        });

        function clearErrors() {
            Array.prototype.forEach.call(form.querySelectorAll('.field-error'), function (n) { n.textContent = ''; });
            Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (n) { n.removeAttribute('aria-invalid'); });
        }

        var dlg = UI.modal({ title: editing ? 'Editar movimiento' : 'Nuevo movimiento', body: wrap, focus: 'input[name="monto"]' });
        form.querySelector('[data-cancel]').addEventListener('click', function () { dlg.close(); });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            clearErrors();
            var values = {
                tipo: selectedTipo(), monto: f.monto.value, fecha: f.fecha.value, descripcion: f.descripcion.value,
                categoriaId: f.categoriaId.value, metodo: f.metodo.value, nota: f.nota.value
            };
            var res = editing ? Store.movimientos.update(mov.id, values) : Store.movimientos.add(values);
            if (!res.ok) {
                var firstBad = null;
                Object.keys(res.errors).forEach(function (k) {
                    var msg = form.querySelector('[data-for="' + k + '"]');
                    if (msg) msg.textContent = res.errors[k];
                    if (f[k] && f[k].setAttribute) { f[k].setAttribute('aria-invalid', 'true'); if (!firstBad) firstBad = f[k]; }
                });
                if (firstBad) firstBad.focus();
                else UI.toast(res.errors._ || 'No se pudo guardar.', { type: 'warning' });
                return;
            }
            dlg.close();
            state.page = 1;
            var visible = Store.movimientos.list(filtros()).some(function (x) { return x.id === res.value.id; });
            var msg = editing ? 'Cambios guardados.' : 'Movimiento agregado.';
            if (!visible) msg += ' No aparece en la lista porque está fuera del filtro actual.';
            UI.toast(msg, editing ? {} : {
                actionLabel: 'Deshacer',
                onAction: function () { Store.movimientos.remove(res.value.id); }
            });
        });
    }

    function eliminar(m) {
        UI.confirm({
            title: '¿Eliminar este movimiento?',
            message: '«' + m.descripcion + '» por ' + Fmt.money(m.monto) + ' (' + Fmt.date(m.fecha) + ') se eliminará del historial.',
            confirmText: 'Eliminar', danger: true
        }).then(function (ok) {
            if (!ok) return;
            var removed = Store.movimientos.remove(m.id);
            if (!removed) return;
            UI.toast('Movimiento eliminado.', { actionLabel: 'Deshacer', onAction: function () { Store.movimientos.restore(removed); } });
        });
    }

    /* ---------------- CSV ---------------- */
    function csvCell(v) {
        v = String(v == null ? '' : v);
        if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;       // evita que Excel lo interprete como fórmula
        return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }

    function exportarCSV() {
        var list = Store.movimientos.list(filtros());
        if (!list.length) { UI.toast('No hay movimientos para exportar con los filtros actuales.'); return; }
        var rows = [['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Método', 'Monto', 'Nota']];
        list.forEach(function (m) {
            var c = Store.categorias.get(m.categoriaId);
            rows.push([m.fecha, m.descripcion, c ? c.nombre : '', m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', m.metodo,
                       (m.tipo === 'ingreso' ? m.monto : -m.monto).toFixed(2), m.nota]);
        });
        var csv = '\uFEFF' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
        var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        var a = document.createElement('a');
        a.href = url;
        a.download = 'movimientos-' + Store.today() + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        UI.toast('Se exportaron ' + list.length + ' movimientos.');
    }

    /* ---------------- Eventos ---------------- */
    var timer;
    el.q.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { state.q = el.q.value; state.page = 1; render(); }, 150);
    });
    el.tipo.addEventListener('change', function () { state.tipo = el.tipo.value; state.page = 1; fillCategorias(); render(); });
    el.cat.addEventListener('change', function () { state.categoriaId = el.cat.value; state.page = 1; render(); });
    el.periodo.addEventListener('change', function () { state.periodo = el.periodo.value; state.page = 1; render(); });

    el.body.addEventListener('click', function (e) {
        var btn = e.target.closest('.action-button');
        if (!btn) return;
        var m = Store.movimientos.get(btn.closest('tr').getAttribute('data-id'));
        if (!m) return;
        UI.menu(btn, [
            { label: 'Editar', icon: 'edit', onClick: function () { openForm(m); } },
            { label: 'Eliminar', icon: 'trash', danger: true, onClick: function () { eliminar(m); } }
        ]);
    });

    el.pages.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-page]');
        if (!b || b.disabled) return;
        state.page = +b.getAttribute('data-page');
        render();
        el.table.scrollIntoView({ block: 'nearest' });
    });

    function limpiar() {
        state.q = ''; state.tipo = ''; state.categoriaId = ''; state.periodo = 'todo'; state.page = 1;
        el.q.value = ''; el.tipo.value = ''; el.periodo.value = 'todo';
        fillCategorias();
        render();
    }

    document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var act = b.getAttribute('data-act');
        if (act === 'nuevo') openForm();
        else if (act === 'limpiar') limpiar();
        else if (act === 'csv') exportarCSV();
    });

    window.addEventListener('store:change', function () { fillCategorias(); render(); });

    /* ---------------- Inicio ---------------- */
    fillPeriodos();
    fillCategorias();
    render();

    if (/[?&]nuevo=1\b/.test(location.search)) {
        if (window.history && history.replaceState) history.replaceState(null, '', location.pathname);
        if (Store.settings.get().onboarded) openForm();
    }
})();

/*
 * presupuesto.js — Límites mensuales por categoría de gasto.
 * El gasto de cada categoría se calcula solo desde Movimientos.
 * Los límites se guardan en la categoría y aplican igual a todos los meses.
 */
(function () {
    'use strict';

    var esc = Fmt.esc;
    var MAX_ATRAS = 23;           // cuántos meses hacia atrás se puede navegar
    var offset = 0;               // 0 = mes actual

    function $(id) { return document.getElementById(id); }

    /* ---------------- Dibujo ---------------- */
    function filaHTML(f) {
        var c = f.categoria;
        var sin = f.estado === 'sin';
        var barra = { ok: 'progress-normal', warn: 'progress-warning', over: 'progress-over' }[f.estado];
        var sub = f.movimientos + ' movimiento' + (f.movimientos === 1 ? '' : 's') + ' este mes';

        var valores = sin
            ? '<strong>' + esc(Fmt.money(f.gastado)) + '</strong><span>sin límite</span>'
            : '<strong>' + esc(Fmt.money(f.gastado)) + '</strong><span>de ' + esc(Fmt.money(f.limite)) + '</span>';

        var cuerpo = '';
        if (sin) {
            cuerpo = '<div class="budget-item-footer"><span>Sin límite definido</span>' +
                     '<button type="button" class="link-button" data-act="limite" data-id="' + esc(c.id) + '">Definir límite</button></div>';
        } else {
            cuerpo = '<div class="budget-progress"><span class="' + barra + '" style="width:' + Math.min(100, f.pct).toFixed(1) + '%;"></span></div>' +
                     '<div class="budget-item-footer">' +
                     (f.estado === 'over'
                         ? '<span class="over">Excedido por ' + esc(Fmt.money(-f.disponible)) + '</span>'
                         : '<span>' + esc(Fmt.money(f.disponible)) + ' disponibles</span>') +
                     '<span' + (f.estado === 'over' ? ' class="over"' : '') + '>' + Math.round(f.pct) + '%</span></div>';
        }

        return '<div class="budget-item" data-id="' + esc(c.id) + '">' +
            '<div class="budget-item-header">' +
            '<div class="budget-category"><div class="budget-category-icon">' + esc(c.emoji) + '</div>' +
            '<div><strong>' + esc(c.nombre) + '</strong><span>' + sub + '</span></div></div>' +
            '<div class="budget-right"><div class="budget-values">' + valores + '</div>' +
            '<button type="button" class="action-button" data-icon="more-vertical" aria-haspopup="menu" aria-expanded="false" ' +
            'aria-label="Acciones de ' + esc(c.nombre) + '"></button></div></div>' + cuerpo + '</div>';
    }

    function alertaHTML(icono, cls, titulo, texto) {
        return '<div class="budget-alert"><div class="alert-icon ' + cls + '" data-icon="' + icono + '"></div>' +
               '<div><strong>' + esc(titulo) + '</strong><p>' + esc(texto) + '</p></div></div>';
    }

    function renderAlertas(p) {
        var box = $('p-alertas');
        if (!Store.settings.get().notificaciones.presupuesto) {
            box.innerHTML = alertaHTML('alert-circle', 'neutral', 'Alertas desactivadas', 'Puedes activarlas en Configuración → Avisos.');
            return;
        }
        var lista = p.filas.filter(function (f) { return f.estado === 'over' || f.estado === 'warn'; });
        if (!lista.length) {
            box.innerHTML = alertaHTML('check-circle', 'neutral',
                p.limiteTotal > 0 ? 'Todo en orden' : 'Aún no hay límites',
                p.limiteTotal > 0 ? 'Ninguna categoría supera el 80% de su límite.' : 'Define un límite en alguna categoría para recibir alertas.');
            return;
        }
        box.innerHTML = lista.map(function (f) {
            return f.estado === 'over'
                ? alertaHTML('alert-circle', 'danger', f.categoria.nombre, 'Superaste el límite por ' + Fmt.money(-f.disponible) + '.')
                : alertaHTML('alert-circle', '', f.categoria.nombre, 'Has utilizado el ' + Math.round(f.pct) + '% del presupuesto.');
        }).join('');
    }

    function render() {
        var p = Store.presupuestoMes(Store.mesClave(offset));
        $('mes-label').textContent = p.etiqueta;
        $('mes-prev').disabled = offset <= -MAX_ATRAS;
        $('mes-next').disabled = offset >= 0;

        /* Tarjetas */
        var hay = p.limiteTotal > 0;
        $('p-total').textContent = Fmt.money(p.limiteTotal);
        $('p-total-d').textContent = hay ? 'Suma de los límites de tus categorías' : 'Aún no defines límites';
        $('p-gastado').textContent = Fmt.money(p.gastado);
        $('p-gastado-d').textContent = hay ? Fmt.percent(p.pct) + ' del presupuesto utilizado' : 'Gasto en categorías con límite';
        $('p-disp').textContent = Fmt.money(p.disponible);
        $('p-disp-d').textContent = !hay ? 'Define límites para verlo'
            : (p.disponible < 0 ? 'Te pasaste del presupuesto' : Fmt.percent(100 - p.pct) + ' del presupuesto restante');

        /* Aviso para empezar */
        $('p-hint').hidden = hay;

        /* Lista */
        $('p-lista').innerHTML = p.filas.map(filaHTML).join('');
        Icons.render($('p-lista'));

        /* Resumen lateral */
        var d = $('p-donut');
        d.style.setProperty('--pct', Math.min(100, p.pct).toFixed(1));
        d.classList.toggle('over', hay && p.gastado > p.limiteTotal);
        d.innerHTML = '<div><strong>' + (hay ? Math.round(p.pct) + '%' : '—') + '</strong><span>' + (hay ? 'utilizado' : 'sin límites') + '</span></div>';
        $('s-gastado').textContent = Fmt.money(p.gastado);
        $('s-disp-label').textContent = p.disponible < 0 ? 'Excedido' : 'Disponible';
        $('s-disp').textContent = Fmt.money(Math.abs(p.disponible));
        var extra = $('s-extra');
        extra.hidden = p.gastadoSinLimite <= 0;
        extra.textContent = 'Además gastaste ' + Fmt.money(p.gastadoSinLimite) + ' en categorías sin límite.';

        renderAlertas(p);
        Icons.render($('p-alertas'));
    }

    /* ---------------- Categoría: crear / editar ---------------- */
    function abrirCategoria(cat, enfocarLimite) {
        var editando = !!cat;
        var puedeEliminar = editando && cat.id !== 'otros-gasto';
        var wrap = document.createElement('div');
        wrap.innerHTML =
            '<form novalidate>' +
            '<label class="field">Nombre<input name="nombre" maxlength="30" placeholder="Ej. Mascotas" autocomplete="off"><span class="field-error" data-for="nombre"></span></label>' +
            '<div class="field">Emoji<input name="emoji" class="emoji-input" maxlength="12" placeholder="📦" aria-label="Emoji de la categoría"><div data-emoji></div></div>' +
            '<label class="field">Límite mensual (opcional)<input name="limite" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Sin límite">' +
            '<small class="field-hint">Déjalo vacío si solo quieres llevar el registro sin límite.</small><span class="field-error" data-for="limite"></span></label>' +
            '<div class="modal-actions">' +
            (puedeEliminar ? '<button type="button" class="danger-button push-left" data-del>Eliminar</button>' : '') +
            '<button type="button" class="secondary-button" data-cancel>Cancelar</button>' +
            '<button type="submit" class="primary-button">' + (editando ? 'Guardar cambios' : 'Crear categoría') + '</button></div></form>';
        var form = wrap.firstChild, f = form.elements;

        f.nombre.value = editando ? cat.nombre : '';
        f.emoji.value = editando ? cat.emoji : '';
        f.limite.value = editando && cat.limite > 0 ? cat.limite : '';
        form.querySelector('[data-emoji]').appendChild(UI.emojiPicker(f.emoji, 'categoria'));

        var dlg = UI.modal({
            title: editando ? 'Editar categoría' : 'Nueva categoría', body: wrap,
            focus: enfocarLimite ? 'input[name="limite"]' : 'input[name="nombre"]'
        });
        form.querySelector('[data-cancel]').addEventListener('click', function () { dlg.close(); });

        if (puedeEliminar) {
            form.querySelector('[data-del]').addEventListener('click', function () { dlg.close(); eliminar(cat); });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var vals = { nombre: f.nombre.value, emoji: f.emoji.value, limite: f.limite.value };
            var r = editando ? Store.categorias.update(cat.id, vals) : Store.categorias.add(vals);
            if (!r.ok) { UI.showErrors(form, r.errors); return; }
            dlg.close();
            UI.toast(editando ? 'Cambios guardados.' : 'Categoría creada.');
        });
    }

    function eliminar(cat) {
        var n = Store.movimientos.list({ categoriaId: cat.id }).length;
        UI.confirm({
            title: '¿Eliminar «' + cat.nombre + '»?',
            message: n
                ? 'Sus ' + n + ' movimiento' + (n === 1 ? '' : 's') + ' pasarán a la categoría «Otros». Podrás deshacerlo justo después.'
                : 'Esta categoría no tiene movimientos.',
            confirmText: 'Eliminar', danger: true
        }).then(function (ok) {
            if (!ok) return;
            var r = Store.categorias.remove(cat.id);
            if (!r.ok) { UI.toast(r.error, { type: 'warning' }); return; }
            UI.toast('Categoría eliminada.', { actionLabel: 'Deshacer', onAction: function () { Store.categorias.restore(r.snapshot); } });
        });
    }

    /* ---------------- Sugerir límites ---------------- */
    function sugerir() {
        var s = Store.sugerirLimites();
        var cambios = Object.keys(s.limites).map(function (id) {
            return { cat: Store.categorias.get(id), nuevo: s.limites[id] };
        }).filter(function (x) { return x.cat && x.cat.limite !== x.nuevo; });

        if (!Object.keys(s.limites).length) {
            UI.toast('Aún no hay gastos registrados para sugerir límites.');
            return;
        }
        if (!cambios.length) { UI.toast('Tus límites ya coinciden con lo que sugerimos.'); return; }

        var base = s.base === 'historial'
            ? 'el promedio de tus gastos de los últimos ' + s.meses + (s.meses === 1 ? ' mes' : ' meses')
            : 'tus gastos de este mes (todavía no hay meses anteriores)';
        var filas = cambios.map(function (x) {
            return '<div class="suggest-row"><span>' + esc(x.cat.emoji + ' ' + x.cat.nombre) + '</span>' +
                   '<span class="muted">' + (x.cat.limite > 0 ? esc(Fmt.money(x.cat.limite)) : 'sin límite') + '</span>' +
                   '<strong>' + esc(Fmt.money(x.nuevo)) + '</strong></div>';
        }).join('');

        var dlg = UI.modal({
            title: 'Sugerir límites',
            body: '<p class="modal-text">Calculados con ' + esc(base) + ', redondeados hacia arriba. Puedes ajustarlos después uno por uno.</p>' +
                  '<div class="suggest-list">' + filas + '</div>' +
                  '<div class="modal-actions"><button type="button" class="secondary-button" data-no>Cancelar</button>' +
                  '<button type="button" class="primary-button" data-yes>Aplicar</button></div>',
            focus: '[data-yes]'
        });
        dlg.body.querySelector('[data-no]').addEventListener('click', function () { dlg.close(); });
        dlg.body.querySelector('[data-yes]').addEventListener('click', function () {
            var nuevos = {};
            cambios.forEach(function (x) { nuevos[x.cat.id] = x.nuevo; });
            var prev = Store.aplicarLimites(nuevos);
            dlg.close();
            UI.toast('Límites actualizados en ' + cambios.length + ' categoría' + (cambios.length === 1 ? '' : 's') + '.',
                { actionLabel: 'Deshacer', onAction: function () { Store.aplicarLimites(prev); } });
        });
    }

    /* ---------------- Eventos ---------------- */
    $('mes-prev').addEventListener('click', function () { if (offset > -MAX_ATRAS) { offset--; render(); } });
    $('mes-next').addEventListener('click', function () { if (offset < 0) { offset++; render(); } });
    $('btn-nueva-cat').addEventListener('click', function () { abrirCategoria(null); });
    $('btn-sugerir').addEventListener('click', sugerir);

    $('p-lista').addEventListener('click', function (e) {
        var def = e.target.closest('[data-act="limite"]');
        if (def) { abrirCategoria(Store.categorias.get(def.getAttribute('data-id')), true); return; }
        var btn = e.target.closest('.action-button');
        if (!btn) return;
        var cat = Store.categorias.get(btn.closest('.budget-item').getAttribute('data-id'));
        if (!cat) return;
        var items = [{ label: 'Editar', icon: 'edit', onClick: function () { abrirCategoria(cat); } }];
        if (cat.id !== 'otros-gasto') items.push({ label: 'Eliminar', icon: 'trash', danger: true, onClick: function () { eliminar(cat); } });
        UI.menu(btn, items);
    });

    window.addEventListener('store:change', render);
    render();
})();

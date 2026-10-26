/*
 * metas.js — Metas de ahorro: crear, editar, eliminar, aportar / retirar
 * y consultar el historial. El progreso se calcula siempre desde los aportes.
 */
(function () {
    'use strict';

    var esc = Fmt.esc;
    var COLORES = ['education', 'phone', 'travel', 'emergency'];   // clases de color ya existentes en tu CSS
    var filtro = 'todas';

    function $(id) { return document.getElementById(id); }

    /* ---------------- Utilidades ---------------- */
    function ordenadas(lista) {
        return lista.map(function (g) { return { g: g, e: Store.metas.estado(g) }; }).sort(function (a, b) {
            if (a.e.completada !== b.e.completada) return a.e.completada ? 1 : -1;
            var fa = a.g.fecha || '9999-99-99', fb = b.g.fecha || '9999-99-99';
            if (fa !== fb) return fa < fb ? -1 : 1;
            return b.e.pct - a.e.pct;
        });
    }

    function textoFecha(g, e) {
        if (!g.fecha) return 'Sin fecha objetivo';
        var base = 'Fecha objetivo: ' + Fmt.date(g.fecha);
        if (e.completada) return base;
        if (e.vencida) return base + ' · vencida';
        if (e.diasRestantes === 0) return base + ' · es hoy';
        return base + ' · faltan ' + e.diasRestantes + ' día' + (e.diasRestantes === 1 ? '' : 's');
    }

    /* ---------------- Dibujo ---------------- */
    function tarjetaHTML(x, idx) {
        var g = x.g, e = x.e;
        var pie = e.completada
            ? '<span class="goal-hint">🎉 ¡Meta alcanzada!</span>'
            : (e.mensualSugerido > 0
                ? '<span class="goal-hint">≈ ' + esc(Fmt.money(e.mensualSugerido)) + ' al mes para llegar a tiempo</span>'
                : (e.vencida ? '<span class="goal-hint warn">La fecha ya pasó. Puedes editarla.</span>' : '<span class="goal-hint"></span>'));
        return '<article class="goal-card' + (e.completada ? ' done' : '') + '" data-id="' + esc(g.id) + '">' +
            '<div class="goal-card-header"><div class="goal-title-wrapper">' +
            '<div class="goal-icon ' + COLORES[idx % COLORES.length] + '">' + esc(g.emoji) + '</div>' +
            '<div><h3>' + esc(g.nombre) + '</h3><span>' + esc(textoFecha(g, e)) + '</span></div></div>' +
            '<button type="button" class="goal-menu" data-icon="more-horizontal" aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de ' + esc(g.nombre) + '"></button></div>' +
            '<div class="goal-amounts"><div><span>Ahorrado</span><strong>' + esc(Fmt.money(e.ahorrado)) + '</strong></div>' +
            '<div class="goal-target"><span>Objetivo</span><strong>' + esc(Fmt.money(g.objetivo)) + '</strong></div></div>' +
            '<div class="goal-progress"><div class="goal-progress-bar"><span style="width:' + e.pct.toFixed(1) + '%;"></span></div>' +
            '<div class="goal-progress-info"><strong>' + Fmt.percent(e.pct) + '</strong>' +
            '<span>' + (e.completada ? 'Meta completada' : esc(Fmt.money(e.restante)) + ' restantes') + '</span></div></div>' +
            '<div class="goal-footer">' + pie +
            '<div class="goal-actions"><button type="button" class="secondary-button inline btn-sm" data-act="historial"><span data-icon="clock"></span>Historial</button>' +
            '<button type="button" class="primary-button btn-sm" data-act="aportar"><span data-icon="plus"></span>Aportar</button></div></div></article>';
    }

    function renderResumen(r) {
        $('m-ahorrado').textContent = Fmt.money(r.ahorrado);
        $('m-objetivo').textContent = Fmt.money(r.objetivo);
        $('m-pct').textContent = Fmt.percent(r.pct);
        $('m-pct-d').textContent = r.objetivo > 0 ? Fmt.percent(100 - r.pct) + ' restante para completar' : 'Crea una meta para empezar';
        $('m-activas').textContent = r.activas;
        $('m-activas-d').textContent = r.completadas + ' completada' + (r.completadas === 1 ? '' : 's');
    }

    function renderLista(todas) {
        var box = $('m-lista');
        if (!todas.length) {
            box.innerHTML = UI.emptyState({
                icon: 'target', title: 'Aún no tienes metas',
                text: 'Define algo que quieras lograr (un viaje, un fondo de emergencia…) y registra tus aportes para ver tu avance.',
                actions: '<button type="button" class="primary-button" data-act="nueva"><span data-icon="plus"></span>Crear mi primera meta</button>'
            });
            Icons.render(box);
            return;
        }
        var lista = todas.filter(function (x) {
            return filtro === 'todas' || (filtro === 'activas' ? !x.e.completada : x.e.completada);
        });
        if (!lista.length) {
            box.innerHTML = UI.emptyState({
                compact: true, icon: 'target',
                title: filtro === 'activas' ? 'No tienes metas activas' : 'Todavía no completas ninguna meta',
                text: filtro === 'activas' ? 'Todas tus metas están completadas.' : 'Sigue aportando: cada aporte cuenta.'
            });
            Icons.render(box);
            return;
        }
        var indice = {};
        todas.slice().sort(function (a, b) { return a.g.creado - b.g.creado; }).forEach(function (x, i) { indice[x.g.id] = i; });
        box.innerHTML = lista.map(function (x) { return tarjetaHTML(x, indice[x.g.id]); }).join('');
        Icons.render(box);
    }

    function renderLateral(todas, r) {
        var c = $('m-circle');
        c.style.setProperty('--pct', r.pct.toFixed(1));
        $('m-circle-pct').textContent = Fmt.percent(r.pct);
        $('m-ov-ahorrado').textContent = Fmt.money(r.ahorrado);
        $('m-ov-restante').textContent = Fmt.money(r.restante);

        /* Próxima meta: la activa con mayor avance */
        var activas = todas.filter(function (x) { return !x.e.completada; })
            .sort(function (a, b) { return b.e.pct - a.e.pct; });
        var box = $('m-next');
        if (!todas.length) {
            box.innerHTML = '<p class="side-empty">Cuando crees una meta, aquí verás la que está más cerca de completarse.</p>';
        } else if (!activas.length) {
            box.innerHTML = '<div class="next-goal-message"><strong>🎉 ¡Todas tus metas están completadas!</strong><p>Puedes crear una nueva cuando quieras.</p></div>';
        } else {
            var n = activas[0], g = n.g, e = n.e;
            var msg = e.mensualSugerido > 0
                ? 'Ahorrando unos ' + Fmt.money(e.mensualSugerido) + ' al mes llegarás a tu meta antes del ' + Fmt.date(g.fecha) + '.'
                : (e.vencida ? 'La fecha objetivo ya pasó; puedes ajustarla.' : 'Registra un aporte para seguir avanzando.');
            box.innerHTML =
                '<div class="next-goal-content"><div class="next-goal-icon">' + esc(g.emoji) + '</div>' +
                '<div><strong>' + esc(g.nombre) + '</strong><span>' + Fmt.percent(e.pct) + ' completado</span></div></div>' +
                '<div class="next-goal-message"><strong>Faltan ' + esc(Fmt.money(e.restante)) + '</strong><p>' + esc(msg) + '</p></div>' +
                '<button type="button" class="secondary-button" data-act="aportar-next" data-id="' + esc(g.id) + '">Aportar ahora</button>';
        }

        /* Consejo: contextual si hay una meta con fecha */
        var conFecha = activas.filter(function (x) { return x.e.mensualSugerido > 0; })
            .sort(function (a, b) { return a.g.fecha < b.g.fecha ? -1 : 1; })[0];
        $('m-tip').textContent = conFecha
            ? 'Para llegar a tiempo con «' + conFecha.g.nombre + '» necesitas ahorrar unos ' + Fmt.money(conFecha.e.mensualSugerido) + ' al mes. Prográmalo justo después de cobrar.'
            : 'Establece una cantidad fija para ahorrar cada mes y conviértela en una prioridad dentro de tu presupuesto.';
    }

    function render() {
        var todas = ordenadas(Store.metas.list());
        var r = Store.metas.resumen();
        renderResumen(r);
        renderLista(todas);
        renderLateral(todas, r);
        Icons.render($('m-next'));
    }

    /* ---------------- Meta: crear / editar ---------------- */
    function abrirMeta(meta) {
        var editando = !!meta;
        var wrap = document.createElement('div');
        wrap.innerHTML =
            '<form novalidate>' +
            '<label class="field">Nombre<input name="nombre" maxlength="50" placeholder="Ej. Viaje a la playa" autocomplete="off"><span class="field-error" data-for="nombre"></span></label>' +
            '<div class="field">Emoji<input name="emoji" class="emoji-input" maxlength="12" placeholder="🎯" aria-label="Emoji de la meta"><div data-emoji></div></div>' +
            '<div class="form-grid">' +
            '<label class="field">Objetivo<input name="objetivo" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0.00"><span class="field-error" data-for="objetivo"></span></label>' +
            '<label class="field">Fecha objetivo (opcional)<input name="fecha" type="date"><span class="field-error" data-for="fecha"></span></label></div>' +
            (editando ? '' : '<label class="field">Ya llevo ahorrado (opcional)<input name="inicial" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0.00"><span class="field-error" data-for="inicial"></span></label>') +
            '<div class="modal-actions"><button type="button" class="secondary-button" data-cancel>Cancelar</button>' +
            '<button type="submit" class="primary-button">' + (editando ? 'Guardar cambios' : 'Crear meta') + '</button></div></form>';
        var form = wrap.firstChild, f = form.elements;
        f.nombre.value = editando ? meta.nombre : '';
        f.emoji.value = editando ? meta.emoji : '';
        f.objetivo.value = editando ? meta.objetivo : '';
        f.fecha.value = editando ? meta.fecha : '';
        form.querySelector('[data-emoji]').appendChild(UI.emojiPicker(f.emoji, 'meta'));

        var dlg = UI.modal({ title: editando ? 'Editar meta' : 'Nueva meta', body: wrap, focus: 'input[name="nombre"]' });
        form.querySelector('[data-cancel]').addEventListener('click', function () { dlg.close(); });
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var vals = { nombre: f.nombre.value, emoji: f.emoji.value, objetivo: f.objetivo.value, fecha: f.fecha.value, inicial: f.inicial ? f.inicial.value : '' };
            var r = editando ? Store.metas.update(meta.id, vals) : Store.metas.add(vals);
            if (!r.ok) { UI.showErrors(form, r.errors); return; }
            dlg.close();
            UI.toast(editando ? 'Cambios guardados.' : 'Meta creada. ¡Ahora registra tu primer aporte!');
        });
    }

    function eliminarMeta(g) {
        UI.confirm({
            title: '¿Eliminar «' + g.nombre + '»?',
            message: 'Se eliminará la meta junto con su historial de aportes. Podrás deshacerlo justo después.',
            confirmText: 'Eliminar', danger: true
        }).then(function (ok) {
            if (!ok) return;
            var removed = Store.metas.remove(g.id);
            if (!removed) return;
            UI.toast('Meta eliminada.', { actionLabel: 'Deshacer', onAction: function () { Store.metas.restore(removed); } });
        });
    }

    /* ---------------- Aportar / retirar ---------------- */
    function abrirAporte(id) {
        var g = Store.metas.get(id);
        if (!g) return;
        var e = Store.metas.estado(g);
        var wrap = document.createElement('div');
        wrap.innerHTML =
            '<p class="modal-text">Llevas <strong>' + esc(Fmt.money(e.ahorrado)) + '</strong> de ' + esc(Fmt.money(g.objetivo)) + '.</p>' +
            '<form novalidate>' +
            '<div class="segmented" role="radiogroup" aria-label="Tipo de operación">' +
            '<label><input type="radio" name="op" value="aporte" checked><span>Aportar</span></label>' +
            '<label><input type="radio" name="op" value="retiro"><span>Retirar</span></label></div>' +
            '<div class="form-grid">' +
            '<label class="field">Monto<input name="monto" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0.00"><span class="field-error" data-for="monto"></span></label>' +
            '<label class="field">Fecha<input name="fecha" type="date"><span class="field-error" data-for="fecha"></span></label></div>' +
            '<label class="field">Nota (opcional)<input name="nota" maxlength="100" placeholder="Ej. Bono de septiembre"></label>' +
            '<div class="modal-actions"><button type="button" class="secondary-button" data-cancel>Cancelar</button>' +
            '<button type="submit" class="primary-button">Guardar</button></div></form>';
        var form = wrap.querySelector('form'), f = form.elements;
        f.fecha.value = Store.today();

        var dlg = UI.modal({ title: g.emoji + ' ' + g.nombre, body: wrap, focus: 'input[name="monto"]' });
        form.querySelector('[data-cancel]').addEventListener('click', function () { dlg.close(); });
        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var retiro = form.querySelector('input[name="op"]:checked').value === 'retiro';
            var monto = f.monto.value === '' ? '' : Number(f.monto.value) * (retiro ? -1 : 1);
            var r = Store.metas.addAporte(id, { monto: monto, fecha: f.fecha.value, nota: f.nota.value });
            if (!r.ok) { UI.showErrors(form, r.errors); return; }
            dlg.close();
            var msg = r.completada ? '🎉 ¡Alcanzaste tu meta «' + g.nombre + '»!' : (retiro ? 'Retiro registrado.' : 'Aporte registrado.');
            UI.toast(msg, { actionLabel: 'Deshacer', duration: 8000, onAction: function () { Store.metas.removeAporte(id, r.value.id); } });
        });
    }

    /* ---------------- Historial ---------------- */
    function abrirHistorial(id) {
        var g0 = Store.metas.get(id);
        if (!g0) return;
        var dlg = UI.modal({ title: 'Historial · ' + g0.nombre, body: '<div id="hist-box"></div>' });
        var box = dlg.body.querySelector('#hist-box');

        function pintar() {
            var g = Store.metas.get(id);
            if (!g) { dlg.close(); return; }
            var e = Store.metas.estado(g);
            var lista = g.aportes.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0; });
            box.innerHTML =
                '<p class="modal-text">Ahorrado: <strong>' + esc(Fmt.money(e.ahorrado)) + '</strong> de ' + esc(Fmt.money(g.objetivo)) + ' (' + Fmt.percent(e.pct) + ').</p>' +
                (lista.length
                    ? '<div class="hist-list">' + lista.map(function (a) {
                        var pos = a.monto > 0;
                        return '<div class="hist-row"><div class="hist-info"><strong>' + Fmt.date(a.fecha) + '</strong>' +
                               (a.nota ? '<span>' + esc(a.nota) + '</span>' : '') + '</div>' +
                               '<span class="' + (pos ? 'amount-positive' : 'amount-negative') + '">' + esc(Fmt.money(a.monto, { sign: true })) + '</span>' +
                               '<button type="button" class="action-button" data-icon="trash" data-aid="' + esc(a.id) + '" aria-label="Eliminar este registro"></button></div>';
                    }).join('') + '</div>'
                    : '<p class="side-empty">Todavía no hay aportes en esta meta.</p>') +
                '<div class="modal-actions"><button type="button" class="secondary-button" data-close>Cerrar</button>' +
                '<button type="button" class="primary-button" data-add><span data-icon="plus"></span>Aportar</button></div>';
            Icons.render(box);
        }
        pintar();

        box.addEventListener('click', function (ev) {
            if (ev.target.closest('[data-close]')) { dlg.close(); return; }
            if (ev.target.closest('[data-add]')) { dlg.close(); abrirAporte(id); return; }
            var b = ev.target.closest('[data-aid]');
            if (!b) return;
            var r = Store.metas.removeAporte(id, b.getAttribute('data-aid'));
            if (!r.ok) { UI.toast(r.error, { type: 'warning' }); return; }
            UI.toast('Registro eliminado.', { actionLabel: 'Deshacer', onAction: function () { Store.metas.restoreAporte(id, r.value); } });
        });
        window.addEventListener('store:change', function onChange() {
            if (!document.body.contains(dlg.el)) { window.removeEventListener('store:change', onChange); return; }
            pintar();
        });
    }

    /* ---------------- Eventos ---------------- */
    $('btn-nueva').addEventListener('click', function () { abrirMeta(null); });

    Array.prototype.forEach.call(document.querySelectorAll('input[name="filtro"]'), function (r) {
        r.addEventListener('change', function () { filtro = r.value; render(); });
    });

    document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var act = b.getAttribute('data-act');
        if (act === 'nueva') { abrirMeta(null); return; }
        if (act === 'aportar-next') { abrirAporte(b.getAttribute('data-id')); return; }
        var card = b.closest('.goal-card');
        if (!card) return;
        if (act === 'aportar') abrirAporte(card.getAttribute('data-id'));
        else if (act === 'historial') abrirHistorial(card.getAttribute('data-id'));
    });

    $('m-lista').addEventListener('click', function (e) {
        var btn = e.target.closest('.goal-menu');
        if (!btn) return;
        var g = Store.metas.get(btn.closest('.goal-card').getAttribute('data-id'));
        if (!g) return;
        UI.menu(btn, [
            { label: 'Editar', icon: 'edit', onClick: function () { abrirMeta(g); } },
            { label: 'Eliminar', icon: 'trash', danger: true, onClick: function () { eliminarMeta(g); } }
        ]);
    });

    window.addEventListener('store:change', render);
    render();
})();

/*
 * configuracion.js — Perfil, apariencia, preferencias y gestión de datos
 * (copia de seguridad, importar, datos de ejemplo y borrado).
 */
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }
    var form = $('cfg-form');

    function fillForm() {
        var s = Store.settings.get();
        $('c-nombre').value = s.nombre;
        $('c-moneda').value = s.moneda;
        $('c-saldo').value = s.saldoInicial || '';
        $('c-tema').value = Theme.get();
        $('n-presupuesto').checked = s.notificaciones.presupuesto;
        $('n-pagos').checked = s.notificaciones.pagos;
        $('c-error-saldo').textContent = '';
        $('c-saldo').removeAttribute('aria-invalid');
    }

    function renderEstado() {
        var c = Store.counts();
        var s = Store.settings.get();
        var respaldo = s.ultimoRespaldo
            ? new Date(s.ultimoRespaldo).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'nunca';
        $('data-status').textContent = c.movimientos + ' movimiento' + (c.movimientos === 1 ? '' : 's') + ' · ' +
            c.metas + ' meta' + (c.metas === 1 ? '' : 's') + ' · Último respaldo: ' + respaldo;
        $('storage-warning').hidden = Store.persistent();
    }

    /* ---------------- Guardar ---------------- */
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var saldoRaw = $('c-saldo').value.trim();
        var saldo = saldoRaw === '' ? 0 : Number(saldoRaw);
        if (!isFinite(saldo)) {
            $('c-error-saldo').textContent = 'Escribe un número válido.';
            $('c-saldo').setAttribute('aria-invalid', 'true');
            $('c-saldo').focus();
            return;
        }
        Theme.set($('c-tema').value);
        Store.settings.set({
            nombre: $('c-nombre').value,
            moneda: $('c-moneda').value,
            saldoInicial: saldo,
            notificaciones: { presupuesto: $('n-presupuesto').checked, pagos: $('n-pagos').checked }
        });
        UI.toast('Cambios guardados.');
    });

    $('c-cancelar').addEventListener('click', function () { fillForm(); UI.toast('Se descartaron los cambios.'); });

    /* ---------------- Datos ---------------- */
    function descargar(nombre, texto, tipo) {
        var url = URL.createObjectURL(new Blob([texto], { type: tipo }));
        var a = document.createElement('a');
        a.href = url; a.download = nombre;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    $('btn-exportar').addEventListener('click', function () {
        descargar('dindin-respaldo-' + Store.today() + '.json', Store.exportar(), 'application/json');
        UI.toast('Copia de seguridad descargada. Guárdala en un lugar seguro.');
    });

    $('btn-importar').addEventListener('click', function () { $('file-importar').click(); });

    $('file-importar').addEventListener('change', function () {
        var file = this.files && this.files[0];
        this.value = '';
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { UI.toast('El archivo es demasiado grande (máximo 5 MB).', { type: 'warning' }); return; }
        var reader = new FileReader();
        reader.onerror = function () { UI.toast('No se pudo leer el archivo.', { type: 'warning' }); };
        reader.onload = function () {
            var c = Store.counts();
            UI.confirm({
                title: '¿Restaurar esta copia?',
                message: 'Se reemplazarán tus datos actuales (' + c.movimientos + ' movimientos y ' + c.metas + ' metas) por los del archivo. Esta acción no se puede deshacer.',
                confirmText: 'Restaurar', danger: true
            }).then(function (ok) {
                if (!ok) return;
                var r = Store.importar(String(reader.result));
                if (!r.ok) { UI.toast(r.error, { type: 'warning', duration: 7000 }); return; }
                fillForm();
                UI.toast('Copia restaurada: ' + r.movimientos + ' movimientos y ' + r.metas + ' metas.');
            });
        };
        reader.readAsText(file);
    });

    $('btn-demo').addEventListener('click', function () {
        var c = Store.counts();
        var hay = c.movimientos + c.metas > 0;
        var go = function () { Store.cargarDemo(); UI.toast('Datos de ejemplo cargados.'); };
        if (!hay) { go(); return; }
        UI.confirm({
            title: '¿Cargar datos de ejemplo?',
            message: 'Se reemplazarán tus movimientos y metas actuales por datos de muestra. Exporta una copia antes si quieres conservarlos.',
            confirmText: 'Cargar ejemplo', danger: true
        }).then(function (ok) { if (ok) go(); });
    });

    $('btn-borrar').addEventListener('click', function () {
        var c = Store.counts();
        UI.confirm({
            title: '¿Borrar todos tus datos?',
            message: 'Se eliminarán ' + c.movimientos + ' movimientos y ' + c.metas + ' metas de este navegador. Conservaremos tu nombre y moneda. Esta acción no se puede deshacer; exporta una copia antes si la necesitas.',
            confirmText: 'Borrar todo', danger: true
        }).then(function (ok) {
            if (!ok) return;
            Store.reiniciar();
            UI.toast('Se borraron todos tus datos.');
        });
    });

    window.addEventListener('store:change', renderEstado);

    fillForm();
    renderEstado();
})();

/*
 * layout.js — Dibuja lo que se repetía en todas las páginas de DinDin.
 *
 * Cada página solo declara:
 *   <body data-page="movimientos" data-root="../">
 *   <aside class="sidebar" id="sidebar"></aside>
 *   <div class="topbar-actions" id="topbar-actions"></div>
 * y este archivo rellena el menú lateral, el botón de tema y el perfil,
 * además de mostrar la bienvenida la primera vez que se abre la app.
 */
(function () {
    'use strict';

    var NAV = [
        ['index', 'Dashboard', 'layout-dashboard'],
        ['movimientos', 'Movimientos', 'arrow-left-right'],
        ['presupuesto', 'Presupuesto', 'pie-chart'],
        ['metas', 'Metas', 'target'],
        ['reportes', 'Reportes', 'bar-chart'],
        ['herramientas', 'Herramientas', 'wrench'],
        ['configuracion', 'Configuración', 'settings']
    ];

    var body = document.body;
    var page = body.getAttribute('data-page') || '';
    var root = body.getAttribute('data-root') || '';

    function href(id) {
        return id === 'index' ? root + 'index.html' : (root ? '' : 'pages/') + id + '.html';
    }

    function renderSidebar() {
        var box = document.getElementById('sidebar');
        if (!box) return;
        box.innerHTML =
            '<div class="brand"><div class="brand-icon">$</div><span>DinDin</span></div>' +
            '<nav class="navigation" aria-label="Principal">' +
            NAV.map(function (n) {
                var active = n[0] === page;
                return '<a href="' + href(n[0]) + '" class="nav-item' + (active ? ' active' : '') + '" title="' + n[1] + '"' +
                       (active ? ' aria-current="page"' : '') + '>' +
                       '<span class="nav-icon" data-icon="' + n[2] + '"></span><span>' + n[1] + '</span></a>';
            }).join('') + '</nav>';
    }

    function renderTopbar() {
        var box = document.getElementById('topbar-actions');
        if (!box) return;
        var s = Store.settings.get();
        box.innerHTML =
            '<button class="icon-button theme-toggle" type="button" aria-label="Cambiar a modo oscuro" title="Cambiar a modo oscuro"></button>' +
            '<a class="user-profile" href="' + href('configuracion') + '" title="Ir a Configuración">' +
            '<div class="avatar"></div><div class="user-info"><strong></strong><span>Mi perfil</span></div></a>';
        updateProfile();
    }

    function updateProfile() {
        var a = document.querySelector('#topbar-actions .user-profile');
        if (!a) return;
        var s = Store.settings.get();
        a.querySelector('.avatar').textContent = Fmt.initials(s.nombre);
        a.querySelector('strong').textContent = s.nombre || 'Tu perfil';
    }

    /* ---------- Primera vez: bienvenida ---------- */
    function onboarding() {
        var monedas = Store.MONEDAS.map(function (m) {
            var nombres = { MXN: 'Peso mexicano (MXN)', USD: 'Dólar estadounidense (USD)', EUR: 'Euro (EUR)' };
            return '<option value="' + m + '">' + nombres[m] + '</option>';
        }).join('');

        var m = UI.modal({
            title: 'Te damos la bienvenida a DinDin',
            dismissable: false,
            focus: 'input[name="nombre"]',
            body:
                '<p class="modal-lead">Tus datos se guardan solo en este navegador. ' +
                'Podrás cambiar todo esto después en Configuración.</p>' +
                '<form id="onb" novalidate>' +
                '<label class="field">¿Cómo te llamas?<input name="nombre" maxlength="40" autocomplete="given-name" placeholder="Tu nombre"></label>' +
                '<label class="field">Moneda<select name="moneda">' + monedas + '</select></label>' +
                '<div class="modal-actions stacked">' +
                '<button type="submit" class="primary-button">Empezar desde cero</button>' +
                '<button type="button" class="secondary-button" id="onb-demo">Explorar con datos de ejemplo</button>' +
                '</div></form>'
        });

        var form = m.body.querySelector('#onb');
        function guardar() {
            Store.settings.set({ nombre: form.nombre.value, moneda: form.moneda.value, onboarded: true });
        }
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            guardar();
            m.close();
            UI.toast('Todo listo. Agrega tu primer movimiento para empezar.');
        });
        m.body.querySelector('#onb-demo').addEventListener('click', function () {
            guardar();
            Store.cargarDemo();
            m.close();
            UI.toast('Datos de ejemplo cargados. Puedes borrarlos en Configuración.', { duration: 6000 });
        });
    }

    renderSidebar();
    renderTopbar();
    window.addEventListener('store:change', function (e) {
        if (e.detail && (e.detail.collection === 'settings' || e.detail.collection === '*')) updateProfile();
    });

    if (!Store.settings.get().onboarded) onboarding();
    if (!Store.persistent()) {
        UI.toast('Tu navegador no permite guardar datos: se perderán al cerrar esta página.', { type: 'warning', duration: 10000 });
    }

    window.Layout = { href: href };
})();

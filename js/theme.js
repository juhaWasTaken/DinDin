(function () {
    var KEY = 'finanzas-theme';   // identificador interno: se conserva para no perder la preferencia guardada
    var root = document.documentElement;

    function stored() {
        try { var s = localStorage.getItem(KEY); return (s === 'dark' || s === 'light') ? s : null; } catch (e) { return null; }
    }
    function system() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function effective() { return stored() || system(); }

    function paint(theme) {
        var dark = theme === 'dark';
        root.setAttribute('data-theme', theme);
        document.querySelectorAll('.theme-toggle').forEach(function (btn) {
            var label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
            btn.innerHTML = window.Icons ? Icons.svg(dark ? 'sun' : 'moon') : (dark ? '\u2600' : '\u263E');
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
            btn.setAttribute('aria-pressed', String(dark));
        });
    }

    // Se aplica de inmediato (script en <head>) para evitar el parpadeo blanco.
    paint(effective());

    document.addEventListener('DOMContentLoaded', function () {
        paint(root.getAttribute('data-theme'));

        document.querySelectorAll('.theme-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                try { localStorage.setItem(KEY, next); } catch (e) {}
                paint(next);
            });
        });

        // En móvil el menú inferior se desplaza: dejar visible la página actual.
        var active = document.querySelector('.navigation .nav-item.active');
        if (active && window.matchMedia('(max-width: 700px)').matches) {
            var nav = active.parentElement;
            nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
        }
    });

    // Mantener sincronizadas varias pestañas abiertas.
    window.addEventListener('storage', function (e) {
        if (e.key === KEY) paint(effective());
    });

    // Sin preferencia guardada, seguir al sistema operativo en vivo.
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        var onChange = function () { if (!stored()) paint(system()); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
    }

    /* API: Theme.get() → 'system' | 'light' | 'dark' · Theme.set('system'|'light'|'dark') */
    window.Theme = {
        get: function () { return stored() || 'system'; },
        set: function (v) {
            try {
                if (v === 'light' || v === 'dark') localStorage.setItem(KEY, v);
                else localStorage.removeItem(KEY);
            } catch (e) {}
            paint(effective());
        }
    };
})();

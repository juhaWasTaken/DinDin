/*
 * store.js — Capa de datos de DinDin.
 *
 * Todo el almacenamiento pasa por aquí. Las páginas nunca tocan localStorage
 * directamente: usan Store.movimientos.add(...), Store.totales(...), etc.
 * Cuando llegue PHP + base de datos, solo cambia el interior de este archivo
 * (las mismas funciones harán fetch() al servidor) y las páginas no se tocan.
 *
 * Cada cambio dispara el evento  window  'store:change'  ({detail:{collection}})
 * para que las páginas se vuelvan a dibujar solas (también entre pestañas).
 *
 * Exporta: window.Store y window.Fmt (formato de dinero, fechas y escape HTML).
 */
(function () {
    'use strict';

    // Identificador interno del almacenamiento. NO se renombra con la marca: cambiarlo dejaría
    // «huérfanos» los datos ya guardados en el navegador de cada persona.
    var KEY = 'finanzas:v1';
    var APP = 'dindin';                      // marca que se escribe en los respaldos
    var APPS_VALIDAS = ['dindin', 'finanzas'];   // 'finanzas' = respaldos hechos antes del cambio de nombre
    var MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var METODOS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Otro'];
    var MONEDAS = ['MXN', 'USD', 'EUR'];
    var PERIODOS = [
        ['mes', 'Este mes'],
        ['mes-anterior', 'Mes anterior'],
        ['3meses', 'Últimos 3 meses'],
        ['anio', 'Este año'],
        ['todo', 'Todo el historial']
    ];
    var ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
    var persistent = true;
    var seq = 0;

    /* ---------------------------------------------------------------
       Utilidades
    --------------------------------------------------------------- */
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function today() { return iso(new Date()); }
    function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function validISO(s) { return typeof s === 'string' && ISO_RE.test(s) && iso(parseISO(s)) === s; }
    function round2(n) { return Math.round(n * 100) / 100; }
    function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
    function str(v, max) { return (typeof v === 'string' ? v : '').trim().slice(0, max); }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    /* ---------------------------------------------------------------
       Datos base
    --------------------------------------------------------------- */
    function defaultCategorias() {
        return [
            { id: 'alimentacion', nombre: 'Alimentación', emoji: '🍴', tipo: 'gasto', limite: 0 },
            { id: 'transporte', nombre: 'Transporte', emoji: '🚗', tipo: 'gasto', limite: 0 },
            { id: 'vivienda', nombre: 'Vivienda', emoji: '🏠', tipo: 'gasto', limite: 0 },
            { id: 'entretenimiento', nombre: 'Entretenimiento', emoji: '🎮', tipo: 'gasto', limite: 0 },
            { id: 'educacion', nombre: 'Educación', emoji: '📚', tipo: 'gasto', limite: 0 },
            { id: 'salud', nombre: 'Salud', emoji: '🩺', tipo: 'gasto', limite: 0 },
            { id: 'otros-gasto', nombre: 'Otros', emoji: '📦', tipo: 'gasto', limite: 0 },
            { id: 'salario', nombre: 'Salario', emoji: '💼', tipo: 'ingreso', limite: 0 },
            { id: 'trabajo', nombre: 'Trabajo freelance', emoji: '💻', tipo: 'ingreso', limite: 0 },
            { id: 'otros-ingreso', nombre: 'Otros', emoji: '💰', tipo: 'ingreso', limite: 0 }
        ];
    }

    function emptyData() {
        return {
            app: APP,
            version: 1,
            settings: {
                nombre: '',
                moneda: 'MXN',
                saldoInicial: 0,
                onboarded: false,
                ultimoRespaldo: null,
                notificaciones: { presupuesto: true, pagos: true }
            },
            categorias: defaultCategorias(),
            movimientos: [],
            metas: [],
            pagos: []
        };
    }

    /* Limpia y valida cualquier dato que venga de localStorage o de un archivo importado. */
    function sanitize(raw) {
        if (!raw || typeof raw !== 'object') return null;
        var d = emptyData();
        var s = raw.settings || {};
        d.settings.nombre = str(s.nombre, 40);
        d.settings.moneda = MONEDAS.indexOf(s.moneda) >= 0 ? s.moneda : 'MXN';
        d.settings.saldoInicial = round2(num(s.saldoInicial));
        d.settings.onboarded = !!s.onboarded;
        d.settings.ultimoRespaldo = str(s.ultimoRespaldo, 30) || null;
        var n = s.notificaciones || {};
        d.settings.notificaciones = { presupuesto: n.presupuesto !== false, pagos: n.pagos !== false };

        if (Array.isArray(raw.categorias) && raw.categorias.length) {
            var seen = {};
            d.categorias = [];
            raw.categorias.forEach(function (c) {
                if (!c || c.id == null) return;
                var id = str(String(c.id), 40);
                if (!id || seen[id]) return;
                seen[id] = true;
                d.categorias.push({
                    id: id,
                    nombre: str(c.nombre, 30) || 'Sin nombre',
                    emoji: str(c.emoji, 12) || '📦',
                    tipo: c.tipo === 'ingreso' ? 'ingreso' : 'gasto',
                    limite: Math.max(0, round2(num(c.limite)))
                });
            });
        }
        var byId = {};
        d.categorias.forEach(function (c) { byId[c.id] = c; });
        defaultCategorias().forEach(function (c) {
            if ((c.id === 'otros-gasto' || c.id === 'otros-ingreso') && !byId[c.id]) { d.categorias.push(c); byId[c.id] = c; }
        });

        var seenM = {};
        (Array.isArray(raw.movimientos) ? raw.movimientos : []).forEach(function (m) {
            if (!m || typeof m !== 'object') return;
            var tipo = m.tipo === 'ingreso' ? 'ingreso' : (m.tipo === 'gasto' ? 'gasto' : null);
            var monto = round2(num(m.monto));
            if (!tipo || !(monto > 0) || !validISO(m.fecha)) return;
            var cat = byId[m.categoriaId];
            var id = str(String(m.id == null ? '' : m.id), 40) || uid();
            if (seenM[id]) id = uid();
            seenM[id] = true;
            d.movimientos.push({
                id: id, tipo: tipo, monto: monto,
                categoriaId: cat && cat.tipo === tipo ? cat.id : 'otros-' + tipo,
                fecha: m.fecha,
                descripcion: str(m.descripcion, 80) || 'Sin descripción',
                metodo: METODOS.indexOf(m.metodo) >= 0 ? m.metodo : 'Otro',
                nota: str(m.nota, 200),
                creado: num(m.creado) || Date.now()
            });
        });

        (Array.isArray(raw.metas) ? raw.metas : []).forEach(function (g) {
            if (!g || typeof g !== 'object') return;
            var objetivo = round2(num(g.objetivo));
            if (!(objetivo > 0)) return;
            var aportes = [];
            (Array.isArray(g.aportes) ? g.aportes : []).forEach(function (a) {
                if (!a) return;
                var mo = round2(num(a.monto));
                if (!mo || !validISO(a.fecha)) return;
                aportes.push({ id: str(String(a.id || uid()), 40), fecha: a.fecha, monto: mo, nota: str(a.nota, 100) });
            });
            d.metas.push({
                id: str(String(g.id || uid()), 40),
                nombre: str(g.nombre, 50) || 'Meta',
                emoji: str(g.emoji, 12) || '🎯',
                objetivo: objetivo,
                fecha: validISO(g.fecha) ? g.fecha : '',
                aportes: aportes,
                creado: num(g.creado) || Date.now()
            });
        });

        (Array.isArray(raw.pagos) ? raw.pagos : []).forEach(function (p) {
            if (!p || typeof p !== 'object') return;
            var monto = round2(num(p.monto));
            if (!(monto > 0)) return;
            d.pagos.push({
                id: str(String(p.id || uid()), 40),
                nombre: str(p.nombre, 50) || 'Pago',
                emoji: str(p.emoji, 12) || '💳',
                monto: monto,
                categoriaId: str(String(p.categoriaId || ''), 40),
                frecuencia: ['mensual', 'semanal', 'anual'].indexOf(p.frecuencia) >= 0 ? p.frecuencia : 'mensual',
                dia: Math.min(31, Math.max(1, parseInt(p.dia, 10) || 1)),
                activo: p.activo !== false,
                ultimoPago: validISO(p.ultimoPago) ? p.ultimoPago : ''
            });
        });
        return d;
    }

    /* ---------------------------------------------------------------
       Persistencia
    --------------------------------------------------------------- */
    function load() {
        var raw = null;
        try { raw = localStorage.getItem(KEY); } catch (e) { persistent = false; }
        if (raw) {
            try {
                var d = sanitize(JSON.parse(raw));
                if (d) return d;
            } catch (e) {
                // Datos dañados: se conserva una copia aparte antes de empezar de cero.
                try { localStorage.setItem(KEY + ':dañado', raw); } catch (_) {}
            }
        }
        return emptyData();
    }

    var data = load();

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(data)); persistent = true; }
        catch (e) { persistent = false; }
    }

    function dispatch(collection) {
        try { window.dispatchEvent(new CustomEvent('store:change', { detail: { collection: collection } })); } catch (e) {}
    }

    function emit(collection) { save(); dispatch(collection); }

    window.addEventListener('storage', function (e) {
        if (e.key === KEY) { data = load(); dispatch('*'); }
    });

    /* ---------------------------------------------------------------
       Categorías
    --------------------------------------------------------------- */
    var categorias = {
        list: function (tipo) {
            return data.categorias.filter(function (c) { return !tipo || c.tipo === tipo; }).map(clone);
        },
        get: function (id) {
            for (var i = 0; i < data.categorias.length; i++) {
                if (data.categorias[i].id === id) return clone(data.categorias[i]);
            }
            return null;
        }
    };

    /* ---------------------------------------------------------------
       Movimientos
    --------------------------------------------------------------- */
    function validarMovimiento(o) {
        var e = {}, v = {};
        v.tipo = o.tipo === 'ingreso' ? 'ingreso' : (o.tipo === 'gasto' ? 'gasto' : null);
        if (!v.tipo) e.tipo = 'Elige si es un ingreso o un gasto.';

        var monto = Number(o.monto);
        if (o.monto === '' || o.monto == null || !isFinite(monto)) e.monto = 'Escribe un monto válido.';
        else if (monto <= 0) e.monto = 'El monto debe ser mayor que cero.';
        else if (monto > 999999999) e.monto = 'El monto es demasiado grande.';
        v.monto = round2(isFinite(monto) ? monto : 0);

        v.descripcion = str(o.descripcion, 80);
        if (!v.descripcion) e.descripcion = 'Escribe una descripción.';

        var cat = categorias.get(o.categoriaId);
        if (!cat || (v.tipo && cat.tipo !== v.tipo)) e.categoriaId = 'Elige una categoría.';
        v.categoriaId = o.categoriaId;

        if (!validISO(o.fecha)) e.fecha = 'Elige una fecha válida.';
        v.fecha = o.fecha;

        v.metodo = METODOS.indexOf(o.metodo) >= 0 ? o.metodo : 'Otro';
        v.nota = str(o.nota, 200);
        return { ok: Object.keys(e).length === 0, errors: e, value: v };
    }

    function findIndex(id) {
        for (var i = 0; i < data.movimientos.length; i++) if (data.movimientos[i].id === id) return i;
        return -1;
    }

    var movimientos = {
        /* filtros: {desde, hasta, tipo, categoriaId, q} — más recientes primero */
        list: function (f) {
            f = f || {};
            var q = (f.q || '').trim().toLowerCase();
            var res = data.movimientos.filter(function (m) {
                if (f.desde && m.fecha < f.desde) return false;
                if (f.hasta && m.fecha > f.hasta) return false;
                if (f.tipo && m.tipo !== f.tipo) return false;
                if (f.categoriaId && m.categoriaId !== f.categoriaId) return false;
                if (q) {
                    var c = categorias.get(m.categoriaId);
                    var hay = (m.descripcion + ' ' + m.nota + ' ' + (c ? c.nombre : '') + ' ' + m.metodo).toLowerCase();
                    if (hay.indexOf(q) < 0) return false;
                }
                return true;
            });
            res.sort(function (a, b) {
                if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
                return (b.creado || 0) - (a.creado || 0);
            });
            return res.map(clone);
        },
        get: function (id) { var i = findIndex(id); return i < 0 ? null : clone(data.movimientos[i]); },
        add: function (o) {
            var r = validarMovimiento(o);
            if (!r.ok) return { ok: false, errors: r.errors };
            var m = r.value;
            m.id = uid();
            m.creado = Date.now();
            data.movimientos.push(m);
            emit('movimientos');
            return { ok: true, value: clone(m) };
        },
        update: function (id, o) {
            var i = findIndex(id);
            if (i < 0) return { ok: false, errors: { _: 'El movimiento ya no existe.' } };
            var r = validarMovimiento(o);
            if (!r.ok) return { ok: false, errors: r.errors };
            var old = data.movimientos[i];
            r.value.id = old.id;
            r.value.creado = old.creado;
            data.movimientos[i] = r.value;
            emit('movimientos');
            return { ok: true, value: clone(r.value) };
        },
        remove: function (id) {
            var i = findIndex(id);
            if (i < 0) return null;
            var m = data.movimientos.splice(i, 1)[0];
            emit('movimientos');
            return clone(m);
        },
        restore: function (m) {
            if (!m || findIndex(m.id) >= 0) return;
            data.movimientos.push(clone(m));
            emit('movimientos');
        }
    };

    /* ---------------------------------------------------------------
       Metas (los métodos de alta, edición y aportes se definen más abajo)
    --------------------------------------------------------------- */
    var metas = {
        list: function () { return data.metas.map(clone); },
        ahorrado: function (g) {
            return round2((g.aportes || []).reduce(function (a, x) { return a + x.monto; }, 0));
        },
        totalAhorrado: function () {
            return round2(data.metas.reduce(function (a, g) { return a + metas.ahorrado(g); }, 0));
        }
    };

    /* ---------------------------------------------------------------
       Ajustes
    --------------------------------------------------------------- */
    var settings = {
        get: function () { return clone(data.settings); },
        set: function (p) {
            var s = data.settings;
            if ('nombre' in p) s.nombre = str(p.nombre, 40);
            if ('moneda' in p && MONEDAS.indexOf(p.moneda) >= 0) s.moneda = p.moneda;
            if ('saldoInicial' in p) s.saldoInicial = round2(num(p.saldoInicial));
            if ('onboarded' in p) s.onboarded = !!p.onboarded;
            if (p.notificaciones) {
                s.notificaciones.presupuesto = !!p.notificaciones.presupuesto;
                s.notificaciones.pagos = !!p.notificaciones.pagos;
            }
            emit('settings');
        }
    };

    /* ---------------------------------------------------------------
       Cálculos (todo lo que se muestra sale de aquí, nunca se escribe a mano)
    --------------------------------------------------------------- */
    function rango(p) {
        var now = new Date(), y = now.getFullYear(), m = now.getMonth();
        switch (p) {
            case 'mes': return { desde: iso(new Date(y, m, 1)), hasta: iso(new Date(y, m + 1, 0)), etiqueta: 'Este mes' };
            case 'mes-anterior': return { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)), etiqueta: 'Mes anterior' };
            case '3meses': return { desde: iso(new Date(y, m - 2, 1)), hasta: iso(new Date(y, m + 1, 0)), etiqueta: 'Últimos 3 meses' };
            case 'anio': return { desde: y + '-01-01', hasta: y + '-12-31', etiqueta: 'Este año' };
            default: return { desde: null, hasta: null, etiqueta: 'Todo el historial' };
        }
    }

    function totales(list) {
        var i = 0, g = 0;
        list.forEach(function (m) { if (m.tipo === 'ingreso') i += m.monto; else g += m.monto; });
        i = round2(i); g = round2(g);
        return { ingresos: i, gastos: g, balance: round2(i - g) };
    }

    function balanceTotal() {
        return round2(data.settings.saldoInicial + totales(data.movimientos).balance);
    }

    function porCategoria(list, tipo) {
        var map = {}, cuenta = {};
        list.forEach(function (m) {
            if (m.tipo !== tipo) return;
            map[m.categoriaId] = (map[m.categoriaId] || 0) + m.monto;
            cuenta[m.categoriaId] = (cuenta[m.categoriaId] || 0) + 1;
        });
        return Object.keys(map).map(function (id) {
            return { categoria: categorias.get(id) || { id: id, nombre: 'Otros', emoji: '📦' }, total: round2(map[id]), movimientos: cuenta[id] };
        }).sort(function (a, b) { return b.total - a.total; });
    }

    function serieMensual(n) {
        var now = new Date(), out = [];
        for (var k = n - 1; k >= 0; k--) {
            var d = new Date(now.getFullYear(), now.getMonth() - k, 1);
            var key = d.getFullYear() + '-' + pad(d.getMonth() + 1);
            var t = totales(data.movimientos.filter(function (m) { return m.fecha.slice(0, 7) === key; }));
            out.push({ clave: key, etiqueta: MESES[d.getMonth()], ingresos: t.ingresos, gastos: t.gastos });
        }
        return out;
    }

    function limitePresupuesto() {
        return round2(data.categorias.reduce(function (a, c) { return a + (c.tipo === 'gasto' ? c.limite : 0); }, 0));
    }

    /* ---------------------------------------------------------------
       Respaldo, importación, reinicio y datos de ejemplo
    --------------------------------------------------------------- */
    function exportar() {
        data.settings.ultimoRespaldo = new Date().toISOString();
        save();
        dispatch('settings');
        var out = { app: APP, version: 1, exportado: data.settings.ultimoRespaldo };
        ['settings', 'categorias', 'movimientos', 'metas', 'pagos'].forEach(function (k) { out[k] = data[k]; });
        return JSON.stringify(out, null, 2);
    }

    function importar(texto) {
        var obj;
        try { obj = JSON.parse(texto); } catch (e) { return { ok: false, error: 'El archivo no es un JSON válido.' }; }
        if (!obj || APPS_VALIDAS.indexOf(obj.app) < 0) return { ok: false, error: 'El archivo no parece ser una copia de seguridad de DinDin.' };
        var d = sanitize(obj);
        if (!d) return { ok: false, error: 'No se pudo leer el contenido del archivo.' };
        d.settings.onboarded = true;
        data = d;
        emit('*');
        return { ok: true, movimientos: d.movimientos.length, metas: d.metas.length };
    }

    function reiniciar() {
        var s = data.settings;
        data = emptyData();
        data.settings.nombre = s.nombre;
        data.settings.moneda = s.moneda;
        data.settings.notificaciones = s.notificaciones;
        data.settings.onboarded = true;
        emit('*');
    }

    /* Datos de ejemplo: 6 meses relativos a HOY, para que "Este mes" siempre tenga contenido. */
    function demoData() {
        var d = emptyData();
        d.settings = clone(data.settings);
        d.settings.onboarded = true;
        var lim = { alimentacion: 3000, transporte: 1500, vivienda: 5000, entretenimiento: 1000, educacion: 2000 };
        d.categorias.forEach(function (c) { if (lim[c.id]) c.limite = lim[c.id]; });

        var now = new Date(), y = now.getFullYear(), m = now.getMonth(), elapsed = now.getDate();
        var s1 = [850, 790, 910, 880, 830, 860], s2 = [920, 870, 800, 950, 890, 910], s3 = [780, 840, 760, 810, 900, 820];
        var fuera = [380, 420, 350, 400, 390, 410], free = [1200, 1500, 1200];

        for (var k = 0; k < 6; k++) {
            (function (k) {
                var first = new Date(y, m - (5 - k), 1);
                var last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
                var maxDay = k === 5 ? Math.min(elapsed, last) : last;
                function add(day, tipo, desc, cat, monto, metodo) {
                    d.movimientos.push({
                        id: uid(), tipo: tipo, monto: monto, categoriaId: cat,
                        fecha: iso(new Date(first.getFullYear(), first.getMonth(), Math.min(day, maxDay))),
                        descripcion: desc, metodo: metodo, nota: '', creado: Date.now() + (seq++)
                    });
                }
                add(1, 'gasto', 'Renta', 'vivienda', 3500, 'Transferencia');
                add(3, 'gasto', 'Internet', 'vivienda', 499, 'Tarjeta');
                add(5, 'gasto', 'Supermercado', 'alimentacion', s1[k], 'Tarjeta');
                add(8, 'gasto', 'Transporte semanal', 'transporte', 300, 'Efectivo');
                add(10, 'gasto', 'Suscripción de streaming', 'entretenimiento', 199, 'Tarjeta');
                add(12, 'gasto', 'Comida fuera', 'alimentacion', fuera[k], 'Tarjeta');
                add(15, 'ingreso', 'Pago de nómina', 'salario', 21500, 'Transferencia');
                add(16, 'gasto', 'Supermercado', 'alimentacion', s2[k], 'Tarjeta');
                add(17, 'gasto', 'Transporte semanal', 'transporte', 300, 'Efectivo');
                add(22, 'gasto', 'Supermercado', 'alimentacion', s3[k], 'Tarjeta');
                if (k % 2 === 1) add(18, 'ingreso', 'Proyecto freelance', 'trabajo', free[(k - 1) / 2], 'Transferencia');
                if (k % 2 === 0) add(14, 'gasto', 'Curso en línea', 'educacion', 530, 'Tarjeta');
                if (k % 3 === 1) add(20, 'gasto', 'Cine y salida', 'entretenimiento', 450, 'Efectivo');
                if (k % 3 === 0) add(24, 'gasto', 'Medicinas', 'salud', 260, 'Efectivo');
            })(k);
        }

        function goal(nombre, emoji, objetivo, ahorrado, meses) {
            d.metas.push({
                id: uid(), nombre: nombre, emoji: emoji, objetivo: objetivo,
                fecha: iso(new Date(y, m + meses, Math.min(now.getDate(), 28))),
                aportes: [{ id: uid(), fecha: iso(now), monto: ahorrado, nota: 'Ahorro acumulado' }],
                creado: Date.now() + (seq++)
            });
        }
        goal('Título universitario', '🎓', 9100, 9100, 2);
        goal('Nuevo teléfono', '📱', 20000, 8500, 3);
        goal('Viaje', '✈️', 15000, 6200, 6);
        goal('Fondo de emergencia', '🛡️', 30000, 12000, 9);
        return d;
    }

    function cargarDemo() { data = demoData(); emit('*'); }

    /* ---------------------------------------------------------------
       Categorías: alta, edición y baja
    --------------------------------------------------------------- */
    var MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    function findCat(id) {
        for (var i = 0; i < data.categorias.length; i++) if (data.categorias[i].id === id) return data.categorias[i];
        return null;
    }

    function validarCategoria(o, id) {
        var e = {}, v = {};
        v.nombre = str(o.nombre, 30);
        if (!v.nombre) e.nombre = 'Escribe un nombre.';
        v.emoji = str(o.emoji, 12) || '📦';
        v.tipo = o.tipo === 'ingreso' ? 'ingreso' : 'gasto';
        var lim = (o.limite === '' || o.limite == null) ? 0 : Number(o.limite);
        if (!isFinite(lim) || lim < 0) e.limite = 'Escribe un monto válido o déjalo vacío.';
        else if (lim > 999999999) e.limite = 'El monto es demasiado grande.';
        v.limite = v.tipo === 'gasto' && isFinite(lim) ? round2(Math.max(0, lim)) : 0;
        if (v.nombre) {
            var dup = data.categorias.some(function (c) {
                return c.id !== id && c.tipo === v.tipo && c.nombre.toLowerCase() === v.nombre.toLowerCase();
            });
            if (dup) e.nombre = 'Ya existe una categoría con ese nombre.';
        }
        return { ok: Object.keys(e).length === 0, errors: e, value: v };
    }

    categorias.add = function (o) {
        var r = validarCategoria(o, null);
        if (!r.ok) return { ok: false, errors: r.errors };
        var c = r.value;
        c.id = 'c-' + uid();
        data.categorias.push(c);
        emit('categorias');
        return { ok: true, value: clone(c) };
    };

    categorias.update = function (id, o) {
        var c = findCat(id);
        if (!c) return { ok: false, errors: { _: 'La categoría ya no existe.' } };
        var r = validarCategoria({ nombre: o.nombre, emoji: o.emoji, limite: o.limite, tipo: c.tipo }, id);
        if (!r.ok) return { ok: false, errors: r.errors };
        c.nombre = r.value.nombre; c.emoji = r.value.emoji; c.limite = r.value.limite;
        emit('categorias');
        return { ok: true, value: clone(c) };
    };

    /* Al eliminar una categoría, sus movimientos pasan a «Otros». Devuelve un snapshot para deshacer. */
    categorias.remove = function (id) {
        if (id === 'otros-gasto' || id === 'otros-ingreso') return { ok: false, error: 'La categoría «Otros» no se puede eliminar.' };
        var idx = -1;
        for (var i = 0; i < data.categorias.length; i++) if (data.categorias[i].id === id) idx = i;
        if (idx < 0) return { ok: false, error: 'La categoría ya no existe.' };
        var cat = data.categorias.splice(idx, 1)[0];
        var destino = 'otros-' + cat.tipo, movIds = [], pagoIds = [];
        data.movimientos.forEach(function (m) { if (m.categoriaId === id) { m.categoriaId = destino; movIds.push(m.id); } });
        data.pagos.forEach(function (p) { if (p.categoriaId === id) { p.categoriaId = destino; pagoIds.push(p.id); } });
        emit('categorias');
        return { ok: true, snapshot: { categoria: clone(cat), index: idx, movIds: movIds, pagoIds: pagoIds } };
    };

    categorias.restore = function (snap) {
        if (!snap || findCat(snap.categoria.id)) return;
        data.categorias.splice(Math.min(snap.index, data.categorias.length), 0, clone(snap.categoria));
        data.movimientos.forEach(function (m) { if (snap.movIds.indexOf(m.id) >= 0) m.categoriaId = snap.categoria.id; });
        data.pagos.forEach(function (p) { if (snap.pagoIds.indexOf(p.id) >= 0) p.categoriaId = snap.categoria.id; });
        emit('categorias');
    };

    /* ---------------------------------------------------------------
       Presupuesto mensual (los límites viven en cada categoría de gasto
       y se aplican igual a todos los meses)
    --------------------------------------------------------------- */
    function mesClave(offset) {
        var d = new Date();
        d = new Date(d.getFullYear(), d.getMonth() + (offset || 0), 1);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    }
    function mesRango(clave) {
        var p = clave.split('-'), y = +p[0], m = +p[1] - 1;
        return { desde: iso(new Date(y, m, 1)), hasta: iso(new Date(y, m + 1, 0)) };
    }
    function mesEtiqueta(clave) { var p = clave.split('-'); return MESES_LARGO[+p[1] - 1] + ' ' + p[0]; }

    function presupuestoMes(clave) {
        var r = mesRango(clave);
        var gastos = movimientos.list({ desde: r.desde, hasta: r.hasta, tipo: 'gasto' });
        var suma = {}, cuenta = {};
        gastos.forEach(function (m) {
            suma[m.categoriaId] = (suma[m.categoriaId] || 0) + m.monto;
            cuenta[m.categoriaId] = (cuenta[m.categoriaId] || 0) + 1;
        });

        var filas = data.categorias.filter(function (c) { return c.tipo === 'gasto'; }).map(function (c) {
            var gastado = round2(suma[c.id] || 0);
            var pct = c.limite > 0 ? gastado / c.limite * 100 : 0;
            return {
                categoria: clone(c), limite: c.limite, gastado: gastado, movimientos: cuenta[c.id] || 0,
                disponible: round2(c.limite - gastado), pct: pct,
                // «Excedido» solo si se pasa del límite; gastar exactamente el límite es 100% usado, no excedido.
                estado: c.limite > 0 ? (gastado > c.limite ? 'over' : (pct >= 80 ? 'warn' : 'ok')) : 'sin'
            };
        });
        filas.sort(function (a, b) {
            var ra = a.limite > 0 ? 0 : (a.gastado > 0 ? 1 : 2), rb = b.limite > 0 ? 0 : (b.gastado > 0 ? 1 : 2);
            if (ra !== rb) return ra - rb;
            return ra === 0 ? b.pct - a.pct : b.gastado - a.gastado;
        });

        var limiteTotal = 0, gastado = 0, sinLimite = 0;
        filas.forEach(function (f) {
            if (f.limite > 0) { limiteTotal += f.limite; gastado += f.gastado; } else sinLimite += f.gastado;
        });
        limiteTotal = round2(limiteTotal); gastado = round2(gastado); sinLimite = round2(sinLimite);
        return {
            clave: clave, etiqueta: mesEtiqueta(clave), filas: filas,
            limiteTotal: limiteTotal, gastado: gastado, gastadoSinLimite: sinLimite, gastadoTotal: round2(gastado + sinLimite),
            disponible: round2(limiteTotal - gastado), pct: limiteTotal > 0 ? gastado / limiteTotal * 100 : 0
        };
    }

    /* Sugerencia: promedio de los últimos 3 meses completos (o del mes actual si no hay historial), redondeado hacia arriba a 50. */
    function sugerirLimites() {
        var sums = {}, meses = 0, k, base = 'historial';
        for (k = 1; k <= 3; k++) {
            var r = mesRango(mesClave(-k));
            var ms = movimientos.list({ desde: r.desde, hasta: r.hasta, tipo: 'gasto' });
            if (ms.length) { meses++; ms.forEach(function (m) { sums[m.categoriaId] = (sums[m.categoriaId] || 0) + m.monto; }); }
        }
        var div = meses;
        if (!div) {
            var rc = mesRango(mesClave(0));
            movimientos.list({ desde: rc.desde, hasta: rc.hasta, tipo: 'gasto' }).forEach(function (m) { sums[m.categoriaId] = (sums[m.categoriaId] || 0) + m.monto; });
            div = 1; base = 'mes-actual';
        }
        var out = {};
        Object.keys(sums).forEach(function (id) {
            var c = findCat(id);
            if (c && c.tipo === 'gasto') out[id] = Math.max(50, Math.ceil(sums[id] / div / 50) * 50);
        });
        return { limites: out, meses: base === 'historial' ? meses : 0, base: base };
    }

    /* Aplica límites {idCategoria: monto}. Devuelve los valores anteriores para poder deshacer. */
    function aplicarLimites(map) {
        var prev = {};
        data.categorias.forEach(function (c) {
            if (c.tipo === 'gasto' && Object.prototype.hasOwnProperty.call(map, c.id)) {
                prev[c.id] = c.limite;
                c.limite = Math.max(0, round2(num(map[c.id])));
            }
        });
        emit('categorias');
        return prev;
    }

    /* ---------------------------------------------------------------
       Metas: alta, edición, baja y aportes
    --------------------------------------------------------------- */
    function findMeta(id) {
        for (var i = 0; i < data.metas.length; i++) if (data.metas[i].id === id) return data.metas[i];
        return null;
    }

    function validarMeta(o) {
        var e = {}, v = {};
        v.nombre = str(o.nombre, 50);
        if (!v.nombre) e.nombre = 'Escribe un nombre para tu meta.';
        v.emoji = str(o.emoji, 12) || '🎯';
        var ob = Number(o.objetivo);
        if (o.objetivo === '' || o.objetivo == null || !isFinite(ob)) e.objetivo = 'Escribe cuánto quieres reunir.';
        else if (ob <= 0) e.objetivo = 'El objetivo debe ser mayor que cero.';
        else if (ob > 999999999) e.objetivo = 'El monto es demasiado grande.';
        v.objetivo = round2(isFinite(ob) ? ob : 0);
        if (o.fecha === '' || o.fecha == null) v.fecha = '';
        else if (!validISO(o.fecha)) e.fecha = 'Elige una fecha válida.';
        else v.fecha = o.fecha;
        var ini = (o.inicial === '' || o.inicial == null) ? 0 : Number(o.inicial);
        if (!isFinite(ini) || ini < 0) e.inicial = 'Escribe un monto válido o déjalo vacío.';
        v.inicial = isFinite(ini) && ini > 0 ? round2(ini) : 0;
        return { ok: Object.keys(e).length === 0, errors: e, value: v };
    }

    metas.get = function (id) { var g = findMeta(id); return g ? clone(g) : null; };

    metas.add = function (o) {
        var r = validarMeta(o);
        if (!r.ok) return { ok: false, errors: r.errors };
        var v = r.value;
        var g = { id: uid(), nombre: v.nombre, emoji: v.emoji, objetivo: v.objetivo, fecha: v.fecha, aportes: [], creado: Date.now() };
        if (v.inicial > 0) g.aportes.push({ id: uid(), fecha: today(), monto: v.inicial, nota: 'Ahorro inicial' });
        data.metas.push(g);
        emit('metas');
        return { ok: true, value: clone(g) };
    };

    metas.update = function (id, o) {
        var g = findMeta(id);
        if (!g) return { ok: false, errors: { _: 'La meta ya no existe.' } };
        var r = validarMeta({ nombre: o.nombre, emoji: o.emoji, objetivo: o.objetivo, fecha: o.fecha });
        if (!r.ok) return { ok: false, errors: r.errors };
        g.nombre = r.value.nombre; g.emoji = r.value.emoji; g.objetivo = r.value.objetivo; g.fecha = r.value.fecha;
        emit('metas');
        return { ok: true, value: clone(g) };
    };

    metas.remove = function (id) {
        for (var i = 0; i < data.metas.length; i++) {
            if (data.metas[i].id === id) { var g = data.metas.splice(i, 1)[0]; emit('metas'); return clone(g); }
        }
        return null;
    };

    metas.restore = function (g) {
        if (!g || findMeta(g.id)) return;
        data.metas.push(clone(g));
        emit('metas');
    };

    /* monto > 0 aporta, monto < 0 retira. */
    metas.addAporte = function (id, o) {
        var g = findMeta(id);
        if (!g) return { ok: false, errors: { _: 'La meta ya no existe.' } };
        var e = {}, mo = Number(o.monto);
        if (o.monto === '' || o.monto == null || !isFinite(mo) || mo === 0) e.monto = 'Escribe un monto distinto de cero.';
        else if (Math.abs(mo) > 999999999) e.monto = 'El monto es demasiado grande.';
        if (!validISO(o.fecha)) e.fecha = 'Elige una fecha válida.';
        var antes = metas.ahorrado(g);
        if (!e.monto && antes + mo < 0) e.monto = 'No puedes retirar más de lo ahorrado (' + window.Fmt.money(antes) + ').';
        if (Object.keys(e).length) return { ok: false, errors: e };
        var a = { id: uid(), fecha: o.fecha, monto: round2(mo), nota: str(o.nota, 100) };
        g.aportes.push(a);
        emit('metas');
        return { ok: true, value: clone(a), completada: antes < g.objetivo && metas.ahorrado(g) >= g.objetivo };
    };

    metas.removeAporte = function (id, aid) {
        var g = findMeta(id);
        if (!g) return { ok: false, error: 'La meta ya no existe.' };
        for (var i = 0; i < g.aportes.length; i++) {
            if (g.aportes[i].id === aid) {
                if (metas.ahorrado(g) - g.aportes[i].monto < 0) return { ok: false, error: 'No se puede eliminar: el saldo de la meta quedaría negativo.' };
                var a = g.aportes.splice(i, 1)[0];
                emit('metas');
                return { ok: true, value: clone(a) };
            }
        }
        return { ok: false, error: 'El registro ya no existe.' };
    };

    metas.restoreAporte = function (id, a) {
        var g = findMeta(id);
        if (!g || !a) return;
        for (var i = 0; i < g.aportes.length; i++) if (g.aportes[i].id === a.id) return;
        g.aportes.push(clone(a));
        emit('metas');
    };

    /* Estado calculado de una meta (nunca se guarda: se deriva de los aportes). */
    metas.estado = function (g) {
        var ah = metas.ahorrado(g);
        var completada = ah >= g.objetivo;
        var out = {
            ahorrado: ah, restante: Math.max(0, round2(g.objetivo - ah)),
            pct: Math.max(0, Math.min(100, ah / g.objetivo * 100)),
            completada: completada, vencida: false, diasRestantes: null, mensualSugerido: 0
        };
        if (g.fecha) {
            var dias = Math.round((parseISO(g.fecha) - parseISO(today())) / 86400000);
            out.diasRestantes = dias;
            if (!completada) {
                if (dias < 0) out.vencida = true;
                else {
                    var meses = dias / 30.4375;
                    out.mensualSugerido = meses < 1 ? out.restante : Math.ceil(out.restante / meses);
                }
            }
        }
        return out;
    };

    metas.resumen = function () {
        var r = { ahorrado: 0, objetivo: 0, restante: 0, activas: 0, completadas: 0, pct: 0 }, capado = 0;
        data.metas.forEach(function (g) {
            var e = metas.estado(g);
            r.ahorrado += e.ahorrado; r.objetivo += g.objetivo; r.restante += e.restante;
            capado += Math.min(e.ahorrado, g.objetivo);
            if (e.completada) r.completadas++; else r.activas++;
        });
        r.ahorrado = round2(r.ahorrado); r.objetivo = round2(r.objetivo); r.restante = round2(r.restante);
        r.pct = r.objetivo > 0 ? capado / r.objetivo * 100 : 0;
        return r;
    };

    /* ---------------------------------------------------------------
       Reportes
    --------------------------------------------------------------- */
    var PERIODOS_REPORTE = [
        ['mes', 'Este mes'], ['mes-anterior', 'Mes anterior'], ['3meses', 'Últimos 3 meses'],
        ['6meses', 'Últimos 6 meses'], ['12meses', 'Últimos 12 meses'], ['anio', 'Este año']
    ];

    function mesDesplazado(off) { var d = new Date(); return new Date(d.getFullYear(), d.getMonth() + off, 1); }

    /* Rango que cubre desde el mes `a` hasta el mes `b` (desplazamientos respecto al mes actual, inclusive). */
    function rangoMeses(a, b) {
        var d1 = mesDesplazado(a), d2 = mesDesplazado(b + 1);
        return { desde: iso(d1), hasta: iso(new Date(d2.getFullYear(), d2.getMonth(), 0)) };
    }

    /* Periodo del reporte + el periodo anterior de la misma duración (para comparar). */
    function periodoReporte(p) {
        var m = new Date().getMonth(), a = 0, b = 0, etiqueta = 'Este mes';
        switch (p) {
            case 'mes-anterior': a = -1; b = -1; etiqueta = 'Mes anterior'; break;
            case '3meses': a = -2; etiqueta = 'Últimos 3 meses'; break;
            case '6meses': a = -5; etiqueta = 'Últimos 6 meses'; break;
            case '12meses': a = -11; etiqueta = 'Últimos 12 meses'; break;
            case 'anio': a = -m; etiqueta = 'Este año'; break;
            default: p = 'mes';
        }
        var n = b - a + 1;
        var shift = p === 'anio' ? 12 : n;          // «Este año» se compara con el mismo tramo del año anterior
        var r = rangoMeses(a, b), ini = mesDesplazado(a), fin = mesDesplazado(b);
        return {
            clave: p, etiqueta: etiqueta, desde: r.desde, hasta: r.hasta, n: n, offsetInicio: a, offsetFin: b,
            rotulo: n === 1 ? mesEtiqueta(ini.getFullYear() + '-' + pad(ini.getMonth() + 1))
                            : MESES[ini.getMonth()] + ' ' + ini.getFullYear() + ' – ' + MESES[fin.getMonth()] + ' ' + fin.getFullYear(),
            anterior: rangoMeses(a - shift, b - shift)
        };
    }

    /* Barras del gráfico: semanas si el periodo es un solo mes; meses en cualquier otro caso. */
    function serieReporte(per, movs) {
        var out = [], t;
        if (per.n === 1) {
            var d = parseISO(per.desde), mo = d.getMonth(), last = new Date(d.getFullYear(), mo + 1, 0).getDate();
            [[1, 7], [8, 14], [15, 21], [22, 28], [29, 31]].forEach(function (r) {
                if (r[0] > last) return;
                var hasta = Math.min(r[1], last);
                t = totales(movs.filter(function (x) { var dia = +x.fecha.slice(8, 10); return dia >= r[0] && dia <= hasta; }));
                out.push({
                    etiqueta: r[0] === hasta ? '' + r[0] : r[0] + '–' + hasta,
                    titulo: 'Del ' + r[0] + ' al ' + hasta + ' de ' + MESES_LARGO[mo].toLowerCase(),
                    ingresos: t.ingresos, gastos: t.gastos
                });
            });
        } else {
            for (var k = per.offsetInicio; k <= per.offsetFin; k++) {
                var dm = mesDesplazado(k), key = dm.getFullYear() + '-' + pad(dm.getMonth() + 1);
                t = totales(movs.filter(function (x) { return x.fecha.slice(0, 7) === key; }));
                out.push({ etiqueta: MESES[dm.getMonth()], titulo: MESES_LARGO[dm.getMonth()] + ' ' + dm.getFullYear(), ingresos: t.ingresos, gastos: t.gastos });
            }
        }
        return out;
    }

    function reporte(p) {
        var per = periodoReporte(p);
        var movs = movimientos.list({ desde: per.desde, hasta: per.hasta });
        var t = totales(movs);
        var tp = totales(movimientos.list({ desde: per.anterior.desde, hasta: per.anterior.hasta }));
        function delta(cur, prev) { return prev > 0 ? (cur - prev) / prev * 100 : null; }

        var serie = serieReporte(per, movs);
        var hoy = today(), fin = per.hasta < hoy ? per.hasta : hoy;
        var dias = Math.max(1, Math.round((parseISO(fin) - parseISO(per.desde)) / 86400000) + 1);

        var conDatos = per.n > 1 ? serie.filter(function (x) { return x.ingresos > 0 || x.gastos > 0; }) : [];
        var mayorMes = null;
        conDatos.forEach(function (x) { if (!mayorMes || x.gastos > mayorMes.gastos) mayorMes = x; });

        return {
            periodo: per, cantidad: movs.length, totales: t, anterior: tp,
            deltaIngresos: delta(t.ingresos, tp.ingresos), deltaGastos: delta(t.gastos, tp.gastos),
            tasaAhorro: t.ingresos > 0 ? t.balance / t.ingresos * 100 : null,
            serie: serie,
            gastosPorCategoria: porCategoria(movs, 'gasto'), ingresosPorCategoria: porCategoria(movs, 'ingreso'),
            mayoresGastos: movs.filter(function (m) { return m.tipo === 'gasto'; })
                .sort(function (a, b) { return b.monto - a.monto || (a.fecha < b.fecha ? 1 : -1); }).slice(0, 5),
            dias: dias, gastoDiario: round2(t.gastos / dias),
            promedioMensual: conDatos.length ? round2(t.gastos / conDatos.length) : null,
            mayorMes: mayorMes && mayorMes.gastos > 0 ? mayorMes : null
        };
    }

    /* ---------------------------------------------------------------
       API pública
    --------------------------------------------------------------- */
    window.Store = {
        METODOS: METODOS, MONEDAS: MONEDAS, PERIODOS: PERIODOS, MESES: MESES,
        categorias: categorias, movimientos: movimientos, metas: metas, settings: settings,
        presupuestoMes: presupuestoMes, mesClave: mesClave, mesEtiqueta: mesEtiqueta,
        sugerirLimites: sugerirLimites, aplicarLimites: aplicarLimites,
        PERIODOS_REPORTE: PERIODOS_REPORTE, periodoReporte: periodoReporte, reporte: reporte,
        rango: rango, totales: totales, balanceTotal: balanceTotal, porCategoria: porCategoria,
        serieMensual: serieMensual, limitePresupuesto: limitePresupuesto,
        exportar: exportar, importar: importar, reiniciar: reiniciar, cargarDemo: cargarDemo,
        today: today,
        persistent: function () { return persistent; },
        counts: function () { return { movimientos: data.movimientos.length, metas: data.metas.length, pagos: data.pagos.length }; }
    };

    /* ---------------------------------------------------------------
       Formato
    --------------------------------------------------------------- */
    window.Fmt = {
        /* Fmt.money(1200) → "$1,200" · Fmt.money(-420.5, {sign:true}) → "-$420.50" */
        money: function (n, o) {
            o = o || {};
            var abs = Math.abs(n);
            var frac = Math.round(abs * 100) % 100 === 0 ? 0 : 2;
            var s;
            try {
                s = new Intl.NumberFormat('es-MX', {
                    style: 'currency', currency: data.settings.moneda, currencyDisplay: 'narrowSymbol',
                    minimumFractionDigits: frac, maximumFractionDigits: frac
                }).format(abs);
            } catch (e) { s = '$' + abs.toFixed(frac); }
            if (n < 0) return '-' + s;
            return o.sign && n > 0 ? '+' + s : s;
        },
        date: function (s) { var p = s.split('-'); return +p[2] + ' ' + MESES[+p[1] - 1] + ' ' + p[0]; },
        dateShort: function (s) { var p = s.split('-'); return +p[2] + ' ' + MESES[+p[1] - 1]; },
        percent: function (n) { return (Math.round(n * 10) / 10) + '%'; },
        esc: function (s) {
            return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        },
        initials: function (name) {
            var w = String(name || '').trim().split(/\s+/).filter(Boolean);
            if (!w.length) return 'U';
            return (w[0][0] + (w.length > 1 ? w[1][0] : '')).toUpperCase();
        }
    };
})();

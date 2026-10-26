/*
 * ui.js — Componentes compartidos de interfaz.
 *
 *   UI.modal({title, body, dismissable})      → {el, body, close}
 *   UI.confirm({title, message, confirmText, danger}) → Promise<boolean>
 *   UI.toast('Mensaje', {actionLabel, onAction, type})
 *   UI.menu(botonAncla, [{label, icon, danger, onClick}])
 *   UI.emptyState({icon|emoji, title, text, actions})  → HTML
 */
(function () {
    'use strict';

    var esc = Fmt.esc;
    var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    /* ---------------- Toast ---------------- */
    var toastBox = null;

    function toast(msg, opts) {
        opts = opts || {};
        if (!toastBox) {
            toastBox = document.createElement('div');
            toastBox.className = 'toasts';
            toastBox.setAttribute('role', 'status');
            toastBox.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastBox);
        }
        // Un solo aviso a la vez: así "Deshacer" siempre se refiere a la última acción.
        while (toastBox.firstChild) toastBox.removeChild(toastBox.firstChild);

        var t = document.createElement('div');
        t.className = 'toast' + (opts.type ? ' toast-' + opts.type : '');
        var span = document.createElement('span');
        span.textContent = msg;
        t.appendChild(span);

        var timer;
        function close() { clearTimeout(timer); if (t.parentNode) t.parentNode.removeChild(t); }

        if (opts.actionLabel) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'toast-action';
            b.textContent = opts.actionLabel;
            b.addEventListener('click', function () { close(); if (opts.onAction) opts.onAction(); });
            t.appendChild(b);
        }
        toastBox.appendChild(t);
        timer = setTimeout(close, opts.duration || (opts.actionLabel ? 7000 : 4000));
        return { close: close };
    }

    /* ---------------- Modal ---------------- */
    var openModals = 0;

    function modal(opts) {
        var prev = document.activeElement;
        var dismissable = opts.dismissable !== false;
        var id = 'm' + Math.random().toString(36).slice(2, 8);

        var backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        var dlg = document.createElement('div');
        dlg.className = 'modal' + (opts.className ? ' ' + opts.className : '');
        dlg.setAttribute('role', 'dialog');
        dlg.setAttribute('aria-modal', 'true');
        dlg.setAttribute('aria-labelledby', id);
        dlg.tabIndex = -1;
        dlg.innerHTML =
            '<div class="modal-header"><h2 id="' + id + '">' + esc(opts.title) + '</h2>' +
            (dismissable ? '<button type="button" class="modal-close" data-icon="x" aria-label="Cerrar"></button>' : '') +
            '</div><div class="modal-body"></div>';

        var body = dlg.querySelector('.modal-body');
        if (typeof opts.body === 'string') body.innerHTML = opts.body;
        else if (opts.body) body.appendChild(opts.body);

        backdrop.appendChild(dlg);
        document.body.appendChild(backdrop);
        Icons.render(dlg);
        openModals++;
        document.body.style.overflow = 'hidden';

        var closed = false;
        function close(result) {
            if (closed) return;
            closed = true;
            document.removeEventListener('keydown', onKey, true);
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            openModals = Math.max(0, openModals - 1);
            if (!openModals) document.body.style.overflow = '';
            if (prev && prev.focus) { try { prev.focus(); } catch (e) {} }
            if (opts.onClose) opts.onClose(result);
        }

        function onKey(e) {
            if (e.key === 'Escape' && dismissable) { e.stopPropagation(); close(); return; }
            if (e.key !== 'Tab') return;
            var items = Array.prototype.filter.call(dlg.querySelectorAll(FOCUSABLE), function (n) { return n.offsetParent !== null; });
            if (!items.length) { e.preventDefault(); return; }
            var first = items[0], last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        document.addEventListener('keydown', onKey, true);

        if (dismissable) {
            backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) close(); });
            dlg.querySelector('.modal-close').addEventListener('click', function () { close(); });
        }

        var target = opts.focus ? dlg.querySelector(opts.focus) : body.querySelector('input:not([type="radio"]),select,textarea');
        (target || dlg).focus();

        return { el: dlg, body: body, close: close };
    }

    function confirm(o) {
        return new Promise(function (resolve) {
            var decided = false;
            var m = modal({
                title: o.title || '¿Confirmar?',
                body: '<p class="modal-text">' + esc(o.message || '') + '</p>' +
                      '<div class="modal-actions">' +
                      '<button type="button" class="secondary-button" data-no>' + esc(o.cancelText || 'Cancelar') + '</button>' +
                      '<button type="button" class="' + (o.danger ? 'danger-solid' : 'primary-button') + '" data-yes>' + esc(o.confirmText || 'Confirmar') + '</button>' +
                      '</div>',
                focus: '[data-no]',
                onClose: function () { if (!decided) resolve(false); }
            });
            m.body.querySelector('[data-no]').addEventListener('click', function () { decided = true; m.close(); resolve(false); });
            m.body.querySelector('[data-yes]').addEventListener('click', function () { decided = true; m.close(); resolve(true); });
        });
    }

    /* ---------------- Menú flotante ---------------- */
    var current = null;

    function closeMenu(restoreFocus) {
        if (!current) return;
        var c = current;
        current = null;
        document.removeEventListener('mousedown', c.onDoc, true);
        document.removeEventListener('keydown', c.onKey, true);
        window.removeEventListener('scroll', c.onAway, true);
        window.removeEventListener('resize', c.onAway);
        if (c.el.parentNode) c.el.parentNode.removeChild(c.el);
        c.anchor.setAttribute('aria-expanded', 'false');
        if (restoreFocus) c.anchor.focus();
    }

    function menu(anchor, items) {
        if (current && current.anchor === anchor) { closeMenu(false); return; }
        closeMenu(false);

        var el = document.createElement('div');
        el.className = 'popover-menu';
        el.setAttribute('role', 'menu');
        el.style.visibility = 'hidden';
        el.innerHTML = items.map(function (it, i) {
            return '<button type="button" role="menuitem" class="popover-item' + (it.danger ? ' danger' : '') + '" data-i="' + i + '">' +
                   (it.icon ? '<span data-icon="' + it.icon + '"></span>' : '') + esc(it.label) + '</button>';
        }).join('');
        document.body.appendChild(el);
        Icons.render(el);

        var r = anchor.getBoundingClientRect();
        var left = Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, r.right - el.offsetWidth));
        var top = r.bottom + 6;
        if (top + el.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - el.offsetHeight - 6);
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.visibility = '';
        anchor.setAttribute('aria-expanded', 'true');

        var buttons = Array.prototype.slice.call(el.querySelectorAll('.popover-item'));

        current = {
            el: el, anchor: anchor,
            onDoc: function (e) { if (!el.contains(e.target) && !anchor.contains(e.target)) closeMenu(false); },
            onAway: function () { closeMenu(false); },
            onKey: function (e) {
                var idx = buttons.indexOf(document.activeElement);
                if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(idx + 1) % buttons.length].focus(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(idx - 1 + buttons.length) % buttons.length].focus(); }
                else if (e.key === 'Tab') closeMenu(false);
            }
        };
        document.addEventListener('mousedown', current.onDoc, true);
        document.addEventListener('keydown', current.onKey, true);
        window.addEventListener('scroll', current.onAway, true);
        window.addEventListener('resize', current.onAway);

        el.addEventListener('click', function (e) {
            var b = e.target.closest('.popover-item');
            if (!b) return;
            var it = items[+b.getAttribute('data-i')];
            closeMenu(false);
            if (it && it.onClick) it.onClick();
        });
        buttons[0].focus({ preventScroll: true });
    }

    /* ---------------- Estado vacío ---------------- */
    function emptyState(o) {
        return '<div class="empty-state' + (o.compact ? ' compact' : '') + '">' +
               '<div class="empty-icon"' + (o.icon ? ' data-icon="' + o.icon + '"' : '') + '>' + (o.emoji || '') + '</div>' +
               '<h3>' + esc(o.title) + '</h3>' +
               (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
               (o.actions ? '<div class="empty-actions">' + o.actions + '</div>' : '') +
               '</div>';
    }


    /* ---------------- Emoji y errores de formulario ---------------- */
    var EMOJIS = {
        categoria: ['🍴', '🛒', '🚗', '⛽', '🏠', '💡', '📶', '📱', '🎮', '🎬', '📚', '🩺', '💊', '👕', '🐶', '🎁', '✈️', '🏋️', '☕', '🔧', '👶', '💈', '🎵', '📦'],
        meta: ['🎯', '🎓', '📱', '💻', '✈️', '🏖️', '🏠', '🚗', '🛡️', '💍', '🎁', '📷', '🎸', '🏋️', '🐶', '💰']
    };

    /* Devuelve un <div> con sugerencias; al hacer clic escribe el emoji en `input`. */
    function emojiPicker(input, tipo) {
        var grid = document.createElement('div');
        grid.className = 'emoji-grid';
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', 'Sugerencias de emoji');
        grid.innerHTML = EMOJIS[tipo].map(function (e) {
            return '<button type="button" class="emoji-btn" data-e="' + e + '" aria-label="Usar ' + e + '">' + e + '</button>';
        }).join('');
        function mark() {
            Array.prototype.forEach.call(grid.children, function (b) {
                b.classList.toggle('selected', b.getAttribute('data-e') === input.value.trim());
            });
        }
        grid.addEventListener('click', function (e) {
            var b = e.target.closest('.emoji-btn');
            if (!b) return;
            input.value = b.getAttribute('data-e');
            mark();
        });
        input.addEventListener('input', mark);
        mark();
        return grid;
    }

    function clearErrors(form) {
        Array.prototype.forEach.call(form.querySelectorAll('.field-error'), function (n) { n.textContent = ''; });
        Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (n) { n.removeAttribute('aria-invalid'); });
    }

    /* Muestra {campo: mensaje} bajo cada campo y enfoca el primero con error. */
    function showErrors(form, errors) {
        clearErrors(form);
        var first = null;
        Object.keys(errors).forEach(function (k) {
            var msg = form.querySelector('[data-for="' + k + '"]');
            if (msg) msg.textContent = errors[k];
            var f = form.elements[k];
            if (f && f.setAttribute) { f.setAttribute('aria-invalid', 'true'); if (!first) first = f; }
        });
        if (first) first.focus();
        else if (errors._) toast(errors._, { type: 'warning' });
    }

    window.UI = { modal: modal, confirm: confirm, toast: toast, menu: menu, emptyState: emptyState,
        emojiPicker: emojiPicker, clearErrors: clearErrors, showErrors: showErrors };
})();

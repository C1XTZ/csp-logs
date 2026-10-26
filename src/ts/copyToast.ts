const COPIED_MS = 900;
const FAILED_MS = 1200;
const HINT_TARGETS = '.vt-time, [data-copy], [data-date]';

const toast = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'vt-toast', role: 'status', ariaLive: 'polite' }));
let hideTimer: number | undefined;
let anchor: Element | null = null;

const closest = (target: EventTarget | null, selector: string) => (target instanceof Element ? target.closest<HTMLElement>(selector) : null);

const fullDate = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Unknown publish date' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

function hide() {
  toast.classList.remove('vt-toast-hover', 'vt-toast-show');
  anchor = null;
}

function show(target: HTMLElement, text: string, hideAfterMs?: number) {
  clearTimeout(hideTimer);
  toast.textContent = text;
  toast.classList.remove('vt-toast-hover', 'vt-toast-show');

  const rect = target.getBoundingClientRect();
  Object.assign(toast.style, {
    top: `${Math.max(10, rect.top - 34)}px`,
    left: `${Math.min(innerWidth - 36, Math.max(36, rect.left + rect.width / 2))}px`,
    transform: 'translateX(-50%)',
  });
  anchor = target;

  if (hideAfterMs === undefined) {
    toast.classList.add('vt-toast-hover');
    return;
  }
  void toast.offsetWidth;
  toast.classList.add('vt-toast-show');
  hideTimer = window.setTimeout(hide, hideAfterMs);
}

function hint(target: EventTarget | null) {
  const el = closest(target, HINT_TARGETS);
  if (!el || el === anchor) return;

  const date = el.dataset.date || el.dataset.timeago;
  const text = date ? fullDate(date) : el.dataset.copy ? `Copy ${el.dataset.copyLabel ?? 'text'}` : null;
  if (text) show(el, text);
}

function hideHint() {
  if (!toast.classList.contains('vt-toast-show')) hide();
}

async function copy(el: HTMLElement) {
  if (!el.dataset.copy) return;

  try {
    await navigator.clipboard.writeText(el.dataset.copy);
    show(el, `Copied ${el.dataset.copyLabel ?? 'text'}!`, COPIED_MS);
  } catch {
    show(el, 'Copy failed', FAILED_MS);
  }
}

document.addEventListener('click', (e) => {
  const el = closest(e.target, '[data-copy]');
  if (el) void copy(el);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;

  const el = closest(e.target, '[data-copy]');
  if (!el || el instanceof HTMLButtonElement) return;
  e.preventDefault();
  void copy(el);
});

document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'touch') hint(e.target);
});

document.addEventListener('pointerout', (e) => {
  const el = closest(e.target, HINT_TARGETS);
  if (el && !el.contains(e.relatedTarget as Node | null)) hideHint();
});

document.addEventListener('focusin', (e) => hint(e.target));

document.addEventListener('focusout', (e) => {
  if (!closest(e.relatedTarget, HINT_TARGETS)) hideHint();
});

window.addEventListener('resize', hide, { passive: true });

function makeCopyable(code: HTMLElement, value: string, label: string) {
  code.dataset.copy = value;
  code.dataset.copyLabel = label;
  Object.assign(code, { tabIndex: 0, role: 'button', ariaLabel: `Copy ${label} ${value}` });
}

function scrollInsideChip(code: HTMLElement) {
  const row = code.parentElement;
  if (!row) return;

  const text = document.createElement('span');
  text.className = 'csp-sha-text';
  text.append(...Array.from(code.childNodes));
  code.append(text);

  const wrap = document.createElement('span');
  wrap.className = 'csp-sha-row';
  wrap.append(...Array.from(row.childNodes));
  row.append(wrap);

  text.addEventListener(
    'wheel',
    (e) => {
      const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
      const max = text.scrollWidth - text.clientWidth;
      const next = Math.min(max, Math.max(0, text.scrollLeft + delta));
      if (e.deltaX || next === text.scrollLeft) return;
      e.preventDefault();
      text.scrollLeft = next;
    },
    { passive: false },
  );
}

const FIELDS = new Map<string, { pattern: RegExp; decorate: (code: HTMLElement, value: string) => void }>([
  ['Version ID', { pattern: /^\d+$/, decorate: (code, value) => makeCopyable(code, value, 'ID') }],
  [
    'SHA-256',
    {
      pattern: /^[0-9a-f]{64}$/i,
      decorate: (code, value) => {
        makeCopyable(code, value, 'SHA-256');
        scrollInsideChip(code);
      },
    },
  ],
  [
    'Published',
    {
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      decorate: (code, value) => {
        code.dataset.date = value;
        Object.assign(code, { tabIndex: 0, ariaLabel: fullDate(value) });
      },
    },
  ],
]);

document.querySelectorAll<HTMLElement>('.sl-markdown-content li > code, .sl-markdown-content li > p > code').forEach((code) => {
  const value = code.textContent ?? '';
  const label = code.parentElement?.firstChild?.textContent?.replace(/:\s*$/, '').trim() ?? '';
  const field = FIELDS.get(label);
  if (field?.pattern.test(value)) field.decorate(code, value);
});

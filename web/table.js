// Reusable container-responsive DataTable + toolbar (Search, Filters, Sort).
// Desktop renders a full aligned semantic table; compact containers collapse rows
// to 2 visual lines (Identity + Right-aligned Amount / State + Labeled Detail + Kebab Menu)
// with tap-to-expand details so hidden columns are never deleted.
import { el } from './dom.js';

let uidSeq = 0;
const nextId = (prefix) => `${prefix}-${++uidSeq}`;

function makeActionNode(a, menuEl, inMenu = false) {
  const cls = inMenu ? 'dt-menu-item' : (a.primary ? 'primary dt-primary-btn' : 'dt-action-btn');
  if (a.href) {
    const link = el('a', {
      className: `${inMenu ? 'dt-menu-item' : 'btn'}${a.wa ? ' wa' : ''}`,
      href: a.href,
      target: a.target ?? '_blank',
      rel: 'noopener',
      textContent: a.label,
    });
    if (inMenu && menuEl) {
      link.addEventListener('click', () => {
        if (menuEl.matches(':popover-open')) menuEl.hidePopover();
      });
    }
    return link;
  }
  const btn = el('button', {
    type: 'button',
    className: cls,
    textContent: a.label,
  });
  btn.onclick = (e) => {
    e.stopPropagation();
    if (inMenu && menuEl?.matches(':popover-open')) menuEl.hidePopover();
    a.onClick(btn);
  };
  return btn;
}

function wirePopupMenu(trigger, popoverEl, groupEl) {
  const supportsInvoker = 'commandForElement' in HTMLButtonElement.prototype;
  const supportsAnchor = typeof CSS !== 'undefined' && CSS.supports?.('position-area: block-end');
  const supportsFocusgroup = 'focusGroup' in HTMLElement.prototype;

  if (supportsInvoker) {
    trigger.setAttribute('commandfor', popoverEl.id);
    trigger.setAttribute('command', 'toggle-popover');
  } else {
    trigger.setAttribute('popovertarget', popoverEl.id);
  }

  let enterOnOpen = false;
  let pointerPressed = false;
  trigger.addEventListener('pointerdown', () => { pointerPressed = true; });
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      enterOnOpen = true;
      if (!popoverEl.matches(':popover-open')) trigger.click();
      else groupEl.querySelector('button, a')?.focus({ preventScroll: true });
    } else if (e.key === 'Enter' || e.key === ' ') {
      pointerPressed = false;
      enterOnOpen = true;
    }
  });

  if (!supportsFocusgroup) {
    groupEl.setAttribute('role', 'menu');
    for (const item of groupEl.querySelectorAll('button, a')) item.setAttribute('role', 'menuitem');
    groupEl.addEventListener('keydown', (e) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const items = [...groupEl.querySelectorAll('button, a')].filter((n) => !n.disabled);
      const cur = items.indexOf(document.activeElement);
      if (!items.length) return;
      const idx = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 :
        (cur + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      e.preventDefault();
      e.stopImmediatePropagation();
      items[idx].focus({ preventScroll: true });
    });
  }

  popoverEl.addEventListener('toggle', (e) => {
    const open = e.newState === 'open';
    trigger.setAttribute('aria-expanded', String(open));
    if (open && !supportsAnchor) {
      const r = trigger.getBoundingClientRect();
      const mw = popoverEl.offsetWidth || 184;
      const mh = popoverEl.offsetHeight || 180;
      const left = Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8));
      const top = r.bottom + 4 + mh > window.innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4;
      popoverEl.style.left = `${left}px`;
      popoverEl.style.top = `${top}px`;
    }
    if (open) {
      if (enterOnOpen && !pointerPressed) groupEl.querySelector('button, a')?.focus({ preventScroll: true });
      enterOnOpen = false;
      pointerPressed = false;
    }
  });
}

export function renderDataTable(container, config) {
  const {
    rows = [],
    columns = [],
    mobileSummary,
    expandedContent,
    rowActions,
    sort = { key: '', dir: 'asc' },
    onSortChange,
    emptyText = 'No records found',
    caption = 'Data table',
    rowLabel = () => 'record',
  } = config;

  if (!rows.length) {
    container.replaceChildren(el('p', { className: 'dt-empty', textContent: emptyText }));
    return;
  }

  const captionId = nextId('dt-cap');
  const colCount = columns.length + 1;

  const headCells = columns.map((col) => {
    const thProps = {
      className: `dt-th${col.align === 'end' ? ' is-end' : ''}`,
      scope: 'col',
    };
    if (col.sortable && onSortChange) {
      const active = sort.key === col.key;
      const nextDir = active && sort.dir === 'asc' ? 'desc' : 'asc';
      if (active) thProps['aria-sort'] = sort.dir === 'asc' ? 'ascending' : 'descending';
      const dirArrow = active ? (sort.dir === 'asc' ? '↑' : '↓') : '';
      const btn = el('button', {
        type: 'button',
        className: `dt-sort-btn${active ? ' is-active' : ''}`,
      }, col.label, dirArrow && el('span', { className: 'dt-sort-ind', 'aria-hidden': 'true', textContent: ` ${dirArrow}` }));
      btn.onclick = () => onSortChange(col.key, nextDir);
      return el('th', thProps, btn);
    }
    return el('th', thProps, col.label);
  });
  headCells.push(el('th', { className: 'dt-th is-end', scope: 'col' }, 'Actions'));

  const tbody = el('tbody', {});

  for (const row of rows) {
    const labelName = rowLabel(row);
    const { primary, menu = [] } = rowActions ? rowActions(row) : { primary: null, menu: [] };
    const details = expandedContent ? expandedContent(row) : null;

    const tr = el('tr', { className: 'dt-row' });
    const expandRow = details ? el('tr', { className: 'dt-expand-row', hidden: true },
      el('td', { className: 'dt-expand-cell', colSpan: colCount }, details)) : null;

    const toggleExpand = () => {
      if (!expandRow) return;
      const willOpen = expandRow.hidden;
      expandRow.hidden = !willOpen;
      tr.classList.toggle('is-expanded', willOpen);
      const idBtn = tr.querySelector('.dt-row-toggle');
      if (idBtn) idBtn.setAttribute('aria-expanded', String(willOpen));
    };

    if (expandRow) {
      tr.onclick = (e) => {
        if (e.target.closest('button, a, input, select, .dt-action-wrap')) return;
        toggleExpand();
      };
    }

    for (const col of columns) {
      const td = el('td', {
        className: `dt-cell${col.desktopOnly ? ' dt-desktop-only' : ''}${col.align === 'end' ? ' is-end' : ''}`,
      });
      td.dataset.role = col.role;
      if (col.role === 'identity' && expandRow) {
        const trigger = el('button', {
          type: 'button',
          className: 'dt-row-toggle',
          ariaExpanded: 'false',
          ariaLabel: `Show details for ${labelName}`,
        }, col.render(row));
        trigger.onclick = (e) => { e.stopPropagation(); toggleExpand(); };
        td.append(trigger);
      } else {
        td.append(col.render(row));
      }
      tr.append(td);
    }

    const mobileMeta = el('td', { className: 'dt-mobile-meta' });
    if (mobileSummary) mobileMeta.append(mobileSummary(row));
    tr.append(mobileMeta);

    const actionWrap = el('div', { className: 'dt-action-wrap' });
    if (primary) actionWrap.append(makeActionNode({ ...primary, primary: true }, null, false));

    const menuItems = [];
    if (primary) menuItems.push({ ...primary, compactOnly: true });
    menuItems.push(...menu);
    if (expandRow) menuItems.push({ label: 'Row details', onClick: () => toggleExpand() });

    if (menuItems.length) {
      const triggerId = nextId('dt-act');
      const menuId = nextId('dt-menu');
      const kebab = el('button', {
        id: triggerId,
        type: 'button',
        className: 'dt-kebab',
        ariaLabel: `Open actions for ${labelName}`,
        ariaHasPopup: 'menu',
        ariaExpanded: 'false',
        textContent: '⋮',
      });
      const menuEl = el('div', { id: menuId, className: 'dt-menu' });
      menuEl.setAttribute('popover', 'auto');
      const groupEl = el('div', {});
      groupEl.setAttribute('focusgroup', 'menu nomemory');
      groupEl.setAttribute('aria-labelledby', triggerId);
      groupEl.append(...menuItems.map((m) => {
        const node = makeActionNode(m, menuEl, true);
        if (m.compactOnly) node.classList.add('dt-compact-only');
        return node;
      }));
      menuEl.append(groupEl);
      wirePopupMenu(kebab, menuEl, groupEl);
      actionWrap.append(kebab, menuEl);
    }

    const actionTd = el('td', { className: 'dt-cell is-end' });
    actionTd.dataset.role = 'action';
    actionTd.append(actionWrap);
    tr.append(actionTd);

    tbody.append(tr);
    if (expandRow) tbody.append(expandRow);
  }

  const table = el('table', { className: 'dt-table' },
    el('caption', { id: captionId, className: 'sr-only', textContent: caption }),
    el('thead', {}, el('tr', {}, headCells)),
    tbody);

  const wrap = el('div', { className: 'dt-wrap', tabIndex: 0, role: 'region' });
  wrap.setAttribute('aria-labelledby', captionId);
  wrap.append(table);

  container.replaceChildren(el('div', { className: 'dt-container' }, wrap));
}

// Reusable responsive table toolbar: preserves Search, Filters (with mobile sheet/drawer), and Sort.
export function renderTableToolbar(container, {
  filters = [],
  activeFilter = 'all',
  onFilter,
  sort = { key: 'name', dir: 'asc' },
  sortOptions = [],
  onSort,
  search = '',
  onSearch,
  searchPlaceholder = 'Search',
  searchLabel = 'Search table',
}) {
  const filterButtons = filters.map((f) => {
    const b = el('button', { type: 'button', textContent: `${f.label} (${f.count})` });
    b.setAttribute('aria-pressed', String(activeFilter === f.key));
    b.onclick = () => onFilter(f.key);
    return b;
  });

  const searchInput = el('input', {
    type: 'search',
    value: search,
    placeholder: searchPlaceholder,
    ariaLabel: searchLabel,
    autocomplete: 'off',
  });
  searchInput.oninput = (e) => onSearch(e.target.value);

  const searchBox = el('div', { className: 'search dt-search' },
    (() => {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS(NS, 'use');
      use.setAttribute('href', '#i-search');
      svg.append(use);
      return svg;
    })(),
    searchInput);

  const sortSelect = el('select', { className: 'dt-sort-select', ariaLabel: 'Sort rows' },
    sortOptions.map((o) => el('option', {
      value: `${o.key}:${o.dir}`,
      textContent: `Sort: ${o.label}`,
      selected: sort.key === o.key && sort.dir === o.dir,
    })));
  sortSelect.onchange = (e) => {
    const [k, d] = e.target.value.split(':');
    onSort(k, d);
  };

  const activeFilterObj = filters.find((f) => f.key === activeFilter);
  const mobileFilterBtn = el('button', {
    type: 'button',
    className: 'dt-mobile-filter-btn',
    textContent: activeFilter === 'all' ? 'Filters' : `Filter: ${activeFilterObj?.label ?? activeFilter}`,
    ariaExpanded: 'false',
  });
  const mobileSheet = el('div', { className: 'dt-filter-sheet', hidden: true },
    el('div', { className: 'dt-filter-sheet-head' },
      el('strong', { textContent: 'Filter by status' }),
      (() => {
        const done = el('button', { type: 'button', className: 'quiet', textContent: 'Done' });
        done.onclick = () => {
          mobileSheet.hidden = true;
          mobileFilterBtn.setAttribute('aria-expanded', 'false');
        };
        return done;
      })()),
    el('div', { className: 'dt-filter-sheet-options' },
      filters.map((f) => {
        const b = el('button', { type: 'button', textContent: `${f.label} (${f.count})` });
        b.setAttribute('aria-pressed', String(activeFilter === f.key));
        b.onclick = () => {
          mobileSheet.hidden = true;
          onFilter(f.key);
        };
        return b;
      })));

  mobileFilterBtn.onclick = () => {
    const open = mobileSheet.hidden;
    mobileSheet.hidden = !open;
    mobileFilterBtn.setAttribute('aria-expanded', String(open));
  };

  container.replaceChildren(
    el('div', { className: 'dt-toolbar' },
      el('div', { className: 'dt-toolbar-filters' }, filterButtons),
      el('div', { className: 'dt-toolbar-controls' },
        searchBox,
        el('div', { className: 'dt-toolbar-sub' },
          mobileFilterBtn,
          sortSelect))),
    mobileSheet);
}

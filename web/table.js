// Reusable container-responsive DataTable + toolbar (Search, Filters, Sort).
// Desktop renders a full aligned semantic table; compact containers collapse rows
// to 2 visual lines (Identity + Right-aligned Amount / State + Labeled Detail + Kebab Menu)
// with tap-to-expand details so hidden columns are never deleted.
import { el } from './dom.js';

let closeOpenMenu = null;

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (closeOpenMenu && !e.target.closest('.dt-action-wrap')) closeOpenMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && closeOpenMenu) closeOpenMenu();
  });
}

function makeActionNode(a, inMenu = false) {
  const cls = inMenu ? 'dt-menu-item' : (a.primary ? 'primary dt-primary-btn' : 'dt-action-btn');
  if (a.href) {
    return el('a', {
      className: `${inMenu ? 'dt-menu-item' : 'btn'}${a.wa ? ' wa' : ''}`,
      href: a.href,
      target: a.target ?? '_blank',
      rel: 'noopener',
      role: inMenu ? 'menuitem' : undefined,
      textContent: a.label,
    });
  }
  const btn = el('button', {
    type: 'button',
    className: cls,
    role: inMenu ? 'menuitem' : undefined,
    textContent: a.label,
  });
  btn.onclick = (e) => {
    e.stopPropagation();
    if (closeOpenMenu) closeOpenMenu();
    a.onClick(btn);
  };
  return btn;
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
    rowLabel = () => 'record',
  } = config;

  if (!rows.length) {
    container.replaceChildren(el('p', { className: 'dt-empty', textContent: emptyText }));
    return;
  }

  const colCount = columns.length + 1; // +1 for action column

  const headCells = columns.map((col) => {
    const thProps = {
      className: `dt-th${col.align === 'end' ? ' is-end' : ''}`,
      scope: 'col',
    };
    if (col.sortable && onSortChange) {
      const active = sort.key === col.key;
      const nextDir = active && sort.dir === 'asc' ? 'desc' : 'asc';
      const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
      thProps['aria-sort'] = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
      const btn = el('button', {
        type: 'button',
        className: `dt-sort-btn${active ? ' is-active' : ''}`,
        textContent: `${col.label}${arrow}`,
      });
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

    // Desktop cells classified by role
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

    // Compact mobile Line-2 cell (State near Identity + Labeled detail)
    const mobileMeta = el('td', { className: 'dt-mobile-meta' });
    if (mobileSummary) mobileMeta.append(mobileSummary(row));
    tr.append(mobileMeta);

    // Actions cell: consistent aligned slot (desktop: 1 primary CTA + kebab; compact: kebab with all actions)
    const actionWrap = el('div', { className: 'dt-action-wrap' });
    if (primary) actionWrap.append(makeActionNode({ ...primary, primary: true }, false));

    const menuItems = [];
    if (primary) menuItems.push({ ...primary, compactOnly: true });
    menuItems.push(...menu);
    if (expandRow) {
      menuItems.push({
        label: 'Row details',
        onClick: () => toggleExpand(),
      });
    }

    if (menuItems.length) {
      const kebab = el('button', {
        type: 'button',
        className: 'dt-kebab',
        ariaLabel: `Open actions for ${labelName}`,
        ariaHasPopup: 'menu',
        ariaExpanded: 'false',
        textContent: '⋮',
      });
      const menuEl = el('div', { className: 'dt-menu', role: 'menu', hidden: true },
        menuItems.map((m) => {
          const node = makeActionNode(m, true);
          if (m.compactOnly) node.classList.add('dt-compact-only');
          return node;
        }));

      const closeThis = () => {
        menuEl.hidden = true;
        kebab.setAttribute('aria-expanded', 'false');
        if (closeOpenMenu === closeThis) closeOpenMenu = null;
      };

      kebab.onclick = (e) => {
        e.stopPropagation();
        const willOpen = menuEl.hidden;
        if (closeOpenMenu && closeOpenMenu !== closeThis) closeOpenMenu();
        menuEl.hidden = !willOpen;
        kebab.setAttribute('aria-expanded', String(willOpen));
        closeOpenMenu = willOpen ? closeThis : null;
      };

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
    el('thead', {}, el('tr', {}, headCells)),
    tbody);

  container.replaceChildren(el('div', { className: 'dt-container' }, el('div', { className: 'dt-wrap' }, table)));
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

  // Mobile filter sheet button (shows active filter indicator)
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

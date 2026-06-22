/**
 * Noelle West — Send to Laundry Shop Calculator
 * Items grouped into bags; each bag weighed as a whole.
 */

// ── Google Sheets Config ──
const SHEET_ID = '1-QD9UJ99Rjl1JPlBdKPo7hz5MBOiJKkMyD-qWlD520s';

const SHEET_NAMES = [
  'BGS','BGI','PGS','PGI','MOH','BMG','FGG','PGC','FIL',
  'MG','CD','MS','CS','PET-#','PET',
  'BCPO','BOY','BPSC','BPO','BPOL','BPS','COAT BARONG',
  'BCC','BPOC','VST','S-UPPER','POLO','ACC','PEN','PANTS'
];

// Categories that need a quantity input
const QUANTITY_CATS = new Set([
  'BCPO','BPSC','BPS','ACC','PEN','PANTS','S-UPPER',
  'PET','MOH','BMG','FGG',
  'BOY','BPO','BPOL','COAT BARONG','BCC','BPOC','VST','POLO'
]);

// ── State ──
let INVENTORY = {};
// bags[i] = { items: [ { cat, name, qty, isQty } ], weight: '' }
let bags = [];
window.latestSubmissionText = '';

// ── Boot ──
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('loadingBanner').style.display = '';
  await loadInventory();
  document.getElementById('loadingBanner').style.display = 'none';
  setupJotform();
});

// ── Load Inventory ──
async function loadInventory() {
  try {
    const data = await loadFromGoogleSheets();
    if (data && Object.keys(data).length > 0) {
      INVENTORY = data;
      showBadge('🟢 Live from Google Sheets', '#3DAB6A');
      return;
    }
  } catch(e) { console.warn('Sheets failed:', e); }
  showBadge('🔴 Could not load inventory', '#E05252');
}

function showBadge(text, color) {
  const b = document.getElementById('sourceBadge');
  if (b) { b.textContent = text; b.style.color = color; }
}

// ── Google Sheets CSV Loader ──
async function loadFromGoogleSheets() {
  const result = {};
  const fetches = SHEET_NAMES.map(name =>
    fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`)
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(csv => ({ name, csv }))
      .catch(() => ({ name, csv: null }))
  );
  const results = await Promise.all(fetches);
  for (const { name, csv } of results) {
    if (!csv || csv.trim().startsWith('<') || !csv.trim()) continue;
    const rows    = parseCSV(csv);
    if (rows.length < 2) continue;
    const header  = rows[0].map(h => h.trim().toUpperCase());
    let nameIdx   = header.findIndex(h => h.includes('PRODUCT NAME'));
    if (nameIdx < 0) nameIdx = 0;
    const items   = [];
    for (const row of rows.slice(1)) {
      const n = (row[nameIdx] || '').trim();
      if (n) items.push({ name: n });
    }
    if (items.length) result[name] = { items };
  }
  return result;
}

function parseCSV(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === ',' && !inQ) { row.push(cur); cur = ''; }
      else cur += ch;
    }
    row.push(cur); rows.push(row);
  }
  return rows;
}

// ── Set Bags ──
window.onSetBags = function() {
  const n = Math.max(1, Math.min(30, parseInt(document.getElementById('numBagsInput').value) || 1));
  while (bags.length < n) bags.push({ items: [], weight: '' });
  while (bags.length > n) bags.pop();
  renderAllBags();
  renderTotals();
  renderSummary();
};

// ── Render All Bags ──
function renderAllBags() {
  const container = document.getElementById('bagsContainer');
  container.innerHTML = '';
  bags.forEach((bag, idx) => container.appendChild(buildBagCard(bag, idx)));
  document.getElementById('grandTotalsCard').style.display = bags.length ? '' : 'none';
}

// ── Build One Bag Card ──
function buildBagCard(bag, idx) {
  const card = document.createElement('div');
  card.className = 'bag-card';
  card.id = `bagCard_${idx}`;

  // ── Header ──
  const hdr = document.createElement('div');
  hdr.className = 'bag-card-header';
  const h2 = document.createElement('h2');
  h2.textContent = `Bag ${idx + 1}`;
  const countPill = document.createElement('span');
  countPill.className = 'bag-item-count';
  countPill.id = `bagCount_${idx}`;
  countPill.textContent = formatItemCount(bag);
  hdr.appendChild(h2); hdr.appendChild(countPill);
  card.appendChild(hdr);

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'bag-card-body';

  // Alert box per bag
  const alertBox = document.createElement('div');
  alertBox.id = `bagAlert_${idx}`;
  body.appendChild(alertBox);

  // ── Category + Item dropdowns ──
  const grid = document.createElement('div');
  grid.className = 'item-adder-grid';

  // Category
  const catGrp = document.createElement('div');
  catGrp.className = 'form-group';
  const catLbl = document.createElement('label');
  catLbl.textContent = 'Category';
  const catSel = document.createElement('select');
  catSel.innerHTML = '<option value="">— Select —</option>';
  const cats = SHEET_NAMES.filter(n => INVENTORY[n]);
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c; catSel.appendChild(o);
  });
  catGrp.appendChild(catLbl); catGrp.appendChild(catSel);
  grid.appendChild(catGrp);

  // Item (Tom Select)
  const itemGrp = document.createElement('div');
  itemGrp.className = 'form-group';
  const itemLbl = document.createElement('label');
  itemLbl.textContent = 'Item';
  const itemSelEl = document.createElement('select');
  itemSelEl.innerHTML = '<option value="">— Select category first —</option>';
  itemSelEl.id = `itemSel_${idx}`;
  itemGrp.appendChild(itemLbl); itemGrp.appendChild(itemSelEl);
  grid.appendChild(itemGrp);

  body.appendChild(grid);

  // ── Qty row (hidden by default) ──
  const qtyRow = document.createElement('div');
  qtyRow.className = 'qty-row';
  qtyRow.style.display = 'none';
  const qtyLbl = document.createElement('label');
  qtyLbl.textContent = 'Quantity:';
  const qtyInp = document.createElement('input');
  qtyInp.type = 'number'; qtyInp.min = '1'; qtyInp.value = '1';
  qtyRow.appendChild(qtyLbl); qtyRow.appendChild(qtyInp);
  body.appendChild(qtyRow);

  // ── Add Item button ──
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.style.cssText = 'width:100%; margin-bottom:12px;';
  addBtn.textContent = '+ Add Item to Bag';
  addBtn.disabled = true;
  body.appendChild(addBtn);

  // Tom Select instance
  let tomInst = null;

  // Category change
  catSel.addEventListener('change', () => {
    const cat = catSel.value;
    if (tomInst) { tomInst.destroy(); tomInst = null; }
    itemSelEl.innerHTML = '<option value=""></option>';
    addBtn.disabled = true;
    qtyRow.style.display = 'none';
    qtyInp.value = '1';
    if (!cat || !INVENTORY[cat]) return;

    INVENTORY[cat].items.forEach(it => {
      const o = document.createElement('option');
      o.value = it.name; o.textContent = it.name;
      itemSelEl.appendChild(o);
    });

    tomInst = new TomSelect(`#itemSel_${idx}`, {
      placeholder: 'Search item…', maxOptions: 200,
      sortField: { field: 'text', direction: 'asc' },
      onChange(val) {
        addBtn.disabled = !val;
        qtyRow.style.display = (val && QUANTITY_CATS.has(cat)) ? '' : 'none';
        if (!val) qtyInp.value = '1';
      }
    });
  });

  // Add item
  addBtn.addEventListener('click', () => {
    const cat  = catSel.value;
    const name = tomInst ? tomInst.getValue() : '';
    if (!cat || !name) return;
    const isQty = QUANTITY_CATS.has(cat);
    const qty   = isQty ? (parseInt(qtyInp.value) || 1) : 1;
    bag.items.push({ cat, name, qty, isQty });

    // Reset adder
    catSel.value = '';
    if (tomInst) { tomInst.destroy(); tomInst = null; }
    itemSelEl.innerHTML = '<option value="">— Select category first —</option>';
    qtyRow.style.display = 'none';
    qtyInp.value = '1';
    addBtn.disabled = true;

    updateBagItemsList(bag, idx);
    updateBagCountPill(bag, idx);
    renderTotals();
    renderSummary();
    broadcastToJotform();
  });

  // ── Items list ──
  const listDiv = document.createElement('div');
  listDiv.id = `bagItemsList_${idx}`;
  body.appendChild(listDiv);
  renderBagItemsList(bag, idx, listDiv);

  // ── Bag weight input ──
  const wRow = document.createElement('div');
  wRow.className = 'bag-weight-input-row';
  const wLbl = document.createElement('label');
  wLbl.textContent = `Bag ${idx + 1} Weight:`;
  const wInp = document.createElement('input');
  wInp.type = 'number'; wInp.min = '0'; wInp.step = '0.001';
  wInp.placeholder = '0.000';
  wInp.value = bag.weight || '';
  wInp.addEventListener('input', () => {
    bag.weight = wInp.value;
    renderTotals();
    renderSummary();
    broadcastToJotform();
  });
  const wUnit = document.createElement('span');
  wUnit.className = 'kg-unit'; wUnit.textContent = 'kg';
  wRow.appendChild(wLbl); wRow.appendChild(wInp); wRow.appendChild(wUnit);
  body.appendChild(wRow);

  card.appendChild(body);
  return card;
}

// ── Update just the items list inside a bag (without full rebuild) ──
function updateBagItemsList(bag, idx) {
  const listDiv = document.getElementById(`bagItemsList_${idx}`);
  if (listDiv) renderBagItemsList(bag, idx, listDiv);
}

function updateBagCountPill(bag, idx) {
  const pill = document.getElementById(`bagCount_${idx}`);
  if (pill) pill.textContent = formatItemCount(bag);
}

function formatItemCount(bag) {
  const total = bag.items.reduce((s, it) => s + (it.isQty ? it.qty : 1), 0);
  return `${total} item${total !== 1 ? 's' : ''}`;
}

function renderBagItemsList(bag, idx, container) {
  container.innerHTML = '';
  if (bag.items.length === 0) {
    container.innerHTML = '<p class="no-items-msg">No items added yet.</p>';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'bag-items-list';
  bag.items.forEach((it, iIdx) => {
    const li = document.createElement('li');
    li.className = 'bag-item-row';

    const catTag = document.createElement('span');
    catTag.className = 'item-cat-tag';
    catTag.textContent = it.cat;

    const nm = document.createElement('span');
    nm.className = 'item-name-text';
    nm.textContent = it.name;

    const rm = document.createElement('button');
    rm.className = 'btn-danger-sm';
    rm.textContent = '✕';
    rm.addEventListener('click', () => {
      bag.items.splice(iIdx, 1);
      updateBagItemsList(bag, idx);
      updateBagCountPill(bag, idx);
      renderTotals();
      renderSummary();
      broadcastToJotform();
    });

    li.appendChild(catTag);
    li.appendChild(nm);

    if (it.isQty && it.qty > 1) {
      const qTag = document.createElement('span');
      qTag.className = 'item-qty-tag';
      qTag.textContent = `×${it.qty}`;
      li.appendChild(qTag);
    }

    li.appendChild(rm);
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

// ── Render Grand Totals ──
function renderTotals() {
  const totalItems  = bags.reduce((s, b) => s + b.items.reduce((si, it) => si + (it.isQty ? it.qty : 1), 0), 0);
  const totalWeight = bags.reduce((s, b) => s + (parseFloat(b.weight) || 0), 0);
  document.getElementById('gtBags').textContent   = bags.length;
  document.getElementById('gtItems').textContent  = totalItems;
  document.getElementById('gtWeight').textContent = totalWeight.toFixed(3) + ' kg';
}

// ── Summary Text ──
function buildSummaryText() {
  if (bags.length === 0) return '— No bags —';
  let lines = [];
  let grandItems = 0, grandWeight = 0;

  bags.forEach((bag, idx) => {
    const bagW     = parseFloat(bag.weight) || 0;
    const bagCount = bag.items.reduce((s, it) => s + (it.isQty ? it.qty : 1), 0);
    grandItems  += bagCount;
    grandWeight += bagW;

    lines.push(`--- BAG ${idx + 1} ---`);
    if (bag.items.length === 0) {
      lines.push('(no items)');
    } else {
      bag.items.forEach(it => {
        const qStr = it.isQty && it.qty > 1 ? ` ×${it.qty}` : '';
        lines.push(`[${it.cat}] ${it.name}${qStr}`);
      });
    }
    lines.push(`BAG WEIGHT: ${bagW.toFixed(3)}kg`);
    lines.push('');
  });

  lines.push(`TOTAL BAGS: ${bags.length}`);
  lines.push(`TOTAL ITEMS: ${grandItems}`);
  lines.push(`TOTAL WEIGHT: ${grandWeight.toFixed(3)}kg`);
  return lines.join('\n');
}

function renderSummary() {
  window.latestSubmissionText = buildSummaryText();
}

// ── JotForm ──
function setupJotform() {
  if (typeof JFCustomWidget === 'undefined') return;
  JFCustomWidget.subscribe('submit', () =>
    JFCustomWidget.sendSubmit({ valid: true, value: window.latestSubmissionText }));
  JFCustomWidget.subscribe('ready', broadcastToJotform);
}

function broadcastToJotform() {
  const value = window.latestSubmissionText;
  if (typeof JFCustomWidget !== 'undefined') {
    try { JFCustomWidget.sendData({ value }); } catch(e) {}
  }
  try {
    if (window.parent && window.parent !== window) {
      // TODO: update input_XX to the correct field ID for this JotForm
      const t = window.parent.document.getElementById('input_82');
      if (t) {
        t.value = value;
        t.dispatchEvent(new Event('input',  { bubbles: true }));
        t.dispatchEvent(new Event('change', { bubbles: true }));
      }
      window.parent.postMessage(
        JSON.stringify({ type: 'widgetValue', value, valid: true }), '*');
    }
  } catch(e) {}
}

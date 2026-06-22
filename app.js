/**
 * Noelle West — Send to Laundry Shop
 * Accordion layout: bags collapse/expand, weighed as a whole.
 */

const SHEET_ID = '1-QD9UJ99Rjl1JPlBdKPo7hz5MBOiJKkMyD-qWlD520s';

const SHEET_NAMES = [
  'BGS','BGI','PGS','PGI','MOH','BMG','FGG','PGC','FIL',
  'MG','CD','MS','CS','PET-#','PET',
  'BCPO','BOY','BPSC','BPO','BPOL','BPS','COAT BARONG',
  'BCC','BPOC','VST','S-UPPER','POLO','ACC','PEN','PANTS'
];

const QUANTITY_CATS = new Set([
  'BCPO','BPSC','BPS','ACC','PEN','PANTS','S-UPPER',
  'PET','MOH','BMG','FGG',
  'BOY','BPO','BPOL','COAT BARONG','BCC','BPOC','VST','POLO'
]);

// State
let INVENTORY = {};
let bags = []; // [ { items: [{cat,name,qty,isQty}], weight: '' } ]
let tomInstances = {}; // keyed by bag idx
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
    const data = await loadFromSheets();
    if (data && Object.keys(data).length > 0) {
      INVENTORY = data;
      setBadge('🟢 Live from Google Sheets', '#3DAB6A');
      return;
    }
  } catch(e) { console.warn('Sheets failed:', e); }
  setBadge('🔴 Could not load inventory', '#E05252');
}

function setBadge(t, c) {
  const b = document.getElementById('sourceBadge');
  if (b) { b.textContent = t; b.style.color = c; }
}

// ── Google Sheets CSV ──
async function loadFromSheets() {
  const result = {};
  const fetches = SHEET_NAMES.map(name =>
    fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`)
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(csv => ({ name, csv }))
      .catch(() => ({ name, csv: null }))
  );
  for (const { name, csv } of await Promise.all(fetches)) {
    if (!csv || csv.trim().startsWith('<') || !csv.trim()) continue;
    const rows = parseCSV(csv);
    if (rows.length < 2) continue;
    const header = rows[0].map(h => h.trim().toUpperCase());
    let ni = header.findIndex(h => h.includes('PRODUCT NAME'));
    if (ni < 0) ni = 0;
    const items = rows.slice(1).map(r => (r[ni] || '').trim()).filter(Boolean).map(n => ({ name: n }));
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

  // Destroy old tom instances
  Object.values(tomInstances).forEach(t => { try { t.destroy(); } catch(e){} });
  tomInstances = {};

  while (bags.length < n) bags.push({ items: [], weight: '' });
  while (bags.length > n) bags.pop();

  renderAllBags();
  renderTotals();
  renderSummary();
};

// ── Render All Bags (accordion) ──
function renderAllBags() {
  const container = document.getElementById('bagsContainer');
  container.innerHTML = '';
  bags.forEach((bag, idx) => container.appendChild(buildAccItem(bag, idx)));
  document.getElementById('grandTotalsCard').style.display = bags.length ? '' : 'none';
  // Open the first bag by default
  if (bags.length > 0) {
    const first = document.getElementById(`acc_${0}`);
    if (first) first.classList.add('open');
  }
}

// ── Build Accordion Item ──
function buildAccItem(bag, idx) {
  const acc = document.createElement('div');
  acc.className = 'acc-item';
  acc.id = `acc_${idx}`;

  // ── Header ──
  const hdr = document.createElement('div');
  hdr.className = 'acc-header';

  const chevron = document.createElement('span');
  chevron.className = 'acc-chevron';
  chevron.textContent = '▶';

  const title = document.createElement('span');
  title.className = 'acc-title';
  title.textContent = `Bag ${idx + 1}`;

  const meta = document.createElement('div');
  meta.className = 'acc-meta';
  meta.id = `accMeta_${idx}`;
  updateMeta(meta, bag);

  hdr.appendChild(chevron);
  hdr.appendChild(title);
  hdr.appendChild(meta);

  hdr.addEventListener('click', () => toggleAcc(idx));
  acc.appendChild(hdr);

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'acc-body';
  body.id = `accBody_${idx}`;

  // Adder row: Category + Item
  const adderRow = document.createElement('div');
  adderRow.className = 'adder-row';

  const catGrp = document.createElement('div');
  catGrp.className = 'form-group';
  const catLbl = document.createElement('label');
  catLbl.textContent = 'Category';
  const catSel = document.createElement('select');
  catSel.innerHTML = '<option value="">— Select —</option>';
  SHEET_NAMES.filter(n => INVENTORY[n]).forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c; catSel.appendChild(o);
  });
  catGrp.appendChild(catLbl); catGrp.appendChild(catSel);
  adderRow.appendChild(catGrp);

  const itemGrp = document.createElement('div');
  itemGrp.className = 'form-group';
  const itemLbl = document.createElement('label');
  itemLbl.textContent = 'Item';
  const itemSel = document.createElement('select');
  itemSel.id = `itemSel_${idx}`;
  itemSel.innerHTML = '<option value="">— Select category —</option>';
  itemGrp.appendChild(itemLbl); itemGrp.appendChild(itemSel);
  adderRow.appendChild(itemGrp);
  body.appendChild(adderRow);

  // Qty + Add button row
  const qaRow = document.createElement('div');
  qaRow.className = 'qty-add-row';

  const qtyField = document.createElement('div');
  qtyField.className = 'qty-field';
  const qtyLbl = document.createElement('label');
  qtyLbl.textContent = 'Qty';
  const qtyInp = document.createElement('input');
  qtyInp.type = 'number'; qtyInp.min = '1'; qtyInp.value = '1';
  qtyField.appendChild(qtyLbl); qtyField.appendChild(qtyInp);
  qaRow.appendChild(qtyField);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary btn-sm';
  addBtn.textContent = '+ Add Item';
  addBtn.disabled = true;
  addBtn.style.alignSelf = 'flex-end';
  qaRow.appendChild(addBtn);
  body.appendChild(qaRow);

  // Wire category change → rebuild item dropdown
  let tomInst = null;
  catSel.addEventListener('change', () => {
    const cat = catSel.value;
    if (tomInst) { tomInst.destroy(); tomInst = null; delete tomInstances[idx]; }
    itemSel.innerHTML = '<option value=""></option>';
    addBtn.disabled = true;
    qtyField.style.display = 'none';
    qtyInp.value = '1';
    if (!cat || !INVENTORY[cat]) return;    INVENTORY[cat].items.forEach(it => {
      const o = document.createElement('option');
      o.value = it.name; o.textContent = it.name; itemSel.appendChild(o);
    });
    tomInst = new TomSelect(`#itemSel_${idx}`, {
      placeholder: 'Search item…', maxOptions: 200,
      sortField: { field: 'text', direction: 'asc' },
      onChange(val) {
        addBtn.disabled = !val;
        qtyField.style.display = (val && QUANTITY_CATS.has(cat)) ? 'flex' : 'none';
        if (!val) qtyInp.value = '1';
      }
    });
    tomInstances[idx] = tomInst;
  });

  // Wire Add button
  addBtn.addEventListener('click', () => {
    const cat  = catSel.value;
    const name = tomInst ? tomInst.getValue() : '';
    if (!cat || !name) return;
    const isQty = QUANTITY_CATS.has(cat);
    const qty   = isQty ? (parseInt(qtyInp.value) || 1) : 1;
    bag.items.push({ cat, name, qty, isQty });

    // Reset adder
    catSel.value = '';
    if (tomInst) { tomInst.destroy(); tomInst = null; delete tomInstances[idx]; }
    itemSel.innerHTML = '<option value="">— Select category —</option>';
    qtyField.style.display = 'none';
    qtyInp.value = '1';
    addBtn.disabled = true;

    refreshItemsList(bag, idx);
    refreshMeta(bag, idx);
    renderTotals();
    renderSummary();
    broadcastToJotform();
  });

  // Items list
  const listDiv = document.createElement('div');
  listDiv.id = `itemsList_${idx}`;
  body.appendChild(listDiv);
  renderItemsList(bag, idx, listDiv);

  // Bag weight
  const wRow = document.createElement('div');
  wRow.className = 'bag-weight-row';
  const wLbl = document.createElement('label');
  wLbl.textContent = `Bag ${idx + 1} Weight:`;
  const wInp = document.createElement('input');
  wInp.type = 'number'; wInp.min = '0'; wInp.step = '0.001';
  wInp.placeholder = '0.000'; wInp.value = bag.weight || '';
  wInp.addEventListener('input', () => {
    bag.weight = wInp.value;
    refreshMeta(bag, idx);
    renderTotals();
    renderSummary();
    broadcastToJotform();
  });
  const wUnit = document.createElement('span');
  wUnit.className = 'kg-unit'; wUnit.textContent = 'kg';
  wRow.appendChild(wLbl); wRow.appendChild(wInp); wRow.appendChild(wUnit);
  body.appendChild(wRow);

  acc.appendChild(body);
  return acc;
}

// ── Toggle accordion ──
function toggleAcc(idx) {
  const target = document.getElementById(`acc_${idx}`);
  const isOpen = target.classList.contains('open');
  // Close all
  bags.forEach((_, i) => {
    const el = document.getElementById(`acc_${i}`);
    if (el) el.classList.remove('open');
  });
  // Open clicked if it was closed
  if (!isOpen) target.classList.add('open');
}

// ── Refresh items list inside a bag ──
function refreshItemsList(bag, idx) {
  const div = document.getElementById(`itemsList_${idx}`);
  if (div) renderItemsList(bag, idx, div);
}

function renderItemsList(bag, idx, container) {
  container.innerHTML = '';
  if (bag.items.length === 0) {
    container.innerHTML = '<p class="no-items">No items yet.</p>';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'items-list';
  bag.items.forEach((it, iIdx) => {
    const li = document.createElement('li');
    li.className = 'item-row';

    const cat = document.createElement('span');
    cat.className = 'item-cat'; cat.textContent = it.cat;

    const nm = document.createElement('span');
    nm.className = 'item-name'; nm.textContent = it.name;

    const rm = document.createElement('button');
    rm.className = 'item-rm'; rm.textContent = '✕';
    rm.addEventListener('click', () => {
      bag.items.splice(iIdx, 1);
      refreshItemsList(bag, idx);
      refreshMeta(bag, idx);
      renderTotals();
      renderSummary();
      broadcastToJotform();
    });

    li.appendChild(cat); li.appendChild(nm);
    if (it.isQty && it.qty > 1) {
      const q = document.createElement('span');
      q.className = 'item-qty'; q.textContent = `×${it.qty}`;
      li.appendChild(q);
    }
    li.appendChild(rm);
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

// ── Refresh accordion header meta chips ──
function refreshMeta(bag, idx) {
  const meta = document.getElementById(`accMeta_${idx}`);
  if (meta) updateMeta(meta, bag);
}

function updateMeta(meta, bag) {
  meta.innerHTML = '';
  const totalUnits = bag.items.reduce((s, it) => s + (it.isQty ? it.qty : 1), 0);
  const w = parseFloat(bag.weight) || 0;

  const c1 = document.createElement('span');
  c1.className = 'acc-meta-chip';
  c1.textContent = `${totalUnits} item${totalUnits !== 1 ? 's' : ''}`;
  meta.appendChild(c1);

  if (w > 0) {
    const c2 = document.createElement('span');
    c2.className = 'acc-meta-chip';
    c2.textContent = `${w.toFixed(3)} kg`;
    meta.appendChild(c2);
  }
}

// ── Grand Totals ──
function renderTotals() {
  const totalItems  = bags.reduce((s, b) => s + b.items.reduce((si, it) => si + (it.isQty ? it.qty : 1), 0), 0);
  const totalWeight = bags.reduce((s, b) => s + (parseFloat(b.weight) || 0), 0);
  document.getElementById('gtBags').textContent   = bags.length;
  document.getElementById('gtItems').textContent  = totalItems;
  document.getElementById('gtWeight').textContent = totalWeight.toFixed(3) + ' kg';
}

// ── Summary ──
function buildSummaryText() {
  if (!bags.length) return '— No bags —';
  let lines = [], grandItems = 0, grandWeight = 0;

  bags.forEach((bag, idx) => {
    const w = parseFloat(bag.weight) || 0;
    const n = bag.items.reduce((s, it) => s + (it.isQty ? it.qty : 1), 0);
    grandItems += n; grandWeight += w;

    lines.push(`BAG ${idx + 1} (${w.toFixed(3)}kg):`);

    if (!bag.items.length) {
      lines.push('  (no items)');
    } else {
      // Group by category, preserving insertion order
      const catMap = {};
      bag.items.forEach(it => {
        if (!catMap[it.cat]) catMap[it.cat] = [];
        catMap[it.cat].push(it.name + (it.isQty && it.qty > 1 ? ` ×${it.qty}` : ''));
      });
      Object.entries(catMap).forEach(([cat, items]) => {
        lines.push(`  ${cat}: ${items.join(', ')}`);
      });
    }

    lines.push(`  BAG WEIGHT: ${w.toFixed(3)}kg`);
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
      // TODO: update input_XX to the correct JotForm field ID for this form
      const t = window.parent.document.getElementById('input_82');
      if (t) {
        t.value = value;
        t.dispatchEvent(new Event('input',  { bubbles: true }));
        t.dispatchEvent(new Event('change', { bubbles: true }));
      }
      window.parent.postMessage(JSON.stringify({ type: 'widgetValue', value, valid: true }), '*');
    }
  } catch(e) {}
}

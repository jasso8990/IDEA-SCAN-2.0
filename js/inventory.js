/* ============================
   INVENTORY.JS
   ============================ */

let allProducts = [];
let sortField   = 'name';
let sortAsc     = true;

document.addEventListener('DOMContentLoaded', () => {
  loadInventory();
  populateLocationSelect('product-location');
  populateCategoryFilter();
});

function loadInventory() {
  allProducts = getProducts();
  renderTable(allProducts);
}

function renderTable(products) {
  const tbody = document.getElementById('inventory-body');
  const count = document.getElementById('table-count');
  if (count) count.textContent = `${products.length} producto${products.length !== 1 ? 's' : ''}`;

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No se encontraron productos</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const status = getStockStatus(p);
    return `
      <tr>
        <td><code style="font-size:12px;color:var(--primary)">${p.sku}</code></td>
        <td><strong>${p.name}</strong><br><span style="font-size:11px;color:var(--text-muted)">${p.description || ''}</span></td>
        <td><span class="badge badge-blue">${p.category}</span></td>
        <td>
          <strong style="font-size:15px">${p.stock}</strong>
          <span style="color:var(--text-muted);font-size:11px"> ${p.unit}</span>
        </td>
        <td>${p.minStock}</td>
        <td>${p.location || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${p.unit}</td>
        <td><span class="badge ${status.class}">${status.label}</span></td>
        <td>
          <button class="btn-icon" title="Ver detalle" onclick="viewProduct('${p.id}')">👁</button>
          <button class="btn-icon" title="Editar" onclick="editProduct('${p.id}')">✏️</button>
          <button class="btn-icon" title="Eliminar" onclick="deleteProductConfirm('${p.id}')">🗑</button>
        </td>
      </tr>`;
  }).join('');
}

function filterInventory() {
  const search   = document.getElementById('search-input').value.toLowerCase();
  const category = document.getElementById('filter-category').value;
  const status   = document.getElementById('filter-status').value;

  let filtered = allProducts.filter(p => {
    const matchSearch   = !search || p.sku.toLowerCase().includes(search) ||
                          p.name.toLowerCase().includes(search) ||
                          p.category.toLowerCase().includes(search);
    const matchCategory = !category || p.category === category;
    const matchStatus   = !status   || getStockStatus(p).key === status;
    return matchSearch && matchCategory && matchStatus;
  });

  renderTable(filtered);
}

function sortTable(field) {
  if (sortField === field) { sortAsc = !sortAsc; }
  else { sortField = field; sortAsc = true; }

  allProducts.sort((a, b) => {
    let va = a[field], vb = b[field];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  filterInventory();
}

function populateCategoryFilter() {
  const products   = getProducts();
  const categories = [...new Set(products.map(p => p.category))].sort();
  const sel = document.getElementById('filter-category');
  if (!sel) return;
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

function populateLocationSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const locations = getLocations().filter(l => l.status === 'active');
  locations.forEach(l => {
    const opt = document.createElement('option');
    opt.value = getLocationCode(l);
    opt.textContent = `${getLocationCode(l)} — ${l.description || l.type}`;
    sel.appendChild(opt);
  });
}

function saveProduct() {
  const editId  = document.getElementById('product-edit-id').value;
  const sku     = document.getElementById('product-sku').value.trim();
  const name    = document.getElementById('product-name').value.trim();
  const category= document.getElementById('product-category').value.trim();

  if (!sku || !name || !category) {
    showToast('Completa los campos obligatorios (SKU, Nombre, Categoría)', 'error');
    return;
  }

  // Check duplicate SKU (not for edits)
  if (!editId) {
    const existing = getProducts().find(p => p.sku.toLowerCase() === sku.toLowerCase());
    if (existing) { showToast('Ya existe un producto con ese SKU', 'error'); return; }
  }

  const data = {
    sku,
    name,
    category,
    unit:        document.getElementById('product-unit').value,
    stock:       parseInt(document.getElementById('product-stock').value) || 0,
    minStock:    parseInt(document.getElementById('product-min-stock').value) || 0,
    price:       parseFloat(document.getElementById('product-price').value) || 0,
    location:    document.getElementById('product-location').value,
    description: document.getElementById('product-description').value.trim(),
  };

  if (editId) {
    updateProduct(editId, data);
    showToast('Producto actualizado correctamente', 'success');
  } else {
    addProduct(data);
    showToast('Producto agregado correctamente', 'success');
  }

  closeModal('modal-product');
  clearProductForm();
  loadInventory();
  populateCategoryFilter();
}

function editProduct(id) {
  const p = getProductById(id);
  if (!p) return;

  document.getElementById('modal-product-title').textContent = 'Editar Producto';
  document.getElementById('product-edit-id').value      = p.id;
  document.getElementById('product-sku').value          = p.sku;
  document.getElementById('product-name').value         = p.name;
  document.getElementById('product-category').value     = p.category;
  document.getElementById('product-unit').value         = p.unit;
  document.getElementById('product-stock').value        = p.stock;
  document.getElementById('product-min-stock').value    = p.minStock;
  document.getElementById('product-price').value        = p.price;
  document.getElementById('product-location').value     = p.location || '';
  document.getElementById('product-description').value  = p.description || '';

  openModal('modal-product');
}

function viewProduct(id) {
  const p  = getProductById(id);
  if (!p) return;
  const status   = getStockStatus(p);
  const movements= getMovements().filter(m => m.productId === id).slice(0, 10);

  const body = document.getElementById('product-detail-body');
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div>
        <div style="margin-bottom:12px"><span style="color:var(--text-muted);font-size:12px">SKU</span><br><code style="color:var(--primary);font-size:15px">${p.sku}</code></div>
        <div style="margin-bottom:12px"><span style="color:var(--text-muted);font-size:12px">NOMBRE</span><br><strong>${p.name}</strong></div>
        <div style="margin-bottom:12px"><span style="color:var(--text-muted);font-size:12px">CATEGORÍA</span><br><span class="badge badge-blue">${p.category}</span></div>
        <div style="margin-bottom:12px"><span style="color:var(--text-muted);font-size:12px">DESCRIPCIÓN</span><br>${p.description || '—'}</div>
      </div>
      <div>
        <div style="margin-bottom:12px"><span style="color:var(--text-muted);font-size:12px">STOCK ACTUAL</span><br><strong style="font-size:28px">${p.stock}</strong> <span style="color:var(--text-muted)">${p.unit}</span></div>
        <div style="margin-bottom:12px"><span style="color:var(--text-muted);font-size:12px">STOCK MÍNIMO</span><br>${p.minStock} ${p.unit}</div>
        <div style="margin-bottom:12px"><span style="color:var(--text-muted);font-size:12px">ESTADO</span><br><span class="badge ${status.class}">${status.label}</span></div>
        <div style="margin-bottom:12px"><span style="color:var(--text-muted);font-size:12px">UBICACIÓN</span><br>${p.location || '—'}</div>
        <div style="margin-bottom:12px"><span style="color:var(--text-muted);font-size:12px">PRECIO UNITARIO</span><br>${formatCurrency(p.price)}</div>
      </div>
    </div>
    <h4 style="margin-bottom:10px;font-size:14px">Últimos movimientos</h4>
    ${movements.length === 0 ? '<p style="color:var(--text-muted);font-size:13px">Sin movimientos</p>' :
      `<table class="data-table">
        <thead><tr><th>Folio</th><th>Tipo</th><th>Cantidad</th><th>Fecha</th><th>Usuario</th></tr></thead>
        <tbody>${movements.map(m => `
          <tr>
            <td><code>${m.folio}</code></td>
            <td><span class="badge ${m.type==='in'?'badge-green':'badge-red'}">${m.type==='in'?'Entrada':'Salida'}</span></td>
            <td>${m.qty} ${p.unit}</td>
            <td>${formatDate(m.date)}</td>
            <td>${m.userName}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}`;

  openModal('modal-product-detail');
}

function deleteProductConfirm(id) {
  const p = getProductById(id);
  if (!p) return;
  confirmDialog(`¿Eliminar el producto "${p.name}"? Esta acción no se puede deshacer.`, () => {
    deleteProduct(id);
    showToast('Producto eliminado', 'info');
    loadInventory();
  });
}

function clearProductForm() {
  document.getElementById('product-edit-id').value     = '';
  document.getElementById('modal-product-title').textContent = 'Nuevo Producto';
  ['product-sku','product-name','product-category','product-description'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('product-stock').value    = '0';
  document.getElementById('product-min-stock').value= '5';
  document.getElementById('product-price').value    = '0';
}

// Reset form when opening modal for new product
document.querySelector('.btn-primary')?.addEventListener('click', () => {
  clearProductForm();
});

function exportCSV() {
  const products = getProducts();
  const headers = ['SKU','Nombre','Categoría','Stock','Stock Mínimo','Unidad','Precio','Ubicación','Estado'];
  const rows = products.map(p => [
    p.sku, p.name, p.category, p.stock, p.minStock, p.unit, p.price, p.location || '', getStockStatus(p).label
  ]);
  downloadCSV('inventario.csv', [headers, ...rows]);
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

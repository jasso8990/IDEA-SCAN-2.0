/* ============================
   LOCATIONS.JS
   ============================ */

document.addEventListener('DOMContentLoaded', () => {
  loadLocations();
  renderWarehouseMap();
});

function loadLocations() {
  const locations = getLocations();
  renderLocationsTable(locations);
  renderWarehouseMap();
}

function renderLocationsTable(locations) {
  const tbody = document.getElementById('locations-body');
  const products = getProducts();

  if (locations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No hay ubicaciones registradas</td></tr>';
    return;
  }

  tbody.innerHTML = locations.map(l => {
    const code    = getLocationCode(l);
    const prods   = products.filter(p => p.location === code);
    const usedCap = prods.reduce((sum, p) => sum + p.stock, 0);
    const pct     = Math.min(100, Math.round((usedCap / l.capacity) * 100));
    const statusClass = l.status === 'active'
      ? (pct >= 90 ? 'badge-red' : pct > 0 ? 'badge-yellow' : 'badge-green')
      : 'badge-gray';
    const statusLabel = l.status === 'inactive' ? 'Inactivo'
      : (pct >= 90 ? 'Lleno' : pct > 0 ? 'Parcial' : 'Disponible');

    return `
      <tr>
        <td><code style="color:var(--primary)">${code}</code></td>
        <td>${l.zone}</td>
        <td>${l.aisle}</td>
        <td>${l.position}</td>
        <td><span class="badge badge-blue">${l.type}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:var(--bg3);border-radius:4px;height:6px;min-width:60px">
              <div style="width:${pct}%;background:${pct>=90?'var(--red)':pct>0?'var(--yellow)':'var(--green)'};height:100%;border-radius:4px"></div>
            </div>
            <span style="font-size:11px;color:var(--text-muted)">${usedCap}/${l.capacity}</span>
          </div>
        </td>
        <td>${prods.length} producto${prods.length !== 1 ? 's' : ''}</td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td>
          <button class="btn-icon" onclick="editLocation('${l.id}')">✏️</button>
          <button class="btn-icon" onclick="deleteLocationConfirm('${l.id}')">🗑</button>
        </td>
      </tr>`;
  }).join('');
}

function renderWarehouseMap() {
  const mapEl    = document.getElementById('warehouse-map');
  if (!mapEl) return;
  const locations = getLocations();
  const products  = getProducts();

  if (locations.length === 0) {
    mapEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No hay ubicaciones definidas</p>';
    return;
  }

  mapEl.innerHTML = locations.map(l => {
    const code  = getLocationCode(l);
    const prods = products.filter(p => p.location === code);
    const used  = prods.reduce((s, p) => s + p.stock, 0);
    const pct   = Math.min(100, (used / l.capacity) * 100);

    let slotClass = 'inactive';
    if (l.status === 'active') {
      slotClass = pct >= 90 ? 'full' : pct > 0 ? 'partial' : 'available';
    }

    return `
      <div class="map-slot ${slotClass}" title="${code} — ${prods.length} productos, ${used}/${l.capacity} unidades" onclick="showLocationTooltip('${code}')">
        <span>${l.zone}</span>
        <span class="slot-code">${l.aisle}-${l.position}</span>
      </div>`;
  }).join('');
}

function showLocationTooltip(code) {
  const products = getProducts().filter(p => p.location === code);
  if (products.length === 0) {
    showToast(`${code}: Sin productos`, 'info');
  } else {
    showToast(`${code}: ${products.map(p => p.name).join(', ')}`, 'info');
  }
}

function filterLocations() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const all    = getLocations();
  const filtered = all.filter(l => {
    const code = getLocationCode(l).toLowerCase();
    return !search || code.includes(search) || l.type.includes(search) || (l.description || '').toLowerCase().includes(search);
  });
  renderLocationsTable(filtered);
}

function saveLocation() {
  const editId   = document.getElementById('location-edit-id').value;
  const zone     = document.getElementById('location-zone').value.trim().toUpperCase();
  const aisle    = document.getElementById('location-aisle').value.trim();
  const position = document.getElementById('location-position').value.trim();

  if (!zone || !aisle || !position) {
    showToast('Completa los campos de Zona, Pasillo y Posición', 'error');
    return;
  }

  const data = {
    zone, aisle, position,
    type:        document.getElementById('location-type').value,
    capacity:    parseInt(document.getElementById('location-capacity').value) || 100,
    status:      document.getElementById('location-status').value,
    description: document.getElementById('location-description').value.trim(),
  };

  if (editId) {
    updateLocation(editId, data);
    showToast('Ubicación actualizada', 'success');
  } else {
    addLocation(data);
    showToast('Ubicación creada', 'success');
  }

  closeModal('modal-location');
  clearLocationForm();
  loadLocations();
}

function editLocation(id) {
  const l = getLocations().find(loc => loc.id === id);
  if (!l) return;
  document.getElementById('modal-location-title').textContent = 'Editar Ubicación';
  document.getElementById('location-edit-id').value    = l.id;
  document.getElementById('location-zone').value       = l.zone;
  document.getElementById('location-aisle').value      = l.aisle;
  document.getElementById('location-position').value   = l.position;
  document.getElementById('location-type').value       = l.type;
  document.getElementById('location-capacity').value   = l.capacity;
  document.getElementById('location-status').value     = l.status;
  document.getElementById('location-description').value= l.description || '';
  openModal('modal-location');
}

function deleteLocationConfirm(id) {
  const l = getLocations().find(loc => loc.id === id);
  if (!l) return;
  const code = getLocationCode(l);
  const hasProducts = getProducts().some(p => p.location === code);
  const msg = hasProducts
    ? `La ubicación "${code}" tiene productos asignados. ¿Eliminar de todos modos?`
    : `¿Eliminar la ubicación "${code}"?`;
  confirmDialog(msg, () => {
    deleteLocation(id);
    showToast('Ubicación eliminada', 'info');
    loadLocations();
  });
}

function clearLocationForm() {
  document.getElementById('location-edit-id').value     = '';
  document.getElementById('modal-location-title').textContent = 'Nueva Ubicación';
  document.getElementById('location-zone').value        = '';
  document.getElementById('location-aisle').value       = '';
  document.getElementById('location-position').value    = '';
  document.getElementById('location-description').value = '';
  document.getElementById('location-capacity').value    = '100';
}

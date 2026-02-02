const PREFIX = 'ast01_';
const DOM = {
    tableBody: document.getElementById(PREFIX + 'table_body'),
    loading: document.getElementById(PREFIX + 'loading_state'),
    empty: document.getElementById(PREFIX + 'empty_state'),
    sidebar: document.getElementById(PREFIX + 'sidebar'),
    overlay: document.getElementById(PREFIX + 'sidebar_overlay'),
    form: document.getElementById(PREFIX + 'form'),
    search: document.getElementById(PREFIX + 'search'),
    f_standort: document.getElementById(PREFIX + 'f_standort')
};

let allAssets = [];
let locationCache = {}; // Cache for lookup { id: "Bezeichnung" }

// --- HELPERS ---

function showSidebar(open = true) {
    if (open) {
        DOM.sidebar.classList.add('open');
        DOM.overlay.classList.remove('hidden');
    } else {
        DOM.sidebar.classList.remove('open');
        DOM.overlay.classList.add('hidden');
        DOM.form.reset();
        document.getElementById(PREFIX + 'f_id').value = '';
    }
}

function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('aktiv') || s.includes('betrieb')) return 'ast01-badge-success';
    if (s.includes('wartung') || s.includes('reparatur')) return 'ast01-badge-warning';
    if (s.includes('defekt') || s.includes('ausgemustert')) return 'ast01-badge-danger';
    return 'ast01-badge-neutral';
}

// --- DATA LOADING ---

async function loadData() {
    DOM.loading.classList.remove('hidden');
    DOM.tableBody.innerHTML = '';
    DOM.empty.classList.add('hidden');

    try {
        // Load assets and locations concurrently
        const [assetsRes, locsRes] = await Promise.all([
            listBubbleObjects('gen_asset', { limit: 100, sortField: 'Created Date', descending: true }),
            listBubbleObjects('gen_standort', { limit: 100 })
        ]);

        if (locsRes.success) {
            // Update location cache for column lookup
            locationCache = {};
            locsRes.data.forEach(loc => {
                locationCache[loc._id] = loc.bezeichnung_text || 'Unbenannter Standort';
            });
            
            // Update Sidebar Dropdown
            DOM.f_standort.innerHTML = '<option value="">Kein Standort zugewiesen</option>' + 
                locsRes.data.map(i => `<option value="${i._id}">${i.bezeichnung_text || 'Unbenannt'}</option>`).join('');
        }

        if (assetsRes.success) {
            allAssets = assetsRes.data;
            renderAssets(allAssets);
        } else {
            Swal.fire('Fehler', 'Assets konnten nicht geladen werden.', 'error');
        }

    } catch (e) {
        console.error('Error loading data', e);
    } finally {
        DOM.loading.classList.add('hidden');
    }
}

function renderAssets(items) {
    DOM.tableBody.innerHTML = '';
    
    if (!items || items.length === 0) {
        DOM.empty.classList.remove('hidden');
        return;
    }

    const rows = items.map(item => {
        const locationId = item.standort_custom_gen_standort;
        const locationName = locationCache[locationId] || (locationId ? 'ID: ' + locationId.substring(0, 8) + '...' : 'N/A');

        return `
            <tr class="hover:bg-slate-50 transition-colors group border-b border-slate-100">
                <td class="px-4 py-3">
                    <div class="text-sm font-semibold text-slate-800">${item.typ_text || 'Unbekannter Typ'}</div>
                    <div class="text-xs text-slate-500">${item.modell_text || '-'}</div>
                </td>
                <td class="px-4 py-3 text-slate-600">${item.hersteller_text || '—'}</td>
                <td class="px-4 py-3 font-mono text-xs text-indigo-600">${item.seriennummer_text || 'N/A'}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusClass(item.status_text)}">
                        ${item.status_text || 'Neu'}
                    </span>
                </td>
                <td class="px-4 py-3 text-slate-600">
                    <div class="flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        <span>${locationName}</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-2">
                        <button onclick="editAsset('${item._id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        <button onclick="deleteAssetPrompt('${item._id}')" class="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    DOM.tableBody.innerHTML = rows;
}

// --- ACTIONS ---

window.editAsset = function(id) {
    const asset = allAssets.find(a => a._id === id);
    if (!asset) return;

    document.getElementById(PREFIX + 'sidebar_title').innerText = 'Asset bearbeiten';
    document.getElementById(PREFIX + 'f_id').value = asset._id;
    document.getElementById(PREFIX + 'f_typ').value = asset.typ_text || '';
    document.getElementById(PREFIX + 'f_hersteller').value = asset.hersteller_text || '';
    document.getElementById(PREFIX + 'f_modell').value = asset.modell_text || '';
    document.getElementById(PREFIX + 'f_seriennummer').value = asset.seriennummer_text || '';
    document.getElementById(PREFIX + 'f_status').value = asset.status_text || 'Aktiv';
    document.getElementById(PREFIX + 'f_standort').value = asset.standort_custom_gen_standort || '';

    showSidebar(true);
};

async function saveAsset() {
    const id = document.getElementById(PREFIX + 'f_id').value;
    const data = {
        typ_text: document.getElementById(PREFIX + 'f_typ').value,
        hersteller_text: document.getElementById(PREFIX + 'f_hersteller').value,
        modell_text: document.getElementById(PREFIX + 'f_modell').value,
        seriennummer_text: document.getElementById(PREFIX + 'f_seriennummer').value,
        status_text: document.getElementById(PREFIX + 'f_status').value,
        standort_custom_gen_standort: document.getElementById(PREFIX + 'f_standort').value
    };

    if (!data.typ_text) {
        Swal.fire('Pflichtfeld', 'Bitte geben Sie einen Typ an.', 'warning');
        return;
    }

    try {
        Swal.fire({ title: 'Speichere...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        let res = id ? await updateBubbleObject('gen_asset', id, data) : await createBubbleObject('gen_asset', data);

        if (res.success) {
            showSidebar(false);
            Swal.fire('Erfolg', 'Das Asset wurde aktualisiert.', 'success');
            loadData();
        } else {
            Swal.fire('Fehler', res.error.message, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

window.deleteAssetPrompt = function(id) {
    Swal.fire({
        title: 'Löschen?',
        text: 'Dieses Asset wird unwiderruflich entfernt.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Löschen',
        cancelButtonText: 'Abbrechen'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const res = await deleteBubbleObject('gen_asset', id);
            if (res.success) {
                Swal.fire('Gelöscht', 'Asset wurde entfernt.', 'success');
                loadData();
            }
        }
    });
};

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById(PREFIX + 'btn_new').addEventListener('click', () => {
        document.getElementById(PREFIX + 'sidebar_title').innerText = 'Neues Asset anlegen';
        showSidebar(true);
    });

    document.getElementById(PREFIX + 'sidebar_close').addEventListener('click', () => showSidebar(false));
    document.getElementById(PREFIX + 'btn_cancel').addEventListener('click', () => showSidebar(false));
    document.getElementById(PREFIX + 'btn_save').addEventListener('click', saveAsset);
    document.getElementById(PREFIX + 'btn_refresh').addEventListener('click', loadData);

    DOM.search.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = allAssets.filter(a => 
            (a.typ_text || '').toLowerCase().includes(val) || 
            (a.hersteller_text || '').toLowerCase().includes(val) ||
            (a.seriennummer_text || '').toLowerCase().includes(val)
        );
        renderAssets(filtered);
    });
});
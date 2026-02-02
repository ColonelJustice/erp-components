const PREFIX = 'mp_';

let state = {
    tours: [],
    selectedTourId: null,
    stops: [],
    selectedStopId: null,
    assets: [],
    draggedIndex: null,
    searchTerm: '' // Filter state
};

async function init() {
    await loadTechnician();
    await loadTours();
    setupEventListeners();
}

function setupEventListeners() {
    const searchInput = document.getElementById(PREFIX + 'tour_search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchTerm = e.target.value.toLowerCase();
            renderTourList();
        });
    }
}

async function loadTechnician() {
    const res = await listBubbleObjects('gen_mitarbeiter', { limit: 1 });
    if (res.success && res.data.length > 0) {
        const m = res.data[0];
        document.getElementById(PREFIX + 'staff_name').innerText = `${m.vorname_text || ''} ${m.nachname_text || ''}`.trim();
        document.getElementById(PREFIX + 'staff_initials').innerText = `${m.vorname_text?.[0] || ''}${m.nachname_text?.[0] || ''}`.toUpperCase();
    }
}

async function loadTours() {
    try {
        const res = await listBubbleObjects('tour', {
            limit: 50,
            sortField: 'scheduled_date_date',
            descending: true
        });
        if (res.success) {
            state.tours = res.data;
            renderTourList();
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadStops(tourId) {
    const container = document.getElementById(PREFIX + 'stops_container');
    container.innerHTML = `<div class="space-y-4">` + Array(4).fill('<div class="h-20 bg-white border border-slate-100 rounded-xl animate-pulse"></div>').join('') + `</div>`;

    try {
        const res = await listBubbleObjects('stop', {
            constraints: [
                {
                    key: 'tour_custom_lgs_tour',
                    constraint_type: 'equals',
                    value: tourId
                }
            ],
            sortField: 'sequence_number',
            descending: false
        });

        if (res.success) {
            state.stops = res.data.sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));
            renderStopsList();
            updateHeaderStats();
        } else {
            container.innerHTML = `<p class="text-xs text-red-500">Fehler beim Abruf der Route.</p>`;
        }
    } catch (e) {
        console.error("API Error:", e);
    }
}

function renderTourList() {
    const container = document.getElementById(PREFIX + 'tour_list_container');
    if (!state.tours.length) {
        container.innerHTML = `<div class="p-6 text-center border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-xs">Keine aktiven Touren</div>`;
        return;
    }

    // Filter logic based on searchTerm
    const filteredTours = state.tours.filter(tour => {
        const name = (tour.name_text || '').toLowerCase();
        const project = (tour.projektid_text || '').toLowerCase();
        return name.includes(state.searchTerm) || project.includes(state.searchTerm);
    });

    if (!filteredTours.length) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs italic">Keine Treffer für "${state.searchTerm}"</div>`;
        return;
    }

    container.innerHTML = filteredTours.map(tour => {
        const isActive = state.selectedTourId === tour._id;
        const dateStr = tour.scheduled_date_date ? dayjs(tour.scheduled_date_date).format('DD. MMM YYYY') : 'Unterminiert';
        return `
            <div class="tour-card p-4 bg-white border ${isActive ? 'border-indigo-600 ring-1 ring-indigo-600 active' : 'border-slate-200'} rounded-xl cursor-pointer hover:border-indigo-300 transition-all"
                 onclick="selectTour('${tour._id}')">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">${tour.projektid_text || 'SERVICE'}</span>
                    <span class="px-2 py-0.5 bg-slate-100 text-[9px] rounded font-semibold text-slate-500 uppercase">${tour.status_text || 'Geplant'}</span>
                </div>
                <h3 class="text-sm font-bold text-slate-800 truncate">${tour.name_text || 'Instandhaltungs-Tour'}</h3>
                <div class="flex items-center gap-3 mt-3">
                     <div class="text-[10px] text-slate-400 font-medium">📅 ${dateStr}</div>
                     <div class="text-[10px] text-indigo-400 font-bold">⏱️ ${tour.totaltime_number || 0}h</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderStopsList() {
    const container = document.getElementById(PREFIX + 'stops_container');
    if (!state.stops.length) {
        container.innerHTML = `<div class="text-center py-20 text-slate-400"><p class="text-xs italic">Keine Stops für diese Tour hinterlegt.</p></div>`;
        return;
    }
    
    const header = `<div class="flex items-center justify-between mb-4">
        <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Route: ${state.stops.length} Einsatzorte</h4>
        <span class="text-[9px] text-slate-300 uppercase font-bold italic">Drag & Drop sortierbar</span>
    </div>`;

    const list = state.stops.map((stop, index) => {
        const isSelected = state.selectedStopId === stop._id;
        const isDone = stop.completed_boolean;
        return `
            <div class="stop-item p-4 mb-3 bg-white border ${isSelected ? 'active border-indigo-600 ring-1 ring-indigo-600' : 'border-slate-200'} ${isDone ? 'completed opacity-70' : ''} rounded-xl cursor-grab active:cursor-grabbing hover:shadow-sm transition-all"
                 draggable="true"
                 data-id="${stop._id}"
                 data-index="${index}"
                 ondragstart="handleDragStart(event)"
                 ondragover="handleDragOver(event)"
                 ondragend="handleDragEnd(event)"
                 ondrop="handleDrop(event)"
                 onclick="selectStop('${stop._id}')">
                <div class="flex items-center gap-4">
                    <div class="w-7 h-7 shrink-0 rounded-full ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'} flex items-center justify-center text-[11px] font-bold">
                        ${isDone ? '✓' : index + 1}
                    </div>
                    <div class="flex-1 min-w-0 pointer-events-none">
                        <p class="text-sm font-bold text-slate-800 truncate">${stop.customer_name_text || 'Unbekannt'}</p>
                        <p class="text-[10px] text-slate-400 truncate font-medium">${stop.address_text || 'Keine Adresse'}</p>
                    </div>
                    <div class="text-slate-300">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-12a2 2 0 10.001 4.001A2 2 0 0013 2zm0 6a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z"/></svg>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = header + list;
}

window.handleDragStart = function(e) {
    state.draggedIndex = parseInt(e.currentTarget.getAttribute('data-index'));
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', state.draggedIndex);
};

window.handleDragOver = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};

window.handleDragEnd = function(e) {
    e.currentTarget.classList.remove('dragging');
};

window.handleDrop = async function(e) {
    e.preventDefault();
    const targetIndex = parseInt(e.currentTarget.getAttribute('data-index'));
    const sourceIndex = state.draggedIndex;

    if (sourceIndex === targetIndex) return;

    const newStops = [...state.stops];
    const [movedItem] = newStops.splice(sourceIndex, 1);
    newStops.splice(targetIndex, 0, movedItem);
    
    state.stops = newStops;
    renderStopsList();
    
    saveNewSequence();
};

async function saveNewSequence() {
    const updates = state.stops.map((stop, index) => {
        if (stop.sequence_number !== index + 1) {
            return updateBubbleObject('stop', stop._id, { sequence_number: index + 1 });
        }
        return Promise.resolve({ success: true });
    });

    try {
        await Promise.all(updates);
        console.log("Route sequence updated successfully");
    } catch (err) {
        console.error("Error updating sequence:", err);
    }
}

window.selectTour = function(id) {
    state.selectedTourId = id;
    state.selectedStopId = null;
    const tour = state.tours.find(t => t._id === id);
    document.getElementById(PREFIX + 'stop_context').innerHTML = `
        <h2 class="text-lg font-bold text-slate-800">${tour.name_text}</h2>
        <p class="text-sm text-slate-500">Ref: <span class="font-mono">${tour.projektid_text || '—'}</span> | ${tour.type_text || 'Standard-Tour'}</p>
    `;
    renderTourList();
    loadStops(id);
};

window.selectStop = async function(stopId) {
    state.selectedStopId = stopId;
    renderStopsList();
    const stop = state.stops.find(s => s._id === stopId);
    const workArea = document.getElementById(PREFIX + 'work_area');
    workArea.innerHTML = `
        <div class="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                <div>
                    <h3 class="text-2xl font-bold text-slate-800">${stop.customer_name_text}</h3>
                    <p class="text-slate-500 text-sm">${stop.address_text || ''}</p>
                </div>
                <button class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg transition-all" 
                        onclick="completeStop('${stopId}')">
                    Einsatz abschließen
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="mp_asset_grid">
                 <div class="col-span-full py-20 text-center">
                    <div class="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p class="text-xs text-slate-400 font-medium uppercase tracking-tighter">Suche technische Anlagen am Standort...</p>
                 </div>
            </div>
        </div>
    `;
    if (stop.standort_custom_gen_standort) {
        await loadAssetsForStop(stop.standort_custom_gen_standort);
    } else {
        document.getElementById('mp_asset_grid').innerHTML = `<div class="col-span-full p-12 bg-slate-100 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm italic">Diesem Stop ist kein Standort-Objekt zugewiesen.</div>`;
    }
};

async function loadAssetsForStop(standortId) {
    const res = await listBubbleObjects('gen_asset', {
        constraints: [{ key: 'standort_custom_gen_standort', constraint_type: 'equals', value: standortId }]
    });
    const grid = document.getElementById('mp_asset_grid');
    if (res.success && res.data.length > 0) {
        grid.innerHTML = res.data.map(asset => `
            <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h4 class="font-bold text-slate-800">${asset.bezeichnung_text || asset.modell_text}</h4>
                        <p class="text-[10px] text-slate-400 font-mono mt-1">SN: ${asset.seriennummer_text || 'UNBEKANNT'}</p>
                    </div>
                    <span class="px-2 py-1 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-lg">${asset.typ_text || 'ANLAGE'}</span>
                </div>
                <div class="bg-slate-50 rounded-xl p-4 mb-4" id="telemetry_${asset._id}">
                    <p class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-3">Live Telemetrie</p>
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 bg-slate-200 rounded-full"></div>
                        <div class="h-3 w-2/3 bg-slate-200 rounded-full animate-pulse"></div>
                    </div>
                </div>
                <button class="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                    Protokoll erfassen
                </button>
            </div>
        `).join('');
        res.data.forEach(a => mockTelemetry(a._id));
    } else {
        grid.innerHTML = `<div class="col-span-full p-12 bg-amber-50 rounded-2xl border border-amber-100 text-center text-amber-700 text-sm">Keine registrierten Assets an diesem Standort gefunden.</div>`;
    }
}

function mockTelemetry(assetId) {
    const el = document.getElementById(`telemetry_${assetId}`);
    if (!el) return;
    const randomVal = (Math.random() * 40 + 60).toFixed(1);
    const isOk = parseFloat(randomVal) < 95;
    el.innerHTML = `
        <div class="flex items-center justify-between">
            <p class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Live Telemetrie</p>
            <div class="flex items-center gap-1.5">
                <span class="status-pulse h-1.5 w-1.5 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-red-500'}"></span>
                <span class="text-[10px] ${isOk ? 'text-emerald-600' : 'text-red-600'} font-bold">ONLINE</span>
            </div>
        </div>
        <div class="mt-3 flex items-end gap-2">
            <span class="text-2xl font-bold text-slate-800 iot-value">${randomVal}</span>
            <span class="text-[10px] text-slate-400 font-bold mb-1">Hz / 400V</span>
        </div>
        <div class="w-full h-1 bg-slate-200 rounded-full mt-3 overflow-hidden">
            <div class="h-full ${isOk ? 'bg-emerald-500' : 'bg-red-500'}" style="width: ${randomVal}%"></div>
        </div>
    `;
}

window.completeStop = async function(id) {
    if (!confirm("Instandhaltungs-Einsatz als abgeschlossen markieren?")) return;
    const res = await updateBubbleObject('stop', id, { completed_boolean: true });
    if (res.success) {
        await loadStops(state.selectedTourId);
        document.getElementById(PREFIX + 'work_area').innerHTML = `
            <div class="h-full flex flex-col items-center justify-center animate-in zoom-in duration-300">
                <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mb-4">✓</div>
                <h3 class="text-slate-800 font-bold">Einsatz abgeschlossen</h3>
                <p class="text-sm text-slate-500 mt-1">Wählen Sie den nächsten Stop in der Route.</p>
            </div>
        `;
    }
}

function updateHeaderStats() {
    const done = state.stops.filter(s => s.completed_boolean).length;
    const total = state.stops.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const statsEl = document.getElementById(PREFIX + 'tour_stats');
    if(statsEl) {
        statsEl.innerHTML = `
            <div class="text-right">
                <p class="text-slate-400 text-[10px] uppercase font-bold tracking-tighter">Gesamtfortschritt</p>
                <p class="font-black text-indigo-600 text-lg">${done} / ${total} <span class="text-slate-300 text-sm">(${percent}%)</span></p>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', init);
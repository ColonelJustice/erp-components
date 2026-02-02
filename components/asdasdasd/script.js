/**
 * IOT Asset Management Dashboard
 * @module IOTDashboard
 * @description Verwaltet Standorte, Sensoren, Messkanäle und Analysen
 */

const PREFIX = 'iot_';

/**
 * Globaler Datenspeicher für Dashboard-Daten
 * @type {Object}
 */
let currentData = {
    locations: [],
    assets: [],
    channels: [],
    parameters: [],
    companies: [],
    observations: []
};

/**
 * Chart.js Instanz für Messwert-Visualisierung
 * @type {Chart|null}
 */
let mainChart = null;

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Zeigt/versteckt den globalen Lade-Indikator
 * @param {boolean} show - True zum Anzeigen, False zum Verstecken
 */
function showLoader(show) {
    const el = document.getElementById(PREFIX + 'loader');
    if (el) el.classList.toggle('hidden', !show);
}

/**
 * Zeigt/versteckt das Chart-Lade-Overlay
 * @param {boolean} show - True zum Anzeigen, False zum Verstecken
 */
function showChartLoading(show) {
    const el = document.getElementById(PREFIX + 'chart_overlay');
    if (el) el.classList.toggle('hidden', !show);
}

/**
 * Aktualisiert die Statistik-Karten im Header
 */
function updateStats() {
    const stats = [
        { id: 'stat_locations', data: currentData.locations },
        { id: 'stat_assets', data: currentData.assets },
        { id: 'stat_channels', data: currentData.channels }
    ];
    
    stats.forEach(({ id, data }) => {
        const el = document.getElementById(PREFIX + id);
        if (el) el.innerText = data.length;
    });
}

/**
 * Zeigt eine Benutzer-Benachrichtigung
 * @param {string} message - Die anzuzeigende Nachricht
 * @param {string} type - Typ: 'success', 'error', 'warning', 'info'
 */
function showNotification(message, type = 'info') {
    // Einfache Implementierung - kann später durch Toast-System ersetzt werden
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-amber-500',
        info: 'bg-indigo-600'
    };
    
    const notification = document.createElement('div');
    notification.className = `fixed top-6 right-6 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ═══════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════

/**
 * Lädt alle Dashboard-Daten von der Bubble API
 * @async
 * @returns {Promise<void>}
 */
async function loadDashboardData() {
    showLoader(true);
    
    const fetchTasks = [
        { key: 'locations', obj: 'gen_standort', label: 'Standorte' },
        { key: 'assets', obj: 'gen_asset', label: 'Assets' },
        { key: 'channels', obj: 'data_sensorchannel', label: 'Kanäle' },
        { key: 'parameters', obj: 'data_measurementparameter', label: 'Parameter' },
        { key: 'companies', obj: 'gen_unternehmen', label: 'Unternehmen' }
    ];

    try {
        let successCount = 0;
        let errorCount = 0;

        for (const task of fetchTasks) {
            try {
                const res = await listBubbleObjects(task.obj, { limit: 100 });
                if (res.success) {
                    currentData[task.key] = res.data || [];
                    successCount++;
                } else {
                    console.warn(`[IOT] Konnte ${task.label} nicht laden:`, res.error);
                    currentData[task.key] = [];
                    errorCount++;
                }
            } catch (err) {
                console.error(`[IOT] Fehler beim Laden von ${task.label}:`, err);
                currentData[task.key] = [];
                errorCount++;
            }
        }

        renderAll();
        updateStats();
        
        if (errorCount > 0) {
            showNotification(`${successCount} von ${fetchTasks.length} Datenquellen geladen. ${errorCount} Fehler.`, 'warning');
        } else {
            showNotification('Alle Daten erfolgreich geladen', 'success');
        }
    } catch (e) {
        console.error('[IOT] Kritischer Fehler beim Laden:', e);
        showNotification('Fehler beim Laden der Dashboard-Daten', 'error');
    } finally {
        showLoader(false);
    }
}

// ═══════════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════════

/**
 * Rendert alle Tabellen und UI-Elemente neu
 */
function renderAll() {
    renderLocations();
    renderAssets();
    renderChannels();
    populateChartSelectors();
}

/**
 * Generische Funktion zum Rendern von Tabellendaten
 * @param {string} bodyId - ID des tbody-Elements
 * @param {Array} data - Zu rendernde Daten
 * @param {Function} rowRenderer - Funktion die HTML für eine Zeile erstellt
 * @param {number} colspan - Anzahl der Spalten für leere Nachricht
 * @param {string} emptyMessage - Nachricht wenn keine Daten vorhanden
 */
function renderTable(bodyId, data, rowRenderer, colspan, emptyMessage) {
    const body = document.getElementById(bodyId);
    if (!body) return;

    if (!data || data.length === 0) {
        body.innerHTML = `<tr><td colspan="${colspan}" class="p-8 text-center text-slate-400">${emptyMessage}</td></tr>`;
        return;
    }

    body.innerHTML = data.map(rowRenderer).join('');
}

/**
 * Rendert die Standort-Tabelle
 */
function renderLocations() {
    renderTable(
        PREFIX + 'location_body',
        currentData.locations,
        (loc) => {
            const companyId = loc.unternehmen_custom_gen_unternehmen;
            const company = currentData.companies.find(c => c._id === companyId);
            const companyName = company?.name_text || companyId || 'N/A';
            const locationName = loc.bezeichnung_text || 'Unbenannt';
            const shortId = loc._id.slice(-6);
            
            return `
                <tr>
                    <td class="p-3 font-medium text-slate-700">${locationName}</td>
                    <td class="p-3 text-slate-500">${companyName}</td>
                    <td class="p-3 text-right text-[10px] font-mono text-slate-300">${shortId}</td>
                </tr>
            `;
        },
        3,
        'Keine Standorte gefunden.'
    );
}

/**
 * Rendert die Asset/Sensor-Tabelle
 */
function renderAssets() {
    renderTable(
        PREFIX + 'asset_body',
        currentData.assets,
        (asset) => {
            const loc = currentData.locations.find(l => l._id === asset.standort_custom_gen_standort);
            const statusClass = asset.status_text === 'Aktiv' ? 'status-active' : 'status-inactive';
            const modelName = asset.modell_text || 'Asset';
            const manufacturer = asset.hersteller_text || '';
            const locationName = loc?.bezeichnung_text || '—';
            const status = asset.status_text || 'Offline';
            
            return `
                <tr>
                    <td class="p-3 font-medium text-slate-700">${modelName} <span class="text-[10px] text-slate-400">(${manufacturer})</span></td>
                    <td class="p-3 text-slate-500">${locationName}</td>
                    <td class="p-3"><span class="status-badge ${statusClass}">${status}</span></td>
                    <td class="p-3 text-right">
                        <button onclick="iotDelete('gen_asset', '${asset._id}')" 
                                class="text-red-400 hover:text-red-600" 
                                aria-label="Asset löschen">🗑</button>
                    </td>
                </tr>
            `;
        },
        4,
        'Keine Sensoren gefunden.'
    );
}

/**
 * Rendert die Kanal-Tabelle
 */
function renderChannels() {
    renderTable(
        PREFIX + 'channel_body',
        currentData.channels,
        (ch) => {
            const prm = currentData.parameters.find(p => p._id === ch.parameter_custom_data_measurementparameter);
            const asset = currentData.assets.find(a => a._id === ch.asset_custom_gen_asset);
            const assetName = asset?.modell_text || 'Unbekannt';
            const channelId = ch.kanalid_text || 'CH';
            const paramName = prm?.name_text || '—';
            const unit = prm?.einheit_text || '';
            
            return `
                <tr>
                    <td class="p-3 font-medium text-slate-700">${assetName}</td>
                    <td class="p-3 font-mono text-xs text-slate-400">${channelId}</td>
                    <td class="p-3">${paramName} <span class="text-[10px] text-slate-400">(${unit})</span></td>
                    <td class="p-3 text-right">
                        <button onclick="iotDelete('data_sensorchannel', '${ch._id}')" 
                                class="text-red-400 hover:text-red-600"
                                aria-label="Kanal löschen">🗑</button>
                    </td>
                </tr>
            `;
        },
        4,
        'Keine Kanäle gefunden.'
    );
}

// ═══════════════════════════════════════════════════════════════════
// CHARTS & ANALYTICS
// ═══════════════════════════════════════════════════════════════════

/**
 * Befüllt den Kanal-Selector für die Chart-Analyse
 */
function populateChartSelectors() {
    const sel = document.getElementById(PREFIX + 'chart_selector');
    if (!sel) return;
    
    if (currentData.channels.length === 0) {
        sel.innerHTML = '<option value="">Keine Kanäle</option>';
        return;
    }

    const options = currentData.channels.map(ch => {
        const prm = currentData.parameters.find(p => p._id === ch.parameter_custom_data_measurementparameter);
        const asset = currentData.assets.find(a => a._id === ch.asset_custom_gen_asset);
        const label = `${asset?.modell_text || 'Asset'} | ${ch.kanalid_text} (${prm?.name_text || '?'})`;
        return `<option value="${ch._id}">${label}</option>`;
    }).join('');

    sel.innerHTML = '<option value="">Bitte Kanal wählen...</option>' + options;
}

/**
 * Lädt Analysedaten für den gewählten Kanal und aktualisiert Charts
 * @async
 * @returns {Promise<void>}
 */
async function fetchAnalysisData() {
    const selector = document.getElementById(PREFIX + 'chart_selector');
    const limitEl = document.getElementById(PREFIX + 'chart_limit');
    
    if (!selector || !selector.value) {
        console.warn('[IOT] Kein Kanal ausgewählt');
        return;
    }
    
    const channelId = selector.value;
    const limit = limitEl ? parseInt(limitEl.value) : 50;

    showChartLoading(true);
    
    try {
        const result = await listBubbleObjects('data_measurementobservation', {
            constraints: [{ 
                key: 'sensorchannel_custom_data_sensorchannel', 
                constraint_type: 'equals', 
                value: channelId 
            }],
            sortField: 'zeitstempel_date',
            descending: true,
            limit: limit
        });

        if (result.success && result.data) {
            const obs = result.data.reverse(); // Chronologische Reihenfolge
            renderChart(obs);
            renderSummary(obs);
            renderRecentTable(obs);
            
            const badge = document.getElementById(PREFIX + 'chart_badge');
            if (badge) badge.classList.remove('hidden');
        } else {
            console.error('[IOT] Chart Fetch Error:', result.error);
            showNotification('Fehler beim Laden der Analysedaten', 'error');
        }
    } catch (e) {
        console.error('[IOT] Chart Exception:', e);
        showNotification('Kritischer Fehler beim Laden der Analysedaten', 'error');
    } finally {
        showChartLoading(false);
    }
}

function renderSummary(items) {
    const container = document.getElementById(PREFIX + 'summary_container');
    if (!container) return;
    
    if (!items.length) {
        container.innerHTML = '';
        return;
    }
    
    const values = items.map(i => i.value_number_number || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a,b) => a+b, 0) / values.length;
    
    container.innerHTML = `
        <div class="stat-card">
            <span class="text-[10px] font-bold text-slate-400 uppercase">Maximum</span>
            <span class="text-lg font-bold text-slate-800">${max.toFixed(2)}</span>
        </div>
        <div class="stat-card">
            <span class="text-[10px] font-bold text-slate-400 uppercase">Minimum</span>
            <span class="text-lg font-bold text-slate-800">${min.toFixed(2)}</span>
        </div>
        <div class="stat-card">
            <span class="text-[10px] font-bold text-slate-400 uppercase">Ø Schnitt</span>
            <span class="text-lg font-bold text-indigo-600">${avg.toFixed(2)}</span>
        </div>
    `;
}

function renderRecentTable(items) {
    const body = document.getElementById(PREFIX + 'recent_list');
    if (!body) return;

    if (!items || items.length === 0) {
        body.innerHTML = '<tr><td class="text-center py-4 text-slate-400">Keine Werte</td></tr>';
        return;
    }

    body.innerHTML = [...items].reverse().slice(0, 15).map(i => `
        <tr>
            <td class="py-2 text-slate-500 font-mono text-[10px]">${dayjs(i.zeitstempel_date).format('HH:mm:ss')}</td>
            <td class="py-2 font-bold text-right text-slate-700">${(i.value_number_number || 0).toFixed(2)}</td>
            <td class="py-2 text-right"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span></td>
        </tr>
    `).join('');
}

function renderChart(items) {
    const canvas = document.getElementById(PREFIX + 'main_chart');
    if (!canvas || typeof Chart === 'undefined') return;
    
    const ctx = canvas.getContext('2d');
    if (mainChart) mainChart.destroy();

    const labels = items.map(i => dayjs(i.zeitstempel_date).format('HH:mm'));
    const data = items.map(i => i.value_number_number);

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Messwert',
                data: data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.05)',
                fill: true,
                tension: 0.3,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Debounce-Hilfsfunktion für Performance-Optimierung
 * @param {Function} func - Auszuführende Funktion
 * @param {number} wait - Wartezeit in ms
 * @returns {Function} Debounced Funktion
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Initialisiert alle Event-Listener
 */
function initEvents() {
    // Chart-Selector mit Debouncing für bessere Performance
    const sel = document.getElementById(PREFIX + 'chart_selector');
    if (sel) sel.onchange = debounce(fetchAnalysisData, 300);
    
    const lim = document.getElementById(PREFIX + 'chart_limit');
    if (lim) lim.onchange = debounce(fetchAnalysisData, 300);

    // Refresh-Button
    const refresh = document.getElementById(PREFIX + 'refresh_btn');
    if (refresh) {
        refresh.onclick = async () => {
            refresh.disabled = true;
            await loadDashboardData();
            refresh.disabled = false;
        };
    }

    // Tab-Navigation
    document.querySelectorAll('.iot_tab_link').forEach(link => {
        link.onclick = () => switchTab(link.dataset.tab);
    });
}

/**
 * Wechselt zwischen Tabs
 * @param {string} tabName - Name des anzuzeigenden Tabs
 */
function switchTab(tabName) {
    // Alle Tabs deaktivieren
    document.querySelectorAll('.iot_tab_link').forEach(l => {
        l.classList.remove('active', 'border-indigo-600', 'text-indigo-600');
        l.setAttribute('aria-selected', 'false');
    });
    
    // Alle Tab-Inhalte verstecken
    document.querySelectorAll('.iot_tab_content').forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('block');
    });
    
    // Aktiven Tab aktivieren
    const activeLink = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeLink) {
        activeLink.classList.add('active', 'border-indigo-600', 'text-indigo-600');
        activeLink.setAttribute('aria-selected', 'true');
    }
    
    const content = document.getElementById(PREFIX + 'tab_' + tabName);
    if (content) {
        content.classList.remove('hidden');
        content.classList.add('block');
    }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API (für HTML onclick-Attribute)
// ═══════════════════════════════════════════════════════════════════

/**
 * Öffnet ein Modal zum Erstellen neuer Einträge
 * @param {string} type - Typ des zu erstellenden Objekts ('location', 'asset', 'channel')
 */
window.iotOpenModal = function(type) {
    // TODO: Implementiere echtes Modal-System
    showNotification(`Erstellen von ${type} wird implementiert...`, 'info');
    console.log('[IOT] Modal öffnen für:', type);
};

/**
 * Löscht ein Objekt nach Bestätigung
 * @async
 * @param {string} objectType - Bubble-Objekttyp
 * @param {string} id - ID des zu löschenden Objekts
 */
window.iotDelete = async function(objectType, id) {
    if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) {
        return;
    }
    
    try {
        // TODO: Implementiere echte Löschfunktion via deleteBubbleObject
        showNotification('Löschfunktion wird implementiert...', 'info');
        console.log('[IOT] Löschen:', objectType, id);
        
        // Bei echter Implementierung:
        // const result = await deleteBubbleObject(objectType, id);
        // if (result.success) {
        //     showNotification('Erfolgreich gelöscht', 'success');
        //     await loadDashboardData();
        // }
    } catch (error) {
        console.error('[IOT] Fehler beim Löschen:', error);
        showNotification('Fehler beim Löschen', 'error');
    }
};

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Hauptinitialisierung beim Laden der Seite
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('[IOT] Dashboard wird initialisiert...');
    initEvents();
    loadDashboardData();
});
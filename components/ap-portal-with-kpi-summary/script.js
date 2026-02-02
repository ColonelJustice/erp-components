// API Prefix and Identifiers
const PREFIX = 'ap_';
const BUBBLE_TYPE_BELEG = 'erp_ek_beleg';
const BUBBLE_TYPE_ZEILE = 'erp_ek_zeile';
const BUBBLE_TYPE_DOKUMENT = 'dms_dokument';
const BUBBLE_TYPE_SACHKONTO = 'erp_fin_sachkonto';

// State Management
let allBelege = [];
let allSachkonten = [];
let allRechnungspositionen = []; // Alle Positionen
let selectedBeleg = null;
let filteredPositionen = []; // Gefilterte Positionen für aktuellen Beleg

/** 
 * Utility Formatters for JS Context
 */
const localFormatCurrency = (val) => {
    if (val === undefined || val === null) return '0,00 €';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
};

const localFormatDate = (val) => {
    if (!val) return '--';
    if (typeof dayjs !== 'undefined') return dayjs(val).format('DD.MM.YYYY');
    return new Date(val).toLocaleDateString('de-DE');
};

/**
 * Filter Rechnungspositionen basierend auf ausgewähltem Beleg
 * @param {string} belegId - Die ID des ausgewählten Eingangsbelegs
 * @returns {Array} Gefilterte Rechnungspositionen
 */
function filterPositionenByBeleg(belegId) {
    if (!belegId) {
        console.warn('Keine Beleg-ID zum Filtern angegeben');
        return [];
    }
    
    // Filter auf Positionen die zum gewählten Beleg gehören
    const filtered = allRechnungspositionen.filter(position => {
        return position.beleg_custom_erp_ek_beleg === belegId;
    });
    
    console.log(`Positionen gefiltert: ${filtered.length} von ${allRechnungspositionen.length} für Beleg ${belegId}`);
    return filtered;
}

/**
 * Setze die Filterung zurück und zeige den leeren Zustand
 */
function resetPositionenFilter() {
    selectedBeleg = null;
    filteredPositionen = [];
    
    const emptyState = document.getElementById(PREFIX + 'empty_state');
    const detailView = document.getElementById(PREFIX + 'detail_view');
    
    if (emptyState) emptyState.classList.remove('hidden');
    if (detailView) detailView.classList.add('hidden');
    
    // Refresh Liste um aktive Markierung zu entfernen
    renderInvoiceList(allBelege);
    
    console.log('Filterung zurückgesetzt');
}

async function initPortal() {
    const listContainer = document.getElementById(PREFIX + 'invoice_list');
    
    try {
        // Load Belege, Sachkonten and Rechnungspositionen in parallel
        const [belegRes, kontoRes, positionenRes] = await Promise.all([
            listBubbleObjects(BUBBLE_TYPE_BELEG, { limit: 50, sortField: 'Created Date', descending: true }),
            listBubbleObjects(BUBBLE_TYPE_SACHKONTO, { limit: 100 }),
            listBubbleObjects(BUBBLE_TYPE_ZEILE, { limit: 500 }) // Alle Positionen laden
        ]);

        if (belegRes.success) {
            allBelege = belegRes.data || [];
            renderInvoiceList(allBelege);
            renderKPIs(allBelege); // Updated: Render KPIs after loading data
        }

        if (kontoRes.success) {
            allSachkonten = kontoRes.data || [];
            populateSachkonten(allSachkonten);
        }

        if (positionenRes.success) {
            allRechnungspositionen = positionenRes.data || [];
            console.log(`${allRechnungspositionen.length} Rechnungspositionen geladen`);
        }

        setupEventListeners();
    } catch (err) {
        console.error("Init Error Detail:", err.message || err);
        if (listContainer) {
            listContainer.innerHTML = `<div class="p-4 text-red-500 text-sm text-center">Fehler beim Initialisieren des Portals</div>`;
        }
    }
}

/**
 * New: Render KPI Summary metrics at the top of the main area
 */
function renderKPIs(items) {
    if (!items) return;
    
    // Calculate sums
    const totalBrutto = items.reduce((acc, b) => acc + (b.betrag_brutto_number || 0), 0);
    const invoiceCount = items.length;
    
    // Example: Only sum those that are not 'Bezahlt'
    const pendingSum = items
        .filter(b => b.status_option_erp_eingangsrechnung_status !== 'Bezahlt')
        .reduce((acc, b) => acc + (b.betrag_brutto_number || 0), 0);

    // Update DOM
    const totalEl = document.getElementById(PREFIX + 'kpi_total_val');
    const countEl = document.getElementById(PREFIX + 'kpi_count_val');
    const pendingEl = document.getElementById(PREFIX + 'kpi_pending_val');

    if (totalEl) totalEl.innerText = localFormatCurrency(totalBrutto);
    if (countEl) countEl.innerText = invoiceCount.toString();
    if (pendingEl) pendingEl.innerText = localFormatCurrency(pendingSum);
}

function renderInvoiceList(items) {
    const container = document.getElementById(PREFIX + 'invoice_list');
    if (!container) return;
    container.innerHTML = '';

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">Keine Belege gefunden</div>';
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `ap-invoice-item p-4 border-b border-slate-50 transition-all ${selectedBeleg && selectedBeleg._id === item._id ? 'active' : ''}`;
        div.onclick = () => selectInvoice(item._id);

        div.innerHTML = `
            <div class="flex justify-between items-start mb-1">
                <span class="text-sm font-bold text-slate-800">${item.belegnummer_text || 'Entwurf'}</span>
                <span class="text-xs font-semibold text-indigo-600">${localFormatCurrency(item.betrag_brutto_number)}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-xs text-slate-500">${localFormatDate(item.belegdatum_date)}</span>
                <span class="text-[10px] uppercase font-bold text-slate-400">${item.belegart_option_erp_ek_belegart || 'Rechnung'}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

async function selectInvoice(id) {
    const emptyState = document.getElementById(PREFIX + 'empty_state');
    const detailView = document.getElementById(PREFIX + 'detail_view');
    const linesBody = document.getElementById(PREFIX + 'lines_body');

    selectedBeleg = allBelege.find(b => b._id === id);
    if (!selectedBeleg) return;

    // UI Toggling
    if (emptyState) emptyState.classList.add('hidden');
    if (detailView) detailView.classList.remove('hidden');
    renderInvoiceList(allBelege); // Refresh active state in list

    // Header Data
    document.getElementById(PREFIX + 'header_belegnummer').innerText = selectedBeleg.belegnummer_text || 'Ohne Nummer';
    document.getElementById(PREFIX + 'header_meta').innerText = `Belegdatum: ${localFormatDate(selectedBeleg.belegdatum_date)} | Status: ${selectedBeleg.status_option_erp_eingangsrechnung_status || 'Offen'}`;
    document.getElementById(PREFIX + 'total_brutto').innerText = localFormatCurrency(selectedBeleg.betrag_brutto_number);
    document.getElementById(PREFIX + 'total_netto').innerText = localFormatCurrency(selectedBeleg.betrag_netto_number);

    // Reset and Load Details
    if (linesBody) linesBody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400">Lade Positionen...</td></tr>';
    
    // Filter Positionen für den ausgewählten Beleg
    filteredPositionen = filterPositionenByBeleg(id);
    
    // Render gefilterte Positionen
    if (filteredPositionen && filteredPositionen.length > 0) {
        renderLines(filteredPositionen);
    } else {
        // Fallback: Versuche über API zu laden falls lokale Daten leer sind
        console.log('Keine lokalen Positionen gefunden, lade über API...');
        const linesRes = await listBubbleObjects(BUBBLE_TYPE_ZEILE, {
            constraints: [{ key: 'beleg_custom_erp_ek_beleg', constraint_type: 'equals', value: id }]
        });

        if (linesRes.success && linesRes.data && linesRes.data.length > 0) {
            // Füge neu geladene Positionen zu allRechnungspositionen hinzu
            linesRes.data.forEach(pos => {
                if (!allRechnungspositionen.find(p => p._id === pos._id)) {
                    allRechnungspositionen.push(pos);
                }
            });
            // WICHTIG: Doppelte Sicherheitsprüfung - filtere noch einmal clientseitig
            const verified = linesRes.data.filter(pos => pos.beleg_custom_erp_ek_beleg === id);
            
            if (verified.length > 0) {
                filteredPositionen = verified;
                renderLines(verified);
            } else {
                // Auch wenn API Daten lieferte, gehören sie nicht zu diesem Beleg
                console.warn('API lieferte Positionen, aber keine gehören zum gewählten Beleg');
                filteredPositionen = [];
            if (linesBody) linesBody.innerHTML = '<tr><td colspan=\"5\" class=\"p-4 text-center text-slate-400\">Keine Positionen für diesen Beleg gefunden</td></tr>';
            }
        } else {
            if (linesBody) linesBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Keine Positionen für diesen Beleg gefunden</td></tr>';
        }
    }

    // Fetch DMS Doc
    const docCaption = document.getElementById(PREFIX + 'doc_caption');
    if (selectedBeleg.dokument_custom_dms_dokumente) {
        const docRes = await getBubbleObject(BUBBLE_TYPE_DOKUMENT, selectedBeleg.dokument_custom_dms_dokumente);
        if (docRes.success && docCaption) {
            docCaption.innerText = docRes.data.dokumentname_text || 'Dokument anzeigen';
        }
    } else if (docCaption) {
        docCaption.innerText = 'Kein Dokument';
    }
}

function renderLines(lines) {
    const container = document.getElementById(PREFIX + 'lines_body');
    if (!container) return;
    container.innerHTML = '';

    if (!lines || lines.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Keine Positionen gefunden</td></tr>';
        return;
    }

    lines.forEach(line => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="px-4 py-3 text-sm font-medium text-slate-700">${line.artikel_text || 'Textposition'}</td>
            <td class="px-4 py-3 text-sm text-slate-500">${line.bezeichnung_text || '--'}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${line.menge_number || 0} ${line.einheit_option_erp_artikeleinheiten || 'Stk.'}</td>
            <td class="px-4 py-3 text-sm text-slate-700 text-right">${localFormatCurrency(line.preis_netto_number)}</td>
            <td class="px-4 py-3 text-sm font-bold text-slate-800 text-right">${localFormatCurrency((line.menge_number || 0) * (line.preis_netto_number || 0))}</td>
        `;
        container.appendChild(tr);
    });
}

function populateSachkonten(konten) {
    const select = document.getElementById(PREFIX + 'sachkonto_select');
    if (!select) return;
    
    konten.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k._id;
        opt.innerText = `${k.sachkontocode_text || ''} - ${k.bezeichnung_text}`;
        select.appendChild(opt);
    });

    select.onchange = (e) => {
        const account = konten.find(k => k._id === e.target.value);
        const infoBox = document.getElementById(PREFIX + 'account_info');
        if (account && infoBox) {
            infoBox.classList.remove('hidden');
            document.getElementById(PREFIX + 'account_name').innerText = account.bezeichnung_text;
            document.getElementById(PREFIX + 'account_status').innerText = account.direkt_bebuchbar_boolean ? '✓ Direkt bebuchbar' : '⚠ Eingeschränkt';
        } else if (infoBox) {
            infoBox.classList.add('hidden');
        }
    };
}

function setupEventListeners() {
    // Search
    const searchInput = document.getElementById(PREFIX + 'search_invoices');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtered = allBelege.filter(b => (b.belegnummer_text || '').toLowerCase().includes(val));
            renderInvoiceList(filtered);
        });
    }

    // Booking action
    const bookBtn = document.getElementById(PREFIX + 'btn_book');
    if (bookBtn) {
        bookBtn.onclick = async () => {
            if (!selectedBeleg) return;
            if (!confirm("Beleg jetzt final buchen?")) return;
            alert("Workflow 'ekbeleg_buchen' wird für ID " + selectedBeleg._id + " getriggert...");
        };
    }

    // New Beleg
    const newBtn = document.getElementById(PREFIX + 'btn_new_beleg');
    if (newBtn) {
        newBtn.onclick = () => alert("Funktion 'Neuer Beleg' öffnet in Kürze den Schnellerfassungs-Dialog.");
    }

    // ESC-Taste: Filterung zurücksetzen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && selectedBeleg) {
            resetPositionenFilter();
        }
    });
}

document.addEventListener('DOMContentLoaded', initPortal);
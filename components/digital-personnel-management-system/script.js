/**
 * Digital Personnel Management System
 * Using ERP Standard Library (ERPApi, ERPTable, ERPForm, ERPUtils)
 */

const PDM_ID_PREFIX = 'pdm_';

class PersonnelManagementSystem {
    constructor() {
        this.api = erpApi;
        this.store = erpStore;
        this.selectedEmployeeId = null;
        this.employees = [];
        this.currentDocuments = [];
        
        this.init();
    }

    async init() {
        this.cacheElements();
        this.attachEventListeners();
        await this.loadEmployees();
    }

    cacheElements() {
        this.elements = {
            root: document.getElementById(PDM_ID_PREFIX + 'root'),
            employeeList: document.getElementById(PDM_ID_PREFIX + 'employee_list'),
            employeeSearch: document.getElementById(PDM_ID_PREFIX + 'employee_search'),
            detailView: document.getElementById(PDM_ID_PREFIX + 'detail_view'),
            emptyState: document.getElementById(PDM_ID_PREFIX + 'empty_state'),
            modal: document.getElementById(PDM_ID_PREFIX + 'modal_form'),
            formContainer: document.getElementById(PDM_ID_PREFIX + 'form_container'),
            modalTitle: document.getElementById(PDM_ID_PREFIX + 'modal_title'),
            docTableContainer: document.getElementById(PDM_ID_PREFIX + 'documents_table_container'),
            
            // Upload Modal
            uploadModal: document.getElementById(PDM_ID_PREFIX + 'modal_upload'),
            dropZone: document.getElementById(PDM_ID_PREFIX + 'upload_drop_zone'),
            fileInput: document.getElementById(PDM_ID_PREFIX + 'file_input'),
            btnStartUpload: document.getElementById(PDM_ID_PREFIX + 'btn_start_upload'),
            uploadStatus: document.getElementById(PDM_ID_PREFIX + 'upload_status'),
            uploadFilename: document.getElementById(PDM_ID_PREFIX + 'upload_filename'),
            uploadPercent: document.getElementById(PDM_ID_PREFIX + 'upload_percent'),
            uploadProgressBar: document.getElementById(PDM_ID_PREFIX + 'upload_progress_bar'),
            btnAddDoc: document.getElementById(PDM_ID_PREFIX + 'btn_add_doc'),
            
            // Detail fields
            detailName: document.getElementById(PDM_ID_PREFIX + 'detail_name'),
            detailPNR: document.getElementById(PDM_ID_PREFIX + 'detail_pnr'),
            detailAvatar: document.getElementById(PDM_ID_PREFIX + 'detail_avatar'),
            detailStatus: document.getElementById(PDM_ID_PREFIX + 'detail_status'),
            valEintritt: document.getElementById(PDM_ID_PREFIX + 'val_eintritt'),
            valAustritt: document.getElementById(PDM_ID_PREFIX + 'val_austritt'),
            valGeburtstag: document.getElementById(PDM_ID_PREFIX + 'val_geburtstag'),
            valKostenstelle: document.getElementById(PDM_ID_PREFIX + 'val_kostenstelle'),
            valEmail: document.getElementById(PDM_ID_PREFIX + 'val_email')
        };
    }

    attachEventListeners() {
        // Tab Switching
        const tabs = this.elements.root.querySelectorAll('.pdm-tab-item');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tabName = tab.dataset.tab;
                document.getElementById(PDM_ID_PREFIX + 'tab_master_data').classList.toggle('hidden', tabName !== 'master-data');
                document.getElementById(PDM_ID_PREFIX + 'tab_documents').classList.toggle('hidden', tabName !== 'documents');
            });
        });

        // Search
        this.elements.employeeSearch.addEventListener('input', ERPUtils.debounce((e) => {
            this.renderEmployeeList(e.target.value);
        }, 300));

        // Create New Employee
        document.getElementById(PDM_ID_PREFIX + 'btn_new_employee').addEventListener('click', () => this.showEmployeeForm());

        // Edit Employee
        document.getElementById(PDM_ID_PREFIX + 'btn_edit').addEventListener('click', () => {
            const emp = this.employees.find(e => e._id === this.selectedEmployeeId);
            if (emp) this.showEmployeeForm(emp);
        });

        // Delete Employee
        document.getElementById(PDM_ID_PREFIX + 'btn_delete').addEventListener('click', () => this.handleDeleteEmployee());

        // Close Modal
        this.elements.root.querySelectorAll('.pdm-close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.elements.modal.classList.add('hidden'));
        });

        // Document Upload
        this.elements.btnAddDoc.addEventListener('click', () => this.showUploadModal());
        
        this.elements.root.querySelectorAll('.pdm-close-upload-modal').forEach(btn => {
            btn.addEventListener('click', () => this.elements.uploadModal.classList.add('hidden'));
        });

        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const zone = this.elements.dropZone;
        const input = this.elements.fileInput;

        zone.addEventListener('click', () => input.click());

        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.prepareFiles(e.target.files);
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            zone.addEventListener(eventName, () => zone.classList.add('drag-over'));
        });

        ['dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, () => zone.classList.remove('drag-over'));
        });

        zone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                this.prepareFiles(files);
            }
        });

        this.elements.btnStartUpload.addEventListener('click', () => this.handleFileUpload());
    }

    showUploadModal() {
        if (!this.selectedEmployeeId) {
            alert('Bitte wählen Sie zuerst einen Mitarbeiter aus.');
            return;
        }
        
        this.elements.uploadModal.classList.remove('hidden');
        this.resetUploadForm();
    }

    resetUploadForm() {
        this.elements.fileInput.value = '';
        this.elements.uploadStatus.classList.add('hidden');
        this.elements.btnStartUpload.disabled = true;
        this.pendingFiles = null;
    }

    prepareFiles(files) {
        this.pendingFiles = files;
        this.elements.uploadStatus.classList.remove('hidden');
        this.elements.uploadFilename.textContent = files.length === 1 ? files[0].name : `${files.length} Dateien ausgewählt`;
        this.elements.uploadPercent.textContent = 'Bereit';
        this.elements.uploadProgressBar.style.width = '0%';
        this.elements.btnStartUpload.disabled = false;
    }

    async handleFileUpload() {
        if (!this.pendingFiles || !this.selectedEmployeeId) return;

        this.elements.btnStartUpload.disabled = true;
        const files = Array.from(this.pendingFiles);
        const total = files.length;
        
        for (let i = 0; i < total; i++) {
            const file = files[i];
            const percent = Math.round(((i) / total) * 100);
            
            this.elements.uploadFilename.textContent = `Verarbeite: ${file.name}`;
            this.elements.uploadPercent.textContent = `${percent}%`;
            this.elements.uploadProgressBar.style.width = `${percent}%`;

            // 1. Create dms_dokument (Container)
            const docResult = await this.api.create('dms_dokument', {
                dokumentcaption_text: file.name,
                dokumenttyp_text: file.type.split('/')[1]?.toUpperCase() || 'DAT',
                gueltigvon_date: new Date().toISOString()
            });
            
            if (docResult.success) {
                const newDocId = docResult.data._id;
                
                // 2. Create dms_dokumentversion
                const versionResult = await this.api.create('dms_dokumentversion', {
                    dateiname_text: file.name,
                    // In a real scenario, the file URL from Bubble's file upload would go here
                    datei_file: "https://example.com/files/" + file.name,
                    dokument_custom_dms_dokumente: newDocId,
                    ursprung_text: 'Personalmanagement'
                });

                if (versionResult.success) {
                    const versionId = versionResult.data._id;
                    
                    // 3. Update dms_dokument with latest version
                    await this.api.update('dms_dokument', newDocId, {
                        neuesteversion_custom_dms_dokumentversion: versionId
                    });

                    // 4. Link to employee
                    const employee = this.employees.find(e => e._id === this.selectedEmployeeId);
                    const currentDocs = employee.dokumente_list_custom_dms_dokumente || [];
                    
                    await this.api.update('gen_mitarbeiter', this.selectedEmployeeId, {
                        dokumente_list_custom_dms_dokumente: [...currentDocs, newDocId]
                    });
                }
            }
        }

        this.elements.uploadProgressBar.style.width = '100%';
        this.elements.uploadPercent.textContent = '100%';
        
        setTimeout(async () => {
            this.elements.uploadModal.classList.add('hidden');
            // Refresh employee data and documents
            await this.loadEmployees();
            this.selectEmployee(this.selectedEmployeeId);
        }, 800);
    }

    async loadEmployees() {
        this.elements.employeeList.innerHTML = '<div class="p-8 text-center text-slate-400">Lade Mitarbeiter...</div>';
        
        const result = await this.api.list('gen_mitarbeiter', {
            limit: 100,
            sortField: 'nachname_text'
        });

        if (result.success) {
            this.employees = result.data;
            this.store.set('employees', this.employees);
            this.renderEmployeeList();
        } else {
            this.elements.employeeList.innerHTML = '<div class="p-8 text-center text-red-500">Fehler beim Laden der Daten</div>';
        }
    }

    renderEmployeeList(searchTerm = '') {
        const filtered = this.employees.filter(emp => {
            const name = `${emp.vorname_text} ${emp.nachname_text}`.toLowerCase();
            const pnr = (emp.personalnummer_text || '').toLowerCase();
            const query = searchTerm.toLowerCase();
            return name.includes(query) || pnr.includes(query);
        });

        if (filtered.length === 0) {
            this.elements.employeeList.innerHTML = '<div class="p-8 text-center text-slate-400">Keine Mitarbeiter gefunden</div>';
            return;
        }

        this.elements.employeeList.innerHTML = filtered.map(emp => {
            const initials = `${(emp.vorname_text || '')[0] || ''}${(emp.nachname_text || '')[0] || ''}`;
            const isActive = emp._id === this.selectedEmployeeId;
            const statusClass = emp.austritt_date ? 'pdm-status-inactive' : 'pdm-status-active';
            const statusLabel = emp.austritt_date ? 'Ausgeschieden' : 'Aktiv';

            return `
                <div class="pdm-employee-item ${isActive ? 'active' : ''}" data-id="${emp._id}">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm uppercase">
                            ${initials}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-bold text-slate-800 truncate">${emp.vorname_text || ''} ${emp.nachname_text || ''}</h4>
                            <p class="text-xs text-slate-500">PNR: ${emp.personalnummer_text || '—'}</p>
                        </div>
                        <span class="pdm-status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach clicks
        this.elements.employeeList.querySelectorAll('.pdm-employee-item').forEach(item => {
            item.addEventListener('click', () => this.selectEmployee(item.dataset.id));
        });
    }

    async selectEmployee(id) {
        this.selectedEmployeeId = id;
        const emp = this.employees.find(e => e._id === id);
        
        if (!emp) return;

        // Update active state in list
        this.elements.employeeList.querySelectorAll('.pdm-employee-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === id);
        });

        // Show details
        this.elements.detailView.classList.remove('hidden');
        this.elements.emptyState.classList.add('hidden');

        // Fill data
        const initials = `${(emp.vorname_text || '')[0] || ''}${(emp.nachname_text || '')[0] || ''}`;
        this.elements.detailAvatar.textContent = initials;
        this.elements.detailName.textContent = `${emp.vorname_text || ''} ${emp.nachname_text || ''}`;
        this.elements.detailPNR.textContent = `PNR: ${emp.personalnummer_text || '—'}`;
        
        const isInactive = !!emp.austritt_date;
        this.elements.detailStatus.textContent = isInactive ? 'Ausgeschieden' : 'Aktiv';
        this.elements.detailStatus.className = `pdm-status-badge ${isInactive ? 'pdm-status-inactive' : 'pdm-status-active'}`;

        this.elements.valEintritt.textContent = ERPUtils.formatDate(emp.eintritt_date) || '—';
        this.elements.valAustritt.textContent = ERPUtils.formatDate(emp.austritt_date) || '—';
        this.elements.valGeburtstag.textContent = ERPUtils.formatDate(emp.geburtstag_date) || '—';
        this.elements.valKostenstelle.textContent = emp.kostenstelle_custom_kostenstelle || '—';
        this.elements.valEmail.textContent = emp.unternehmen_mail_text || '—';

        // Load Documents
        await this.loadDocuments(emp);
    }

    async loadDocuments(employee) {
        this.elements.docTableContainer.innerHTML = '<div class="p-8 text-center text-slate-400">Lade Dokumente...</div>';
        
        const docIds = employee.dokumente_list_custom_dms_dokumente || [];
        
        if (docIds.length === 0) {
            this.elements.docTableContainer.innerHTML = '<div class="p-12 text-center text-slate-400">Keine Dokumente in der Personalakte vorhanden.</div>';
            return;
        }

        const result = await this.api.list('dms_dokument', {
            constraints: [
                { key: '_id', constraint_type: 'in', value: docIds }
            ]
        });

        if (result.success) {
            const documents = result.data;
            
            // Fetch versions for all documents
            const versionIds = documents
                .map(d => d.neuesteversion_custom_dms_dokumentversion)
                .filter(id => !!id);
            
            let versions = [];
            if (versionIds.length > 0) {
                const vResult = await this.api.list('dms_dokumentversion', {
                    constraints: [
                        { key: '_id', constraint_type: 'in', value: versionIds }
                    ]
                });
                if (vResult.success) versions = vResult.data;
            }

            // Merge data
            this.currentDocuments = documents.map(doc => {
                const version = versions.find(v => v._id === doc.neuesteversion_custom_dms_dokumentversion);
                return {
                    ...doc,
                    versionData: version
                };
            });

            this.renderDocumentTable(this.currentDocuments);
        } else {
            this.elements.docTableContainer.innerHTML = '<div class="p-8 text-center text-red-500">Fehler beim Laden der Dokumente.</div>';
        }
    }

    renderDocumentTable(docs) {
        this.elements.docTableContainer.innerHTML = '';
        const table = new ERPTable(this.elements.docTableContainer.id, {
            columns: [
                { field: 'dokumentcaption_text', title: 'Bezeichnung', sortable: true },
                { field: 'dokumenttyp_text', title: 'Typ' },
                { 
                    title: 'Version', 
                    render: (row) => row.versionData ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">v1</span>` : '-' 
                },
                { field: 'gueltigvon_date', title: 'Erstellt am', type: 'date' },
                { 
                    title: 'Aktionen', 
                    render: (row) => {
                        const fileUrl = row.versionData?.datei_file;
                        return fileUrl 
                            ? `<a href="${fileUrl}" target="_blank" class="text-indigo-600 hover:text-indigo-800 font-medium text-xs">Anzeigen</a>`
                            : `<span class="text-slate-300 text-xs">Keine Datei</span>`;
                    }
                }
            ],
            data: docs,
            pagination: true,
            pageSize: 5
        });
    }

    showEmployeeForm(employee = null) {
        this.elements.modal.classList.remove('hidden');
        this.elements.modalTitle.textContent = employee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter';
        this.elements.formContainer.innerHTML = '';

        const form = new ERPForm(this.elements.formContainer.id, {
            fields: [
                { name: 'vorname_text', label: 'Vorname', type: 'text', required: true },
                { name: 'nachname_text', label: 'Nachname', type: 'text', required: true },
                { name: 'personalnummer_text', label: 'Personalnummer', type: 'text' },
                { name: 'unternehmen_mail_text', label: 'E-Mail (Unternehmen)', type: 'email' },
                { name: 'eintritt_date', label: 'Eintrittsdatum', type: 'date' },
                { name: 'austritt_date', label: 'Austrittsdatum', type: 'date' },
                { name: 'geburtstag_date', label: 'Geburtstag', type: 'date' }
            ],
            data: employee || {},
            submitLabel: employee ? 'Aktualisieren' : 'Anlegen',
            onSubmit: async (values) => {
                let result;
                if (employee) {
                    result = await this.api.update('gen_mitarbeiter', employee._id, values);
                } else {
                    result = await this.api.create('gen_mitarbeiter', values);
                }

                if (result.success) {
                    this.elements.modal.classList.add('hidden');
                    await this.loadEmployees();
                    if (employee) {
                        this.selectEmployee(employee._id);
                    } else {
                        this.selectEmployee(result.data._id);
                    }
                } else {
                    alert('Fehler beim Speichern: ' + (result.error?.message || 'Unbekannter Fehler'));
                }
            },
            onCancel: () => this.elements.modal.classList.add('hidden')
        });
    }

    async handleDeleteEmployee() {
        if (!this.selectedEmployeeId) return;
        
        const emp = this.employees.find(e => e._id === this.selectedEmployeeId);
        if (!confirm(`Möchten Sie den Mitarbeiter ${emp.vorname_text} ${emp.nachname_text} wirklich löschen?`)) return;

        const result = await this.api.delete('gen_mitarbeiter', this.selectedEmployeeId);
        if (result.success) {
            this.selectedEmployeeId = null;
            this.elements.detailView.classList.add('hidden');
            this.elements.emptyState.classList.remove('hidden');
            await this.loadEmployees();
        } else {
            alert('Löschen fehlgeschlagen: ' + (result.error?.message || 'Unbekannter Fehler'));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.pdmSystem = new PersonnelManagementSystem();
});
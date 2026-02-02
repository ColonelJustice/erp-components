const ERP_EMP_STATE = {
  employees: [],
  departments: [],
  isLoaded: false
};

async function initLiveEmployeeModule() {
  setupHandlebars();
  await loadInitialData();
  attachEventListeners();
}

function setupHandlebars() {
  Handlebars.registerHelper('initials', function(vorname, nachname) {
    if (!vorname && !nachname) return "??";
    const f = vorname ? vorname[0] : "?";
    const l = nachname ? nachname[0] : "?";
    return (f + l).toUpperCase();
  });

  Handlebars.registerHelper('formatDate', function(dateStr) {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('de-DE');
    } catch (e) {
      return "Ungültiges Datum";
    }
  });
}

async function loadInitialData() {
  const [deptRes, empRes] = await Promise.all([
    listBubbleObjects('erp_kostenstelle', { limit: 100 }),
    listBubbleObjects('gen_mitarbeiter', { limit: 50, sortField: 'nachname_text' })
  ]);

  if (deptRes.success) {
    ERP_EMP_STATE.departments = deptRes.data;
    populateDepartmentFilter(deptRes.data);
  }

  if (empRes.success) {
    ERP_EMP_STATE.employees = empRes.data;
    renderEmployeeTable(empRes.data);
    ERP_EMP_STATE.isLoaded = true;
  } else {
    document.getElementById("emp-tbl-body").innerHTML = `<tr><td colspan="6" class="p-10 text-center text-red-500">Fehler beim Laden: ${empRes.error?.message}</td></tr>`;
  }
}

function populateDepartmentFilter(depts) {
  const filterSelect = document.getElementById('emp-tbl-filter-dept');
  depts.forEach(dept => {
    const opt = document.createElement('option');
    opt.value = dept._id;
    opt.textContent = dept.bezeichnung_text || dept.code_text;
    filterSelect.appendChild(opt);
  });
}

function renderEmployeeTable(items) {
  const source = document.getElementById("emp-tbl-row-template").innerHTML;
  const template = Handlebars.compile(source);

  // Enrich data with department labels
  const enriched = items.map(emp => {
    const dept = ERP_EMP_STATE.departments.find(d => d._id === emp.kostenstelle_custom_kostenstelle);
    return {
      ...emp,
      kostenstelle_label: dept ? (dept.code_text || dept.bezeichnung_text) : 'Unzugeordnet'
    };
  });

  const html = template({ items: enriched });
  document.getElementById("emp-tbl-body").innerHTML = html;
  document.getElementById("emp-tbl-count").textContent = items.length;
}

function attachEventListeners() {
  const searchInput = document.getElementById('emp-tbl-search-all');
  const deptFilter = document.getElementById('emp-tbl-filter-dept');
  const statusFilter = document.getElementById('emp-tbl-filter-status');
  const refreshBtn = document.getElementById('emp-tbl-refresh');

  const runFilters = () => {
    const query = searchInput.value.toLowerCase();
    const deptId = deptFilter.value;
    const status = statusFilter.value;

    const filtered = ERP_EMP_STATE.employees.filter(emp => {
      const nameStr = `${emp.vorname_text} ${emp.nachname_text} ${emp.unternehmen_mail_text} ${emp.personalnummer_text}`.toLowerCase();
      const matchesSearch = nameStr.includes(query);
      const matchesDept = !deptId || emp.kostenstelle_custom_kostenstelle === deptId;

      const now = new Date();
      const isActive = !emp.austritt_date || new Date(emp.austritt_date) > now;
      
      let matchesStatus = true;
      if (status === 'active') matchesStatus = isActive;
      if (status === 'inactive') matchesStatus = !isActive;

      return matchesSearch && matchesDept && matchesStatus;
    });

    renderEmployeeTable(filtered);
  };

  searchInput.addEventListener('input', runFilters);
  deptFilter.addEventListener('change', runFilters);
  statusFilter.addEventListener('change', runFilters);
  
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.add('animate-spin');
    await loadInitialData();
    refreshBtn.classList.remove('animate-spin');
  });
}

// Run on ready
if (document.readyState === 'complete') {
  initLiveEmployeeModule();
} else {
  window.addEventListener('load', initLiveEmployeeModule);
}
import { 
  loadProfiles, 
  saveProfile, 
  deleteProfile, 
  getProfileById, 
  compressImage, 
  calculateAge, 
  exportToJson, 
  importFromJson, 
  exportToCsv,
  restoreSampleData,
  removeSampleData,
  getStoredLanguage,
  setStoredLanguage
} from './storage.js';
import { translations } from './translations.js';

// Global Application State
const state = {
  profiles: [],
  currentView: 'dashboard',
  language: getStoredLanguage(),
  filterText: '',
  filterGender: '',
  filterCaste: '',
  filterCity: '',
  filterMarital: '',
  filterStatus: '',
  profilesViewMode: 'grid', // 'grid' or 'table'
  editingProfileId: null,
  activeProfile: null,
  pendingDeleteId: null,
  charts: {}
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  state.profiles = loadProfiles();
  setupNavigation();
  setupLanguage();
  setupFormHandlers();
  setupFilterHandlers();
  setupModalHandlers();
  setupDataManagementHandlers();
  setupMobileMenu();

  // Route based on URL hash or default to dashboard
  const hash = window.location.hash.replace('#', '');
  if (['dashboard', 'profiles', 'form', 'matched', 'stats', 'data'].includes(hash)) {
    navigateTo(hash);
  } else {
    navigateTo('dashboard');
  }
});

// Expose navigateTo globally for inline onclicks
window.navigateTo = navigateTo;

export function navigateTo(viewId) {
  state.currentView = viewId;
  window.location.hash = viewId;

  // View sections mapping
  const views = {
    dashboard: document.getElementById('dashboardView'),
    profiles: document.getElementById('profilesView'),
    form: document.getElementById('formView'),
    matched: document.getElementById('profilesView'), // uses profiles view with status filter
    stats: document.getElementById('statsView'),
    data: document.getElementById('dataView')
  };

  Object.values(views).forEach(el => {
    if (el) el.classList.add('hidden');
  });

  // Update active navigation state in sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    const target = item.getAttribute('data-view');
    if (target === viewId) {
      item.classList.add('bg-emerald-800', 'text-amber-300', 'font-semibold');
      item.classList.remove('text-emerald-100');
    } else {
      item.classList.remove('bg-emerald-800', 'text-amber-300', 'font-semibold');
      item.classList.add('text-emerald-100');
    }
  });

  // Show selected view and render data
  if (viewId === 'dashboard') {
    views.dashboard?.classList.remove('hidden');
    renderDashboard();
  } else if (viewId === 'profiles') {
    views.profiles?.classList.remove('hidden');
    state.filterStatus = '';
    const filterStatusEl = document.getElementById('filterStatus');
    if (filterStatusEl) filterStatusEl.value = '';
    renderProfilesList();
  } else if (viewId === 'matched') {
    views.profiles?.classList.remove('hidden');
    state.filterStatus = 'Matched';
    const filterStatusEl = document.getElementById('filterStatus');
    if (filterStatusEl) filterStatusEl.value = 'Matched';
    renderProfilesList();
  } else if (viewId === 'form') {
    views.form?.classList.remove('hidden');
    if (!state.editingProfileId) {
      resetFormForNewEntry();
    }
  } else if (viewId === 'stats') {
    views.stats?.classList.remove('hidden');
    renderDetailedStats();
  } else if (viewId === 'data') {
    views.data?.classList.remove('hidden');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== BILINGUAL TRANSLATION ENGINE ====================
function setupLanguage() {
  const btnEn = document.getElementById('langBtnEn');
  const btnUr = document.getElementById('langBtnUr');

  btnEn?.addEventListener('click', () => setLanguage('en'));
  btnUr?.addEventListener('click', () => setLanguage('ur'));

  applyLanguage(state.language);
}

function setLanguage(lang) {
  state.language = lang;
  setStoredLanguage(lang);
  applyLanguage(lang);
  if (state.currentView === 'dashboard') renderDashboard();
  if (state.currentView === 'profiles' || state.currentView === 'matched') renderProfilesList();
}

function applyLanguage(lang) {
  const isUrdu = lang === 'ur';
  document.documentElement.lang = lang;
  document.documentElement.dir = isUrdu ? 'rtl' : 'ltr';

  const btnEn = document.getElementById('langBtnEn');
  const btnUr = document.getElementById('langBtnUr');
  if (btnEn && btnUr) {
    if (isUrdu) {
      btnUr.className = "px-2.5 py-1 text-xs font-bold rounded bg-white text-emerald-950 transition-all font-urdu";
      btnEn.className = "px-2.5 py-1 text-xs font-bold rounded text-white/80 hover:text-white transition-all";
    } else {
      btnEn.className = "px-2.5 py-1 text-xs font-bold rounded bg-white text-emerald-950 transition-all";
      btnUr.className = "px-2.5 py-1 text-xs font-bold rounded text-white/80 hover:text-white transition-all font-urdu";
    }
  }

  const dict = translations[lang] || translations.en;

  // Translate text elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Translate placeholders
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (dict[key]) {
      el.setAttribute('placeholder', dict[key]);
    }
  });
}

function t(key) {
  const dict = translations[state.language] || translations.en;
  return dict[key] || key;
}

// ==================== NAVIGATION & SHELL ====================
function setupNavigation() {
  document.querySelectorAll('[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      navigateTo(view);
      // Close mobile sidebar if open
      document.getElementById('appSidebar')?.classList.add('-translate-x-full');
    });
  });

  document.querySelectorAll('.btn-add-rishta').forEach(btn => {
    btn.addEventListener('click', () => {
      state.editingProfileId = null;
      navigateTo('form');
    });
  });
}

function setupMobileMenu() {
  const toggle = document.getElementById('mobileMenuToggle');
  const sidebar = document.getElementById('appSidebar');
  const close = document.getElementById('closeSidebar');

  toggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('-translate-x-full');
  });

  close?.addEventListener('click', () => {
    sidebar?.classList.add('-translate-x-full');
  });
}

// ==================== DASHBOARD RENDERING & CHARTS ====================
function renderDashboard() {
  const profiles = state.profiles;

  // 1. Calculate General KPIs
  const total = profiles.length;
  const male = profiles.filter(p => p.gender === 'Male').length;
  const female = profiles.filter(p => p.gender === 'Female').length;
  const active = profiles.filter(p => p.status === 'Active').length;
  const matched = profiles.filter(p => p.status === 'Matched').length;

  const single = profiles.filter(p => p.maritalStatus === 'Single').length;
  const married = profiles.filter(p => p.maritalStatus === 'Married').length;
  const divorced = profiles.filter(p => p.maritalStatus === 'Divorced').length;
  const widowed = profiles.filter(p => p.maritalStatus === 'Widowed').length;

  // Update KPI DOM
  setText('kpiTotal', total);
  setText('kpiMale', male);
  setText('kpiFemale', female);
  setText('kpiActive', active);
  setText('kpiMatched', matched);
  setText('kpiSingle', single);
  setText('kpiMarried', married);
  setText('kpiDivorced', divorced);
  setText('kpiWidowed', widowed);

  // 2. Age Groups Calculation
  const ageStats = {
    under20: 0,
    age20_25: 0,
    age26_30: 0,
    age31_35: 0,
    age36_40: 0,
    age41_50: 0,
    age51plus: 0
  };

  profiles.forEach(p => {
    const age = Number(p.age) || 0;
    if (age < 20) ageStats.under20++;
    else if (age <= 25) ageStats.age20_25++;
    else if (age <= 30) ageStats.age26_30++;
    else if (age <= 35) ageStats.age31_35++;
    else if (age <= 40) ageStats.age36_40++;
    else if (age <= 50) ageStats.age41_50++;
    else ageStats.age51plus++;
  });

  setText('ageUnder20', ageStats.under20);
  setText('age20_25', ageStats.age20_25);
  setText('age26_30', ageStats.age26_30);
  setText('age31_35', ageStats.age31_35);
  setText('age36_40', ageStats.age36_40);
  setText('age41_50', ageStats.age41_50);
  setText('age51plus', ageStats.age51plus);

  // 3. Dynamic Caste Table & Calculations
  renderCasteBreakdown(profiles);

  // 4. City Statistics Breakdown
  renderCityBreakdown(profiles);

  // 5. Income Statistics
  renderIncomeBreakdown(profiles);

  // 6. Recent 10 Registrations
  renderRecentRegistrations(profiles);

  // 7. Interactive Charts (Chart.js)
  initOrUpdateCharts({ total, male, female, single, married, divorced, widowed, ageStats, profiles });
}

function renderCasteBreakdown(profiles) {
  const casteMap = {};

  profiles.forEach(p => {
    const rawCaste = (p.caste || 'Unspecified').trim();
    const caste = rawCaste.charAt(0).toUpperCase() + rawCaste.slice(1);
    if (!casteMap[caste]) {
      casteMap[caste] = { caste, male: 0, female: 0, total: 0 };
    }
    if (p.gender === 'Male') casteMap[caste].male++;
    else if (p.gender === 'Female') casteMap[caste].female++;
    casteMap[caste].total++;
  });

  const sortedCastes = Object.values(casteMap).sort((a, b) => b.total - a.total);
  const tbody = document.getElementById('casteTableBody');
  if (!tbody) return;

  if (sortedCastes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">No records available</td></tr>`;
    return;
  }

  tbody.innerHTML = sortedCastes.map(c => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
        <span>${escapeHtml(c.caste)}</span>
      </td>
      <td class="py-2.5 px-3 text-center text-emerald-800 font-bold">${c.male}</td>
      <td class="py-2.5 px-3 text-center text-amber-700 font-bold">${c.female}</td>
      <td class="py-2.5 px-3 text-center font-black text-slate-900 bg-slate-50/50">${c.total}</td>
    </tr>
  `).join('');
}

function renderCityBreakdown(profiles) {
  const cityMap = {};
  profiles.forEach(p => {
    const city = (p.city || 'Other').trim();
    cityMap[city] = (cityMap[city] || 0) + 1;
  });

  const sorted = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const container = document.getElementById('cityStatsContainer');
  if (!container) return;

  container.innerHTML = sorted.map(([city, count]) => `
    <div class="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
      <span class="font-medium text-slate-700 truncate">${escapeHtml(city)}</span>
      <span class="font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">${count}</span>
    </div>
  `).join('');
}

function renderIncomeBreakdown(profiles) {
  const container = document.getElementById('incomeStatsContainer');
  if (!container) return;

  const ranges = {
    'Under 100k': 0,
    '100k - 250k': 0,
    '250k - 500k': 0,
    '500k+': 0
  };

  profiles.forEach(p => {
    const inc = Number(p.monthlyIncome) || 0;
    if (inc < 100000) ranges['Under 100k']++;
    else if (inc <= 250000) ranges['100k - 250k']++;
    else if (inc <= 500000) ranges['250k - 500k']++;
    else ranges['500k+']++;
  });

  container.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
      ${Object.entries(ranges).map(([range, count]) => `
        <div class="p-2 bg-slate-50 rounded border border-slate-200">
          <span class="text-slate-500 block">${range}</span>
          <strong class="text-emerald-950 font-black text-sm">${count}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRecentRegistrations(profiles) {
  const container = document.getElementById('recentRegistrationsContainer');
  if (!container) return;

  const recent = [...profiles].sort((a, b) => (b.regDate || '').localeCompare(a.regDate || '')).slice(0, 8);

  if (recent.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">No registered profiles yet.</div>`;
    return;
  }

  container.innerHTML = recent.map(p => `
    <div class="p-3 sm:px-6 flex items-center justify-between hover:bg-slate-50 transition-colors gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <img src="${p.photoUrl || getPlaceholderPhoto(p.gender)}" alt="${escapeHtml(p.name)}" class="w-10 h-10 rounded-full object-cover border border-emerald-700 bg-white flex-shrink-0" />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-xs sm:text-sm text-slate-900 truncate">${escapeHtml(p.name)}</h4>
            <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">${p.formNo || '—'}</span>
          </div>
          <p class="text-[11px] text-slate-500 truncate mt-0.5">
            ${escapeHtml(p.gender)} • ${p.age} yrs • ${escapeHtml(p.caste || '')} • ${escapeHtml(p.city || '')} • ${escapeHtml(p.occupation || '')}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeClass(p.status)}">${escapeHtml(p.status || 'Active')}</span>
        <button class="px-2.5 py-1 bg-slate-100 hover:bg-emerald-800 hover:text-white text-slate-700 rounded text-xs font-semibold transition-colors" onclick="window.viewProfile('${p.id}')">
          ${t('view')}
        </button>
      </div>
    </div>
  `).join('');
}

// Chart.js initialization and updates
function initOrUpdateCharts({ male, female, single, married, divorced, widowed, ageStats, profiles }) {
  if (typeof Chart === 'undefined') return;

  // 1. Gender Chart
  createOrUpdateChart('chartGender', {
    type: 'doughnut',
    data: {
      labels: ['Male', 'Female'],
      datasets: [{
        data: [male, female],
        backgroundColor: ['#065f46', '#b45309'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // 2. Age Distribution Bar Chart
  createOrUpdateChart('chartAge', {
    type: 'bar',
    data: {
      labels: ['<20', '20-25', '26-30', '31-35', '36-40', '41-50', '51+'],
      datasets: [{
        label: 'Applicants',
        data: [
          ageStats.under20,
          ageStats.age20_25,
          ageStats.age26_30,
          ageStats.age31_35,
          ageStats.age36_40,
          ageStats.age41_50,
          ageStats.age51plus
        ],
        backgroundColor: '#047857',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  // 3. Marital Status Donut
  createOrUpdateChart('chartMarital', {
    type: 'doughnut',
    data: {
      labels: ['Single', 'Married', 'Divorced', 'Widowed'],
      datasets: [{
        data: [single, married, divorced, widowed],
        backgroundColor: ['#047857', '#0284c7', '#d97706', '#9333ea'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // 4. Caste Distribution Bar Chart
  const casteCounts = {};
  profiles.forEach(p => {
    const caste = (p.caste || 'Other').trim();
    casteCounts[caste] = (casteCounts[caste] || 0) + 1;
  });
  const sortedCaste = Object.entries(casteCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  createOrUpdateChart('chartCaste', {
    type: 'bar',
    data: {
      labels: sortedCaste.map(c => c[0]),
      datasets: [{
        label: 'Proposals',
        data: sortedCaste.map(c => c[1]),
        backgroundColor: '#059669',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  // 5. City Horizontal Bar Chart
  const cityCounts = {};
  profiles.forEach(p => {
    const city = (p.city || 'Other').trim();
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });
  const sortedCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  createOrUpdateChart('chartCity', {
    type: 'bar',
    data: {
      labels: sortedCity.map(c => c[0]),
      datasets: [{
        label: 'Proposals',
        data: sortedCity.map(c => c[1]),
        backgroundColor: '#0d9488',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  // 6. Education Degree Distribution
  const eduCounts = {};
  profiles.forEach(p => {
    const deg = (p.lastDegree || 'Other').split(' ')[0] || 'Other';
    eduCounts[deg] = (eduCounts[deg] || 0) + 1;
  });
  const sortedEdu = Object.entries(eduCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  createOrUpdateChart('chartEducation', {
    type: 'bar',
    data: {
      labels: sortedEdu.map(e => e[0]),
      datasets: [{
        label: 'Degrees',
        data: sortedEdu.map(e => e[1]),
        backgroundColor: '#10b981',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function createOrUpdateChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (state.charts[canvasId]) {
    state.charts[canvasId].destroy();
  }

  try {
    state.charts[canvasId] = new Chart(canvas, config);
  } catch (err) {
    console.error(`Error initializing chart ${canvasId}:`, err);
  }
}

function renderDetailedStats() {
  const profiles = state.profiles;
  
  // Status chart
  const active = profiles.filter(p => p.status === 'Active').length;
  const matched = profiles.filter(p => p.status === 'Matched').length;
  const onHold = profiles.filter(p => p.status === 'On Hold').length;
  const inactive = profiles.filter(p => p.status === 'Inactive').length;

  createOrUpdateChart('chartStatus', {
    type: 'doughnut',
    data: {
      labels: ['Active', 'Matched', 'On Hold', 'Inactive'],
      datasets: [{
        data: [active, matched, onHold, inactive],
        backgroundColor: ['#10b981', '#0ea5e9', '#f59e0b', '#94a3b8'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // Education detailed bar
  const eduCounts = {};
  profiles.forEach(p => {
    const deg = (p.lastDegree || 'Unspecified').trim();
    eduCounts[deg] = (eduCounts[deg] || 0) + 1;
  });
  const sorted = Object.entries(eduCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  createOrUpdateChart('chartEducationAlt', {
    type: 'bar',
    data: {
      labels: sorted.map(e => e[0]),
      datasets: [{
        label: 'Profiles Count',
        data: sorted.map(e => e[1]),
        backgroundColor: '#047857',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

// ==================== PROFILES MANAGEMENT (SEARCH & LIST) ====================
function setupFilterHandlers() {
  const search = document.getElementById('filterSearch');
  const gender = document.getElementById('filterGender');
  const caste = document.getElementById('filterCaste');
  const city = document.getElementById('filterCity');
  const marital = document.getElementById('filterMarital');
  const status = document.getElementById('filterStatus');
  const clear = document.getElementById('btnClearFilters');

  search?.addEventListener('input', (e) => {
    state.filterText = e.target.value.toLowerCase().trim();
    renderProfilesList();
  });

  gender?.addEventListener('change', (e) => {
    state.filterGender = e.target.value;
    renderProfilesList();
  });

  caste?.addEventListener('change', (e) => {
    state.filterCaste = e.target.value;
    renderProfilesList();
  });

  city?.addEventListener('change', (e) => {
    state.filterCity = e.target.value;
    renderProfilesList();
  });

  marital?.addEventListener('change', (e) => {
    state.filterMarital = e.target.value;
    renderProfilesList();
  });

  status?.addEventListener('change', (e) => {
    state.filterStatus = e.target.value;
    renderProfilesList();
  });

  clear?.addEventListener('click', () => {
    state.filterText = '';
    state.filterGender = '';
    state.filterCaste = '';
    state.filterCity = '';
    state.filterMarital = '';
    state.filterStatus = '';

    if (search) search.value = '';
    if (gender) gender.value = '';
    if (caste) caste.value = '';
    if (city) city.value = '';
    if (marital) marital.value = '';
    if (status) status.value = '';

    renderProfilesList();
  });

  // Toggle Grid / Table view
  const btnGrid = document.getElementById('btnViewGrid');
  const btnTable = document.getElementById('btnViewTable');

  btnGrid?.addEventListener('click', () => {
    state.profilesViewMode = 'grid';
    btnGrid.classList.add('bg-emerald-700', 'text-white');
    btnGrid.classList.remove('text-slate-700');
    btnTable.classList.remove('bg-emerald-700', 'text-white');
    btnTable.classList.add('text-slate-700');
    renderProfilesList();
  });

  btnTable?.addEventListener('click', () => {
    state.profilesViewMode = 'table';
    btnTable.classList.add('bg-emerald-700', 'text-white');
    btnTable.classList.remove('text-slate-700');
    btnGrid.classList.remove('bg-emerald-700', 'text-white');
    btnGrid.classList.add('text-slate-700');
    renderProfilesList();
  });
}

function updateFilterDropdownOptions() {
  const casteSelect = document.getElementById('filterCaste');
  const citySelect = document.getElementById('filterCity');
  if (!casteSelect || !citySelect) return;

  const currentCaste = state.filterCaste;
  const currentCity = state.filterCity;

  const castes = Array.from(new Set(state.profiles.map(p => (p.caste || '').trim()).filter(Boolean))).sort();
  const cities = Array.from(new Set(state.profiles.map(p => (p.city || '').trim()).filter(Boolean))).sort();

  casteSelect.innerHTML = `<option value="">${t('allCastes')}</option>` +
    castes.map(c => `<option value="${escapeHtml(c)}" ${c === currentCaste ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');

  citySelect.innerHTML = `<option value="">${t('allCities')}</option>` +
    cities.map(c => `<option value="${escapeHtml(c)}" ${c === currentCity ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
}

function getFilteredProfiles() {
  return state.profiles.filter(p => {
    // Text search (matches Name, Father name, Form No, CNIC, Phone, Caste, City, Occupation, Education)
    if (state.filterText) {
      const haystack = [
        p.name, p.fatherName, p.formNo, p.cnic, p.phone1, p.phone2, 
        p.caste, p.city, p.occupation, p.lastDegree, p.address
      ].join(' ').toLowerCase();

      if (!haystack.includes(state.filterText)) return false;
    }

    if (state.filterGender && p.gender !== state.filterGender) return false;
    if (state.filterCaste && (p.caste || '').toLowerCase() !== state.filterCaste.toLowerCase()) return false;
    if (state.filterCity && (p.city || '').toLowerCase() !== state.filterCity.toLowerCase()) return false;
    if (state.filterMarital && p.maritalStatus !== state.filterMarital) return false;
    if (state.filterStatus && p.status !== state.filterStatus) return false;

    return true;
  });
}

function renderProfilesList() {
  updateFilterDropdownOptions();
  const filtered = getFilteredProfiles();

  const countEl = document.getElementById('resultsCount');
  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} of ${state.profiles.length} total proposals registered`;
  }

  const gridContainer = document.getElementById('profilesGridContainer');
  const tableContainer = document.getElementById('profilesTableContainer');
  const emptyNotice = document.getElementById('emptyProfilesNotice');

  if (filtered.length === 0) {
    gridContainer?.classList.add('hidden');
    tableContainer?.classList.add('hidden');
    emptyNotice?.classList.remove('hidden');
    return;
  }

  emptyNotice?.classList.add('hidden');

  if (state.profilesViewMode === 'grid') {
    gridContainer?.classList.remove('hidden');
    tableContainer?.classList.add('hidden');
    renderGrid(filtered);
  } else {
    gridContainer?.classList.add('hidden');
    tableContainer?.classList.remove('hidden');
    renderTable(filtered);
  }
}

function renderGrid(profiles) {
  const container = document.getElementById('profilesGridContainer');
  if (!container) return;

  container.innerHTML = profiles.map(p => `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between">
      <!-- Card Header with Photo & Quick Info -->
      <div class="p-4 flex gap-3 sm:gap-4">
        <div class="w-20 h-24 rounded-lg overflow-hidden border-2 border-emerald-800 flex-shrink-0 bg-slate-100 relative group cursor-pointer" onclick="window.viewProfile('${p.id}')">
          <img src="${p.photoUrl || getPlaceholderPhoto(p.gender)}" alt="${escapeHtml(p.name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          <span class="absolute bottom-0 inset-x-0 bg-emerald-950/70 text-[9px] text-white text-center py-0.5">View</span>
        </div>
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center justify-between gap-1">
            <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">#${p.formNo || '—'}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadgeClass(p.status)}">${escapeHtml(p.status || 'Active')}</span>
          </div>
          <h3 class="text-sm font-bold text-slate-900 truncate leading-tight cursor-pointer hover:text-emerald-800" onclick="window.viewProfile('${p.id}')">${escapeHtml(p.name)}</h3>
          <p class="text-[11px] text-slate-500 font-medium truncate">S/O, D/O: ${escapeHtml(p.fatherName || '—')}</p>
          <div class="flex items-center gap-1.5 text-xs text-slate-700 font-semibold pt-0.5">
            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">${escapeHtml(p.gender)}</span>
            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">${p.age} yrs</span>
            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">${escapeHtml(p.maritalStatus || 'Single')}</span>
          </div>
        </div>
      </div>

      <!-- Detail Badges -->
      <div class="px-4 py-2 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
        <div><strong class="text-slate-400">Caste:</strong> <span class="font-bold text-slate-800">${escapeHtml(p.caste || '—')}</span></div>
        <div><strong class="text-slate-400">City:</strong> <span class="font-bold text-slate-800">${escapeHtml(p.city || '—')}</span></div>
        <div class="truncate"><strong class="text-slate-400">Edu:</strong> ${escapeHtml(p.lastDegree || '—')}</div>
        <div class="truncate"><strong class="text-slate-400">Job:</strong> ${escapeHtml(p.occupation || '—')}</div>
      </div>

      <!-- Action Buttons -->
      <div class="px-4 py-2.5 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
        <button class="font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1" onclick="window.viewProfile('${p.id}')">
          <span>👁️</span> <span>${t('view')}</span>
        </button>
        <div class="flex items-center gap-2">
          <button class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors" onclick="window.editProfile('${p.id}')">
            ${t('edit')}
          </button>
          <button class="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium transition-colors" onclick="window.confirmDelete('${p.id}')">
            ${t('delete')}
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderTable(profiles) {
  const tbody = document.getElementById('profilesTableBody');
  if (!tbody) return;

  tbody.innerHTML = profiles.map(p => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="py-2.5 px-3">
        <img src="${p.photoUrl || getPlaceholderPhoto(p.gender)}" alt="${escapeHtml(p.name)}" class="w-9 h-10 rounded object-cover border border-emerald-700 bg-white" />
      </td>
      <td class="py-2.5 px-3">
        <span class="font-bold text-slate-900 block">${escapeHtml(p.name)}</span>
        <span class="text-[10px] text-slate-400 font-mono">#${p.formNo || '—'}</span>
      </td>
      <td class="py-2.5 px-3 font-semibold">${escapeHtml(p.gender)}</td>
      <td class="py-2.5 px-3 font-bold">${p.age}</td>
      <td class="py-2.5 px-3">${escapeHtml(p.caste || '—')}</td>
      <td class="py-2.5 px-3">${escapeHtml(p.city || '—')}</td>
      <td class="py-2.5 px-3 truncate max-w-[120px]">${escapeHtml(p.lastDegree || '—')}</td>
      <td class="py-2.5 px-3 truncate max-w-[120px]">${escapeHtml(p.occupation || '—')}</td>
      <td class="py-2.5 px-3">${escapeHtml(p.maritalStatus || 'Single')}</td>
      <td class="py-2.5 px-3 text-slate-500 font-mono">${escapeHtml(p.regDate || '—')}</td>
      <td class="py-2.5 px-3">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(p.status)}">${escapeHtml(p.status || 'Active')}</span>
      </td>
      <td class="py-2.5 px-3 text-right">
        <div class="inline-flex items-center gap-1.5">
          <button class="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700" title="View" onclick="window.viewProfile('${p.id}')">👁️</button>
          <button class="p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800" title="Edit" onclick="window.editProfile('${p.id}')">✏️</button>
          <button class="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700" title="Delete" onclick="window.confirmDelete('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==================== FORM MANAGEMENT (ADD & EDIT) ====================
function setupFormHandlers() {
  const form = document.getElementById('rishtaForm');
  const dobInput = document.getElementById('formDob');
  const ageInput = document.getElementById('formCalculatedAge');
  const photoInput = document.getElementById('photoInput');
  const dropzone = document.getElementById('photoDropzone');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  const cancelBtn = document.getElementById('btnCancelForm');

  // Real-time Age Calculation on DOB change
  dobInput?.addEventListener('input', (e) => {
    const age = calculateAge(e.target.value);
    if (ageInput) ageInput.value = age;
  });

  // Photo Drag and Drop & File Selection
  dropzone?.addEventListener('click', () => photoInput?.click());

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-emerald-600', 'bg-emerald-100/50');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-emerald-600', 'bg-emerald-100/50');
  });

  dropzone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-emerald-600', 'bg-emerald-100/50');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoUpload(e.dataTransfer.files[0]);
    }
  });

  photoInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handlePhotoUpload(e.target.files[0]);
    }
  });

  removePhotoBtn?.addEventListener('click', () => {
    setPhotoPreview(null);
  });

  cancelBtn?.addEventListener('click', () => {
    navigateTo('profiles');
  });

  // Submit Handler
  form?.addEventListener('submit', handleFormSubmit);
}

let currentPhotoDataUrl = null;

async function handlePhotoUpload(file) {
  try {
    showToast('Compressing image for browser storage...', 'info');
    // Compress image client-side to max 500px dimension and 0.75 quality JPEG
    const compressed = await compressImage(file, 500, 0.75);
    setPhotoPreview(compressed);
    showToast('Photo uploaded and compressed successfully!', 'success');
  } catch (err) {
    console.error('Photo compression error:', err);
    showToast('Failed to upload image. Please try another image.', 'error');
  }
}

function setPhotoPreview(url) {
  currentPhotoDataUrl = url;
  const img = document.getElementById('photoPreview');
  const placeholder = document.getElementById('photoPlaceholder');
  const removeBtn = document.getElementById('removePhotoBtn');

  if (url) {
    if (img) {
      img.src = url;
      img.classList.remove('hidden');
    }
    placeholder?.classList.add('hidden');
    removeBtn?.classList.remove('hidden');
  } else {
    if (img) {
      img.src = '';
      img.classList.add('hidden');
    }
    placeholder?.classList.remove('hidden');
    removeBtn?.classList.add('hidden');
    const input = document.getElementById('photoInput');
    if (input) input.value = '';
  }
}

function resetFormForNewEntry() {
  const form = document.getElementById('rishtaForm');
  form?.reset();
  setPhotoPreview(null);
  state.editingProfileId = null;

  // Auto-generate next Form No
  const maxFormNo = state.profiles.reduce((max, p) => {
    const num = parseInt(p.formNo, 10);
    return !isNaN(num) && num > max ? num : max;
  }, 1000);

  const formNoInput = document.getElementById('formFormNo');
  if (formNoInput) formNoInput.value = (maxFormNo + 1).toString();

  const regDateInput = document.getElementById('formRegDate');
  if (regDateInput) regDateInput.value = new Date().toISOString().slice(0, 10);

  setText('formModeTitle', t('formSubHeader'));
}

window.editProfile = function(id) {
  const profile = getProfileById(id);
  if (!profile) return;

  state.editingProfileId = id;
  navigateTo('form');

  // Fill Header fields
  setValue('formFormNo', profile.formNo || '');
  setValue('formRegDate', profile.regDate || '');
  setValue('formAppliedBy', profile.appliedBy || 'Self');

  // Fill Section 1
  setValue('formName', profile.name || '');
  setValue('formFatherName', profile.fatherName || '');
  setValue('formCnic', profile.cnic || '');
  setValue('formGender', profile.gender || '');
  setValue('formDob', profile.dob || '');
  setValue('formCalculatedAge', profile.age || calculateAge(profile.dob));

  // Fill Section 2
  setValue('formAddress', profile.address || '');
  setValue('formArea', profile.area || '');
  setValue('formCity', profile.city || '');
  setValue('formProvince', profile.province || 'Punjab');
  setValue('formCountry', profile.country || 'Pakistan');
  setValue('formPhone1', profile.phone1 || '');
  setValue('formPhone2', profile.phone2 || '');
  setValue('formEmail', profile.email || '');
  setValue('formAncestral', profile.ancestralLocation || '');
  setValue('formResidenceType', profile.residenceType || 'Own');

  // Fill Section 3
  setValue('formHeight', profile.height || '');
  setValue('formBuild', profile.build || 'Medium');
  setValue('formComplexion', profile.complexion || 'Fair');
  setValue('formMotherTongue', profile.motherTongue || '');
  setValue('formCaste', profile.caste || '');
  setValue('formMaritalStatus', profile.maritalStatus || 'Single');
  setValue('formChildren', profile.children || 0);
  setValue('formDisability', profile.disability || '');
  setValue('formReligion', profile.religion || '');
  setValue('formHijab', profile.hijab || 'Never');

  // Fill Section 4
  setValue('formLastDegree', profile.lastDegree || '');
  setValue('formMajorSubjects', profile.majorSubjects || '');
  setValue('formInstitute', profile.institute || '');
  setValue('formIslamicEdu', profile.islamicEducation || '');
  setValue('formIslamicInstitute', profile.islamicInstitute || '');
  setValue('formOccupation', profile.occupation || '');
  setValue('formMonthlyIncome', profile.monthlyIncome || '');
  setValue('formCurrency', profile.currency || 'PKR');
  setValue('formIncomeSource', profile.incomeSource || 'Job');
  setValue('formDependents', profile.dependents || 0);

  // Fill Section 5
  setValue('formFatherEdu', profile.fatherEdu || '');
  setValue('formMotherEdu', profile.motherEdu || '');
  setValue('formBrothers', profile.brothers || 0);
  setValue('formSisters', profile.sisters || 0);
  setValue('formSocialStatus', profile.socialStatus || 'Middle');
  setValue('formBackground', profile.background || 'Punjabi');
  setValue('formOtherNationality', profile.otherNationality || '');
  setValue('formStatus', profile.status || 'Active');

  // Fill Section 6 & 7
  setValue('formPartnerDetails', profile.partnerDetails || '');
  setValue('formPrefGender', profile.prefGender || '');
  setValue('formPrefMinAge', profile.prefMinAge || '');
  setValue('formPrefMaxAge', profile.prefMaxAge || '');
  setValue('formPrefCaste', profile.prefCaste || '');
  setValue('formPrefCity', profile.prefCity || '');
  setValue('formPersonality', profile.personality || '');

  // Photo
  setPhotoPreview(profile.photoUrl || null);

  setText('formModeTitle', `Edit Profile: ${profile.name} (Form #${profile.formNo})`);
};

function handleFormSubmit(e) {
  e.preventDefault();

  const name = getValue('formName');
  const fatherName = getValue('formFatherName');
  const gender = getValue('formGender');
  const dob = getValue('formDob');
  const city = getValue('formCity');
  const caste = getValue('formCaste');
  const phone1 = getValue('formPhone1');

  if (!name || !fatherName || !gender || !dob || !city || !caste || !phone1) {
    showToast('Please fill all required fields marked with *', 'error');
    return;
  }

  const age = calculateAge(dob);

  const profileData = {
    id: state.editingProfileId || `PIWF-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    formNo: getValue('formFormNo') || '1001',
    regDate: getValue('formRegDate') || new Date().toISOString().slice(0, 10),
    appliedBy: getValue('formAppliedBy') || 'Self',

    // 1. Basic Info
    name,
    fatherName,
    cnic: getValue('formCnic'),
    gender,
    dob,
    age: age !== '' ? age : Number(getValue('formCalculatedAge')) || 0,

    // 2. Contact Info
    address: getValue('formAddress'),
    area: getValue('formArea'),
    city,
    province: getValue('formProvince') || 'Punjab',
    country: getValue('formCountry') || 'Pakistan',
    phone1,
    phone2: getValue('formPhone2'),
    email: getValue('formEmail'),
    ancestralLocation: getValue('formAncestral'),
    residenceType: getValue('formResidenceType') || 'Own',

    // 3. Personal Traits
    height: getValue('formHeight'),
    build: getValue('formBuild') || 'Medium',
    complexion: getValue('formComplexion') || 'Fair',
    motherTongue: getValue('formMotherTongue'),
    caste,
    maritalStatus: getValue('formMaritalStatus') || 'Single',
    children: Number(getValue('formChildren')) || 0,
    disability: getValue('formDisability') || 'None / Alhamdullilah',
    religion: getValue('formReligion'),
    hijab: getValue('formHijab') || 'Never',

    // 4. Education & Occupation
    lastDegree: getValue('formLastDegree'),
    majorSubjects: getValue('formMajorSubjects'),
    institute: getValue('formInstitute'),
    islamicEducation: getValue('formIslamicEdu'),
    islamicInstitute: getValue('formIslamicInstitute'),
    occupation: getValue('formOccupation'),
    monthlyIncome: Number(getValue('formMonthlyIncome')) || 0,
    currency: getValue('formCurrency') || 'PKR',
    incomeSource: getValue('formIncomeSource') || 'Job',
    dependents: Number(getValue('formDependents')) || 0,

    // 5. Other Details
    fatherEdu: getValue('formFatherEdu'),
    motherEdu: getValue('formMotherEdu'),
    brothers: Number(getValue('formBrothers')) || 0,
    sisters: Number(getValue('formSisters')) || 0,
    socialStatus: getValue('formSocialStatus') || 'Middle',
    background: getValue('formBackground') || 'Punjabi',
    otherNationality: getValue('formOtherNationality') || '',
    status: getValue('formStatus') || 'Active',

    // 6. Partner Preferences
    partnerDetails: getValue('formPartnerDetails'),
    prefGender: getValue('formPrefGender'),
    prefMinAge: Number(getValue('formPrefMinAge')) || '',
    prefMaxAge: Number(getValue('formPrefMaxAge')) || '',
    prefCaste: getValue('formPrefCaste'),
    prefCity: getValue('formPrefCity'),

    // 7. Personality
    personality: getValue('formPersonality'),

    // Candidate Photo
    photoUrl: currentPhotoDataUrl || ''
  };

  saveProfile(profileData);
  state.profiles = loadProfiles();
  showToast(state.editingProfileId ? 'Profile updated successfully!' : 'New Rishta Profile saved successfully!', 'success');
  
  state.editingProfileId = null;
  navigateTo('profiles');
}

// ==================== VIEW PROFILE MODAL ====================
function setupModalHandlers() {
  const closeView = document.getElementById('closeViewModal');
  const viewBackdrop = document.getElementById('viewModalBackdrop');
  const editFromView = document.getElementById('btnEditFromView');
  const printFromView = document.getElementById('btnPrintProfile');

  closeView?.addEventListener('click', closeProfileModal);
  viewBackdrop?.addEventListener('click', (e) => {
    if (e.target === viewBackdrop) closeProfileModal();
  });

  editFromView?.addEventListener('click', () => {
    if (state.activeProfile) {
      closeProfileModal();
      window.editProfile(state.activeProfile.id);
    }
  });

  printFromView?.addEventListener('click', () => {
    if (state.activeProfile) {
      preparePrintForm(state.activeProfile);
      window.print();
    }
  });

  // Delete modal buttons
  const cancelDelete = document.getElementById('cancelDeleteBtn');
  const confirmDelete = document.getElementById('confirmDeleteBtn');
  const deleteBackdrop = document.getElementById('deleteConfirmModal');

  cancelDelete?.addEventListener('click', () => {
    state.pendingDeleteId = null;
    deleteBackdrop?.classList.add('hidden');
  });

  confirmDelete?.addEventListener('click', () => {
    if (state.pendingDeleteId) {
      state.profiles = deleteProfile(state.pendingDeleteId);
      showToast('Profile deleted successfully', 'info');
      state.pendingDeleteId = null;
      deleteBackdrop?.classList.add('hidden');
      if (state.currentView === 'dashboard') renderDashboard();
      else renderProfilesList();
    }
  });
}

window.viewProfile = function(id) {
  const profile = getProfileById(id);
  if (!profile) return;

  state.activeProfile = profile;
  const modal = document.getElementById('viewModalBackdrop');
  if (!modal) return;

  // Populate Header
  setText('viewProfileFormNo', `Form #${profile.formNo || '—'}`);
  const statusEl = document.getElementById('viewProfileStatus');
  if (statusEl) {
    statusEl.textContent = profile.status || 'Active';
    statusEl.className = `px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusBadgeClass(profile.status)}`;
  }

  const photoEl = document.getElementById('viewProfilePhoto');
  if (photoEl) {
    photoEl.src = profile.photoUrl || getPlaceholderPhoto(profile.gender);
  }

  setText('viewProfileName', profile.name || '—');
  setText('viewProfileTagline', `${profile.gender} • ${profile.age} yrs • Caste: ${profile.caste || '—'} • City: ${profile.city || '—'}`);

  setText('vp_maritalStatus', profile.maritalStatus || 'Single');
  setText('vp_caste', profile.caste || '—');
  setText('vp_lastDegree', profile.lastDegree || '—');
  setText('vp_occupation', profile.occupation || '—');

  // Section 1
  setText('vp_fatherName', profile.fatherName || '—');
  setText('vp_cnic', profile.cnic || '—');
  setText('vp_dob', profile.dob || '—');
  setText('vp_age', `${profile.age} years old`);

  // Section 2
  setText('vp_address', profile.address || '—');
  setText('vp_area', profile.area || '—');
  setText('vp_city', profile.city || '—');
  setText('vp_province', profile.province || '—');
  setText('vp_country', profile.country || 'Pakistan');
  setText('vp_phone1', profile.phone1 || '—');
  setText('vp_phone2', profile.phone2 || '—');
  setText('vp_email', profile.email || '—');
  setText('vp_ancestral', profile.ancestralLocation || '—');
  setText('vp_residence', profile.residenceType || '—');

  // Section 3
  setText('vp_height', profile.height || '—');
  setText('vp_build', profile.build || '—');
  setText('vp_complexion', profile.complexion || '—');
  setText('vp_motherTongue', profile.motherTongue || '—');
  setText('vp_religion', profile.religion || '—');
  setText('vp_hijab', profile.hijab || '—');
  setText('vp_children', profile.children || 0);
  setText('vp_disability', profile.disability || 'None');

  // Section 4
  setText('vp_majorSubjects', profile.majorSubjects || '—');
  setText('vp_institute', profile.institute || '—');
  setText('vp_islamicEducation', profile.islamicEducation || '—');
  setText('vp_monthlyIncome', `${Number(profile.monthlyIncome || 0).toLocaleString()} ${profile.currency || 'PKR'}`);
  setText('vp_incomeSource', profile.incomeSource || 'Job');
  setText('vp_dependents', profile.dependents || 0);

  // Section 5
  setText('vp_fatherEdu', profile.fatherEdu || '—');
  setText('vp_motherEdu', profile.motherEdu || '—');
  setText('vp_brothers', profile.brothers || 0);
  setText('vp_sisters', profile.sisters || 0);
  setText('vp_socialStatus', profile.socialStatus || '—');
  setText('vp_background', profile.background || '—');
  setText('vp_otherNationality', profile.otherNationality || 'None');

  // Section 6 & 7
  setText('vp_partnerDetails', profile.partnerDetails || 'None specified');
  setText('vp_prefGender', profile.prefGender || 'Any');
  setText('vp_prefAge', profile.prefMinAge ? `${profile.prefMinAge} - ${profile.prefMaxAge} yrs` : 'Any');
  setText('vp_prefCaste', profile.prefCaste || 'Any');
  setText('vp_prefCity', profile.prefCity || 'Any');
  setText('vp_personality', profile.personality || 'Not provided');

  modal.classList.remove('hidden');
};

function closeProfileModal() {
  const modal = document.getElementById('viewModalBackdrop');
  modal?.classList.add('hidden');
  state.activeProfile = null;
}

window.confirmDelete = function(id) {
  state.pendingDeleteId = id;
  const modal = document.getElementById('deleteConfirmModal');
  modal?.classList.remove('hidden');
};

// ==================== PRINTABLE A4 MARRIAGE BUREAU FORM ====================
function preparePrintForm(p) {
  const printSection = document.getElementById('printSection');
  if (!printSection) return;

  printSection.innerHTML = `
    <div class="print-page font-sans">
      <!-- Official Header -->
      <div class="print-header">
        <h1 style="font-size: 18pt; font-weight: bold; color: #064e3b; margin: 0;">PUNJAB INTERNATIONAL WELFARE FOUNDATION</h1>
        <h2 style="font-size: 14pt; font-weight: bold; color: #92400e; margin: 2px 0 0 0;">MARRIAGE BUREAU REGISTRATION FORM</h2>
        <div style="display: flex; justify-content: space-between; font-size: 9pt; margin-top: 8px; border-top: 1px solid #ccc; padding-top: 4px;">
          <span><strong>Form No:</strong> ${escapeHtml(p.formNo || '—')}</span>
          <span><strong>Registration Date:</strong> ${escapeHtml(p.regDate || '—')}</span>
          <span><strong>Applied By:</strong> ${escapeHtml(p.appliedBy || 'Self')}</span>
          <span><strong>Status:</strong> ${escapeHtml(p.status || 'Active')}</span>
        </div>
      </div>

      <!-- Candidate Snapshot & Photo -->
      <div style="display: flex; gap: 15px; margin-bottom: 10px; border: 1px solid #333; padding: 8px;">
        <div style="width: 100px; height: 130px; border: 1px solid #064e3b; text-align: center; flex-shrink: 0;">
          <img src="${p.photoUrl || getPlaceholderPhoto(p.gender)}" style="width: 100%; height: 100%; object-fit: cover;" alt="Photo" />
        </div>
        <div style="flex: 1; font-size: 10pt; line-height: 1.5;">
          <div style="font-size: 13pt; font-weight: bold; color: #064e3b;">${escapeHtml(p.name)}</div>
          <div><strong>Father's Name:</strong> ${escapeHtml(p.fatherName)}</div>
          <div><strong>Gender / Age:</strong> ${escapeHtml(p.gender)} (${p.age} years) | <strong>DOB:</strong> ${escapeHtml(p.dob)}</div>
          <div><strong>Caste / Clan:</strong> ${escapeHtml(p.caste)} | <strong>Marital Status:</strong> ${escapeHtml(p.maritalStatus)}</div>
          <div><strong>CNIC / B-Form:</strong> ${escapeHtml(p.cnic || '—')}</div>
          <div><strong>City:</strong> ${escapeHtml(p.city)}, ${escapeHtml(p.province)}</div>
        </div>
      </div>

      <!-- Section 1 & 2 -->
      <div class="print-box">
        <div class="print-box-header"><span>1 & 2. Contact & Personal Details</span><span class="font-urdu">رابطہ و ذاتی معلومات</span></div>
        <div class="print-box-content" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
          <div><strong>Phone 1:</strong> ${escapeHtml(p.phone1)}</div>
          <div><strong>Phone 2:</strong> ${escapeHtml(p.phone2 || '—')}</div>
          <div><strong>Email:</strong> ${escapeHtml(p.email || '—')}</div>
          <div style="grid-column: span 2;"><strong>Address:</strong> ${escapeHtml(p.address || '')}, ${escapeHtml(p.area || '')}</div>
          <div><strong>Residence:</strong> ${escapeHtml(p.residenceType || 'Own')}</div>
          <div><strong>Height:</strong> ${escapeHtml(p.height || '—')}</div>
          <div><strong>Build / Complexion:</strong> ${escapeHtml(p.build || '—')} / ${escapeHtml(p.complexion || '—')}</div>
          <div><strong>Religion & Sect:</strong> ${escapeHtml(p.religion || 'Islam')}</div>
        </div>
      </div>

      <!-- Section 3 & 4: Education & Occupation -->
      <div class="print-box">
        <div class="print-box-header"><span>3 & 4. Education & Occupation</span><span class="font-urdu">تعلیم اور پیشہ</span></div>
        <div class="print-box-content" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div><strong>Last Degree:</strong> ${escapeHtml(p.lastDegree || '—')}</div>
          <div><strong>Institute:</strong> ${escapeHtml(p.institute || '—')}</div>
          <div><strong>Major Subjects:</strong> ${escapeHtml(p.majorSubjects || '—')}</div>
          <div><strong>Islamic Education:</strong> ${escapeHtml(p.islamicEducation || '—')}</div>
          <div><strong>Occupation:</strong> ${escapeHtml(p.occupation || '—')}</div>
          <div><strong>Monthly Income:</strong> ${Number(p.monthlyIncome || 0).toLocaleString()} ${escapeHtml(p.currency || 'PKR')} (${escapeHtml(p.incomeSource || 'Job')})</div>
        </div>
      </div>

      <!-- Section 5: Family Background -->
      <div class="print-box">
        <div class="print-box-header"><span>5. Family Background</span><span class="font-urdu">خاندانی پس منظر</span></div>
        <div class="print-box-content" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
          <div><strong>Father's Edu:</strong> ${escapeHtml(p.fatherEdu || '—')}</div>
          <div><strong>Mother's Edu:</strong> ${escapeHtml(p.motherEdu || '—')}</div>
          <div><strong>Brothers / Sisters:</strong> ${p.brothers || 0} Bro / ${p.sisters || 0} Sis</div>
          <div><strong>Social Status:</strong> ${escapeHtml(p.socialStatus || '—')}</div>
          <div><strong>Background:</strong> ${escapeHtml(p.background || '—')}</div>
          <div><strong>Status Abroad:</strong> ${escapeHtml(p.otherNationality || 'None')}</div>
        </div>
      </div>

      <!-- Section 6: Partner Preferences -->
      <div class="print-box">
        <div class="print-box-header"><span>6. Looking for (Partner Details)</span><span class="font-urdu">مطلوبہ رشتہ</span></div>
        <div class="print-box-content">
          <p style="margin: 0 0 6px 0; font-style: italic;">${escapeHtml(p.partnerDetails || 'None specified')}</p>
          <div style="font-size: 8.5pt; color: #333;">
            <strong>Pref Gender:</strong> ${escapeHtml(p.prefGender || 'Any')} | 
            <strong>Age:</strong> ${p.prefMinAge ? `${p.prefMinAge}–${p.prefMaxAge} yrs` : 'Any'} | 
            <strong>Caste:</strong> ${escapeHtml(p.prefCaste || 'Any')} | 
            <strong>City:</strong> ${escapeHtml(p.prefCity || 'Any')}
          </div>
        </div>
      </div>

      <!-- Declaration & Signatures -->
      <div style="border: 1px solid #333; padding: 8px; margin-top: 8px; font-size: 8pt; background-color: #fafafa;">
        <div style="font-weight: bold; color: #064e3b; margin-bottom: 2px;">DECLARATION / اقرار نامہ:</div>
        <p style="margin: 0;">"I declare that the above mentioned facts are correct and I am well aware that the Punjab Marriage Bureau is not responsible for anything besides introducing the concerned parties."</p>
        <p class="font-urdu" style="direction: rtl; text-align: right; margin: 4px 0 0 0;">"میں تصدیق کرتا / کرتی ہوں کہ یہ معلومات درست ہیں اور میں اس بات سے آگاہ ہوں کہ پنجاب میرج بیورو کی ذمہ داری صرف دونوں خاندانوں کو ملانا ہے۔"</p>
        
        <div style="display: flex; justify-content: space-between; margin-top: 25px; padding-top: 5px; border-top: 1px dotted #999;">
          <div style="width: 200px; border-top: 1px solid #333; text-align: center; padding-top: 4px;">Applicant Signature / دستخط</div>
          <div style="font-size: 8pt; color: #666; text-align: center;">Registration Fee: Rs. 500<br/>JazzCash: 03007863799 (Akbar Ali)</div>
          <div style="width: 200px; border-top: 1px solid #333; text-align: center; padding-top: 4px;">Marriage Bureau Officer / مہر و دستخط</div>
        </div>
      </div>
    </div>
  `;
}

// ==================== DATA MANAGEMENT ====================
function setupDataManagementHandlers() {
  const btnExportJson = document.getElementById('btnExportJson');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnImportJson = document.getElementById('btnImportJson');
  const importInput = document.getElementById('importFileInput');
  const btnRestoreDemo = document.getElementById('btnRestoreDemoData');
  const btnRemoveDemo = document.getElementById('btnRemoveDemoData');

  btnExportJson?.addEventListener('click', () => {
    exportToJson(state.profiles);
    showToast('JSON backup exported successfully!', 'success');
  });

  btnExportCsv?.addEventListener('click', () => {
    exportToCsv(state.profiles);
    showToast('Excel CSV spreadsheet exported successfully!', 'success');
  });

  btnImportJson?.addEventListener('click', () => {
    importInput?.click();
  });

  importInput?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        state.profiles = importFromJson(event.target.result);
        showToast('JSON data imported and merged successfully!', 'success');
        renderDashboard();
        renderProfilesList();
      } catch (err) {
        showToast('Failed to import JSON file. Invalid format.', 'error');
      }
    };
    reader.readAsText(file);
  });

  btnRestoreDemo?.addEventListener('click', () => {
    state.profiles = restoreSampleData();
    showToast('Demo sample records restored successfully!', 'success');
    renderDashboard();
    renderProfilesList();
  });

  btnRemoveDemo?.addEventListener('click', () => {
    state.profiles = removeSampleData();
    showToast('Demo sample records removed!', 'info');
    renderDashboard();
    renderProfilesList();
  });
}

// ==================== HELPER UTILITIES ====================
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Active': return 'badge-active';
    case 'Matched': return 'badge-matched';
    case 'On Hold': return 'badge-onhold';
    case 'Inactive': return 'badge-inactive';
    default: return 'badge-active';
  }
}

function getPlaceholderPhoto(gender) {
  return gender === 'Female'
    ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-900 border-emerald-700 text-white',
    error: 'bg-rose-900 border-rose-700 text-white',
    info: 'bg-slate-900 border-slate-700 text-white'
  };

  toast.className = `p-3.5 rounded-xl border shadow-lg text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 pointer-events-auto ${bgColors[type] || bgColors.info}`;
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

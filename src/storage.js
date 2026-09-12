import { sampleRishtaProfiles } from './sampleData.js';

const STORAGE_KEY = 'PIWF_MARRIAGE_BUREAU_PROFILES_V1';
const LANG_KEY = 'PIWF_MARRIAGE_BUREAU_LANG_V1';

export function getStoredLanguage() {
  try {
    return localStorage.getItem(LANG_KEY) || 'en';
  } catch (e) {
    return 'en';
  }
}

export function setStoredLanguage(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {
    console.error('Failed to save language preference', e);
  }
}

export function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First time initialization with demo profiles
      saveProfiles(sampleRishtaProfiles);
      return [...sampleRishtaProfiles];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error loading profiles from localStorage:', error);
    return [...sampleRishtaProfiles];
  }
}

export function saveProfiles(profiles) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    return true;
  } catch (error) {
    console.error('Error saving profiles to localStorage:', error);
    return false;
  }
}

export function saveProfile(profile) {
  const profiles = loadProfiles();
  const existingIndex = profiles.findIndex(p => p.id === profile.id);
  if (existingIndex >= 0) {
    profiles[existingIndex] = profile;
  } else {
    profiles.unshift(profile);
  }
  saveProfiles(profiles);
  return profile;
}

export function deleteProfile(id) {
  const profiles = loadProfiles();
  const filtered = profiles.filter(p => p.id !== id);
  saveProfiles(filtered);
  return filtered;
}

export function getProfileById(id) {
  const profiles = loadProfiles();
  return profiles.find(p => p.id === id) || null;
}

export function restoreSampleData() {
  saveProfiles(sampleRishtaProfiles);
  return [...sampleRishtaProfiles];
}

export function removeSampleData() {
  const profiles = loadProfiles();
  const nonSamples = profiles.filter(p => !p.id.startsWith('PIWF-2024-'));
  saveProfiles(nonSamples);
  return nonSamples;
}

export function clearAllProfiles() {
  saveProfiles([]);
  return [];
}

/**
 * Compresses an image client-side using an off-screen HTML5 Canvas.
 * Ensures the data URL is small enough to fit within localStorage limits.
 */
export function compressImage(file, maxWidth = 500, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Invalid image file'));
    }

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG data URL with specified compression quality
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Calculates candidate's age given date of birth string (YYYY-MM-DD)
 */
export function calculateAge(dobString) {
  if (!dobString) return '';
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

/**
 * Exports all profiles to a downloadable JSON file
 */
export function exportToJson(profiles) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profiles, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `PIWF_Marriage_Bureau_Export_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Imports profiles from a JSON string and merges them with existing profiles
 */
export function importFromJson(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    if (!Array.isArray(imported)) {
      throw new Error('Imported data is not an array');
    }
    const current = loadProfiles();
    const map = new Map();
    // Keep current
    current.forEach(p => map.set(p.id, p));
    // Overwrite or append imported
    imported.forEach(p => {
      if (p.id) map.set(p.id, p);
    });
    const merged = Array.from(map.values());
    saveProfiles(merged);
    return merged;
  } catch (error) {
    console.error('Failed to parse import JSON:', error);
    throw error;
  }
}

/**
 * Exports profiles to a CSV spreadsheet with UTF-8 BOM so Urdu text opens properly in Microsoft Excel
 */
export function exportToCsv(profiles) {
  const headers = [
    "Form No", "Name", "Father Name", "CNIC", "Gender", "DOB", "Age", "Phone 1", "Phone 2", 
    "Email", "City", "Area", "Province", "Caste", "Marital Status", "Education", "Institute", 
    "Occupation", "Monthly Income", "Currency", "Religion", "Hijab", "Status", "Reg Date"
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = profiles.map(p => [
    escapeCsv(p.formNo),
    escapeCsv(p.name),
    escapeCsv(p.fatherName),
    escapeCsv(p.cnic),
    escapeCsv(p.gender),
    escapeCsv(p.dob),
    escapeCsv(p.age),
    escapeCsv(p.phone1),
    escapeCsv(p.phone2),
    escapeCsv(p.email),
    escapeCsv(p.city),
    escapeCsv(p.area),
    escapeCsv(p.province),
    escapeCsv(p.caste),
    escapeCsv(p.maritalStatus),
    escapeCsv(p.lastDegree),
    escapeCsv(p.institute),
    escapeCsv(p.occupation),
    escapeCsv(p.monthlyIncome),
    escapeCsv(p.currency),
    escapeCsv(p.religion),
    escapeCsv(p.hijab),
    escapeCsv(p.status),
    escapeCsv(p.regDate)
  ].join(','));

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility with non-ASCII / Urdu text
  const csvContent = "\uFEFF" + headers.join(',') + "\n" + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `PIWF_Marriage_Registry_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const divisions = require('../../frontend/src/data/vietnam-divisions.json');

const BASE_URL = 'https://sapnhap.bando.com.vn';
const MAP_PATH = '/opt/sapnhap/vnsapnhap10.qgz';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const provinceByCode = new Map();
const unitByCode = new Map();
const unitByMalk = new Map();
const boundaryCache = new Map();

for (const province of divisions) {
  provinceByCode.set(String(province.code), province);
  for (const unit of province.wards || []) {
    unitByCode.set(String(unit.code), { ...unit, province });
    unitByMalk.set(unit.malk, { ...unit, province });
  }
}

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Dịch vụ bản đồ trả HTTP ${response.status}`);
  return response.json();
};

const normalizeGeometry = (value) => {
  if (typeof value === 'string') {
    const pair = value.trim().split(/[\s,]+/).map(Number);
    return pair.length === 2 && pair.every(Number.isFinite) ? pair : value;
  }
  if (!Array.isArray(value)) return value;
  if (value.length && typeof value[0] === 'string' && value.length === 1) {
    const pair = value[0].trim().split(/\s+/).map(Number);
    if (pair.length === 2 && pair.every(Number.isFinite)) return pair;
  }
  if (value.length === 2 && value.every(item => typeof item === 'string')) {
    const pair = value.map(Number);
    if (pair.every(Number.isFinite)) return pair;
  }
  return value.map(normalizeGeometry);
};

const getBoundaryByCode = async (code) => {
  const key = String(code || '').trim();
  const province = provinceByCode.get(key);
  const unit = unitByCode.get(key);
  let entry = unit || (province ? { ...province, province } : null);
  if (!entry && key) {
    const normKey = key.toLowerCase();
    for (const p of divisions) {
      if (String(p.name || '').toLowerCase() === normKey) {
        entry = { ...p, province: p };
        break;
      }
      const matchedWard = (p.wards || []).find(w => String(w.name || '').toLowerCase() === normKey);
      if (matchedWard) {
        entry = { ...matchedWard, province: p };
        break;
      }
    }
  }
  if (!entry) {
    const error = new Error('Không tìm thấy mã đơn vị hành chính');
    error.status = 404;
    throw error;
  }
  const cached = boundaryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise || cached.value;

  const promise = (async () => {
    const body = new URLSearchParams({ id: entry.malk });
    const data = await fetchJson(`${BASE_URL}/pread_json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) {
      throw new Error('Dịch vụ bản đồ không trả về ranh giới hợp lệ');
    }
    for (const feature of data.features) {
      if (feature.geometry) feature.geometry.coordinates = normalizeGeometry(feature.geometry.coordinates);
    }
    boundaryCache.set(key, { value: data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  })();
  boundaryCache.set(key, { promise, expiresAt: Date.now() + CACHE_TTL_MS });
  try { return await promise; } catch (error) { boundaryCache.delete(key); throw error; }
};

const locateAdministrativeUnit = async (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const error = new Error('Tọa độ không hợp lệ');
    error.status = 400;
    throw error;
  }
  const x = lng * 20037508.34 / 180;
  const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo', MAP: MAP_PATH,
    LAYERS: 'bando', QUERY_LAYERS: 'bando', STYLES: '', FORMAT: 'image/png',
    TRANSPARENT: 'true', INFO_FORMAT: 'application/json', CRS: 'EPSG:3857',
    BBOX: `${x - 150},${y - 150},${x + 150},${y + 150}`,
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50', FEATURE_COUNT: '10',
  });
  const data = await fetchJson(`${BASE_URL}/gis/?${params}`);
  const features = Array.isArray(data.features) ? data.features : [];
  for (const feature of features) {
    const properties = feature.properties || {};
    const malk = feature.id || properties.a02_xa;
    const unit = unitByMalk.get(malk);
    if (unit) return {
      province: { code: unit.province.code, name: unit.province.name, malk: unit.province.malk },
      unit: { code: unit.code, name: unit.name, malk: unit.malk, type: unit.type },
    };
  }
  return null;
};

module.exports = { getBoundaryByCode, locateAdministrativeUnit, _catalog: { divisions, unitByCode } };

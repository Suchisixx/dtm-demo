<template>
  <div class="page">
    <div class="container">
      <div class="section-head">
        <h2>Bản đồ dự án</h2>
        <p class="section-desc">Xem tổng quan vị trí các dự án trên bản đồ số GIS</p>
      </div>
      
      <div class="map-card card">
        <div class="filter-bar">
          <div class="form-group">
            <label class="form-label">Nhóm dự án</label>
            <select v-model="filterNhom" class="filter-select">
              <option value="">Tất cả nhóm</option>
              <option value="Nhóm I">Nhóm I</option>
              <option value="Nhóm II">Nhóm II</option>
              <option value="Nhóm III">Nhóm III</option>
              <option value="Nhóm IV">Nhóm IV</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Tỉnh thành</label>
            <select v-model="filterTinh" class="filter-select">
              <option value="">Tất cả tỉnh thành</option>
              <option v-for="tinh in uniqueProvinces" :key="tinh" :value="tinh">
                {{ tinh }}
              </option>
            </select>
          </div>

          <div class="filter-status">
            Hiển thị <strong>{{ filteredProjects.length }}</strong> / {{ projects.length }} dự án
          </div>
        </div>

        <div v-if="error" class="error-msg">
          {{ error }}
        </div>
        
        <div class="map-layout">
          <div class="map-container">
            <div id="gis-map" class="map-view"></div>
            
            <div class="map-legend">
              <div class="legend-title">Phân loại dự án</div>
              <div class="legend-item"><span class="color-dot" style="background: #e74c3c;"></span> Nhóm I (ĐTM cấp Bộ)</div>
              <div class="legend-item"><span class="color-dot" style="background: #e67e22;"></span> Nhóm II (ĐTM cấp Tỉnh)</div>
              <div class="legend-item"><span class="color-dot" style="background: #f1c40f;"></span> Nhóm III (GPMT)</div>
              <div class="legend-item"><span class="color-dot" style="background: #27ae60;"></span> Nhóm IV (ĐKMT)</div>
            </div>
          </div>

          <!-- Danh sách dự án nổi bật bên cạnh bản đồ -->
          <div class="projects-list-side">
            <div class="side-header">
              <span>Danh sách dự án ({{ filteredProjects.length }})</span>
            </div>
            <div class="side-scroll">
              <div v-if="filteredProjects.length === 0" class="empty-side">
                Không tìm thấy dự án phù hợp với bộ lọc.
              </div>
              <div 
                v-for="p in filteredProjects" 
                :key="p.id" 
                class="project-mini-card"
                :class="{ active: selectedProjectId === p.id }"
                @click="focusProject(p)"
              >
                <div class="p-header">
                  <span class="p-nhom-badge" :style="{ backgroundColor: getNhomColor(p.nhom_du_an) }">
                    {{ p.nhom_du_an }}
                  </span>
                  <span class="p-hs-badge">{{ p.loai_ho_so }}</span>
                </div>
                <div class="p-title">{{ p.ten_du_an }}</div>
                <div class="p-meta">
                  <span>📍 {{ p.dia_chi || p.tinh || 'Chưa rõ địa chỉ' }}</span>
                </div>
                <div class="p-user">👤 {{ p.user_name }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { DEFAULT_LAT, DEFAULT_LNG, DEFAULT_ZOOM, NHOM_COLORS, ESRI_TILE_URL, ESRI_ATTRIBUTION, API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'

const emit = defineEmits(['view-project'])

const projects = ref([])
const error = ref('')
const filterNhom = ref('')
const filterTinh = ref('')
const selectedProjectId = ref(null)

let map = null
let clusterGroup = null
const markerMap = new Map()

const uniqueProvinces = computed(() => {
  const provinces = new Set(projects.value.map(p => p.tinh).filter(Boolean))
  return Array.from(provinces).sort()
})

const filteredProjects = computed(() => {
  return projects.value.filter(p => {
    const matchNhom = !filterNhom.value || p.nhom_du_an === filterNhom.value
    const matchTinh = !filterTinh.value || p.tinh === filterTinh.value
    return matchNhom && matchTinh && p.latitude && p.longitude
  })
})

const getNhomColor = (nhom) => NHOM_COLORS[nhom] || NHOM_COLORS.default

const updateMapMarkers = (shouldFit = true) => {
  if (!map || !clusterGroup || !window.L) return

  clusterGroup.clearLayers()
  markerMap.clear()

  filteredProjects.value.forEach(p => {
    const color = getNhomColor(p.nhom_du_an)
    
    // SVG Pin Marker nổi bật, rõ ràng trên nền bản đồ
    const iconHtml = `
      <div class="gis-pin" style="--pin-color: ${color}">
        <svg viewBox="0 0 24 36" width="28" height="38">
          <path fill="${color}" stroke="#ffffff" stroke-width="1.8" d="M12 0C5.38 0 0 5.38 0 12c0 9 12 24 12 24s12-15 12-24c0-6.62-5.38-12-12-12z" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.4))"/>
          <circle cx="12" cy="12" r="4.5" fill="#ffffff"/>
        </svg>
      </div>
    `
    
    const customIcon = window.L.divIcon({
      html: iconHtml,
      className: 'custom-gis-pin-icon',
      iconSize: [28, 38],
      iconAnchor: [14, 38],
      popupAnchor: [0, -38]
    })

    const marker = window.L.marker([p.latitude, p.longitude], { icon: customIcon })
    
    const popupContent = `
      <div style="min-width:240px;max-width:280px;font-family:'Be Vietnam Pro',sans-serif;padding:6px 4px">
        <div style="font-weight:700;font-size:14.5px;margin-bottom:6px;color:#1a1917;line-height:1.4">${p.ten_du_an || 'Chưa có tên'}</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;line-height:1.4">📍 ${p.dia_chi || p.tinh || 'Chưa có địa chỉ'}</div>
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
          <span style="background:${color};color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px">${p.nhom_du_an}</span>
          <span style="background:#e8f4fd;color:#0366d6;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px">${p.loai_ho_so}</span>
        </div>
        <div style="font-size:12px;margin-bottom:4px;line-height:1.4"><strong>Thẩm quyền:</strong> ${p.co_quan || '—'}</div>
        <div style="font-size:12px;margin-bottom:8px;line-height:1.4"><strong>Người tạo:</strong> ${p.user_name || 'Ẩn danh'}</div>
        ${p.quan_trac_gan_nhat_trang_thai ? `
        <div style="font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:6px;line-height:1.4">
          <strong>Quan trắc:</strong>
          <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${p.quan_trac_gan_nhat_trang_thai === 'vuot_nguong' ? '#FDECEA' : p.quan_trac_gan_nhat_trang_thai === 'canh_bao' ? '#FFF8EC' : '#E6F7EF'};color:${p.quan_trac_gan_nhat_trang_thai === 'vuot_nguong' ? '#A82020' : p.quan_trac_gan_nhat_trang_thai === 'canh_bao' ? '#8B6010' : '#1A6B3A'}">
            ${p.quan_trac_gan_nhat_trang_thai === 'vuot_nguong' ? '✗ Vượt' : p.quan_trac_gan_nhat_trang_thai === 'canh_bao' ? '⚠ Cảnh báo' : '✓ Đạt'}
          </span>
          <span style="font-size:10px;color:#999">${new Date(p.quan_trac_gan_nhat_ngay).toLocaleDateString('vi-VN')}</span>
        </div>` : ''}
        <div style="margin-top:10px">
          <button onclick="window.__gisViewProject(${p.id})" style="background:#1b4332;color:#fff;border:none;padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;width:100%;text-align:center;transition:background 0.15s">
            📋 Xem chi tiết & Hồ sơ
          </button>
        </div>
      </div>
    `
    
    marker.bindPopup(popupContent)
    clusterGroup.addLayer(marker)
    markerMap.set(p.id, marker)
  })

  // Tự động căn chỉnh góc nhìn (fitBounds) khi có dự án
  if (shouldFit && filteredProjects.value.length > 0) {
    if (filteredProjects.value.length === 1) {
      const p = filteredProjects.value[0]
      map.flyTo([p.latitude, p.longitude], 13, { duration: 1 })
    } else {
      const bounds = window.L.latLngBounds(filteredProjects.value.map(p => [p.latitude, p.longitude]))
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
    }
  }
}

const focusProject = (p) => {
  selectedProjectId.value = p.id
  if (!map) return
  map.flyTo([p.latitude, p.longitude], 15, { duration: 1 })
  const marker = markerMap.get(p.id)
  if (marker) {
    setTimeout(() => {
      marker.openPopup()
    }, 1000)
  }
}

watch([filterNhom, filterTinh], () => {
  updateMapMarkers(true)
})

const fetchData = async () => {
  try {
    const res = await fetch(API.PROJECTS_GEO)
    if (!res.ok) throw new Error('Không thể tải dữ liệu bản đồ')
    const data = await res.json()
    projects.value = data
    updateMapMarkers(true)
  } catch (err) {
    error.value = err.message
    logger.error(err)
  }
}

onMounted(() => {
  window.__gisViewProject = (id) => {
    emit('view-project', id)
  }

  nextTick(() => {
    if (!window.L) {
      error.value = 'Leaflet library is not loaded'
      return
    }

    map = window.L.map('gis-map').setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM)

    // Esri World Street Map — Bản đồ địa lý sắc nét, hoàn toàn miễn phí, không watermark
    window.L.tileLayer(ESRI_TILE_URL, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 19
    }).addTo(map)

    setTimeout(() => {
      if (map) map.invalidateSize()
    }, 250)

    if (window.L.markerClusterGroup) {
      clusterGroup = window.L.markerClusterGroup({
        maxClusterRadius: 40,
        showCoverageOnHover: false
      })
      map.addLayer(clusterGroup)
    } else {
      clusterGroup = window.L.featureGroup().addTo(map)
    }

    fetchData()
  })
})

onUnmounted(() => {
  if (map) {
    map.remove()
  }
  delete window.__gisViewProject
})
</script>

<style scoped>
.map-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: visible;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px;
  background: var(--surface2, #f8f9fa);
  border-bottom: 1px solid var(--border, #dee2e6);
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.form-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--text, #333);
}

.filter-select {
  padding: 7px 12px;
  border: 1px solid var(--border, #ccc);
  border-radius: var(--radius, 6px);
  background: var(--surface, #fff);
  color: var(--text, #333);
  font-size: 13px;
}

.filter-status {
  margin-left: auto;
  font-size: 13px;
  color: var(--text2, #666);
}

.error-msg {
  padding: 12px;
  background: var(--warn-bg, #fdecea);
  color: var(--red, #e74c3c);
  text-align: center;
  border-bottom: 1px solid var(--border, #ccc);
}

.map-layout {
  display: flex;
  height: calc(100vh - 270px);
  min-height: 480px;
}

.map-container {
  position: relative;
  flex: 1;
  height: 100%;
}

.map-view {
  width: 100%;
  height: 100%;
  background: #f0f0f0;
  position: relative;
}

.map-legend {
  position: absolute;
  bottom: 24px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  padding: 12px 14px;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.15);
  z-index: 1000;
  pointer-events: none;
  border: 1px solid #e0e0e0;
}

.legend-title {
  font-weight: 700;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text, #333);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 5px;
  color: var(--text2, #555);
}

.legend-item:last-child {
  margin-bottom: 0;
}

.color-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  display: inline-block;
}

/* Sidebar danh sách dự án */
.projects-list-side {
  width: 300px;
  border-left: 1px solid var(--border, #eee);
  background: var(--surface, #fff);
  display: flex;
  flex-direction: column;
}

.side-header {
  padding: 12px 16px;
  font-weight: 700;
  font-size: 13px;
  border-bottom: 1px solid var(--border, #eee);
  background: var(--surface2, #fafafa);
}

.side-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-side {
  font-size: 12px;
  color: var(--text3, #999);
  text-align: center;
  padding: 30px 10px;
}

.project-mini-card {
  padding: 10px 12px;
  border: 1px solid var(--border, #eee);
  border-radius: 6px;
  cursor: pointer;
  background: var(--surface, #fff);
  transition: all 0.15s;
}

.project-mini-card:hover {
  border-color: var(--accent, #1b4332);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.project-mini-card.active {
  border-color: var(--accent, #1b4332);
  background: #f4fbf7;
}

.p-header {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.p-nhom-badge {
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
}

.p-hs-badge {
  font-size: 10px;
  font-weight: 600;
  background: #eef2f5;
  color: #495057;
  padding: 2px 6px;
  border-radius: 4px;
}

.p-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text, #222);
  line-height: 1.3;
  margin-bottom: 4px;
}

.p-meta {
  font-size: 11.5px;
  color: var(--text3, #777);
  margin-bottom: 4px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.p-user {
  font-size: 11px;
  color: var(--text3, #888);
}

@media (max-width: 900px) {
  .map-layout {
    flex-direction: column;
    height: auto;
  }
  .map-container {
    height: 400px;
  }
  .projects-list-side {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
    max-height: 250px;
  }
}
</style>

<style>
#gis-map {
  z-index: 0;
}
#gis-map .leaflet-pane {
  z-index: 400;
}
#gis-map .leaflet-tile-pane {
  z-index: 200;
}
#gis-map .leaflet-tile,
#gis-map img.leaflet-tile {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  max-width: none !important;
  max-height: none !important;
  width: 256px !important;
  height: 256px !important;
}
.custom-gis-pin-icon {
  background: transparent !important;
  border: none !important;
}
.gis-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}
.gis-pin:hover {
  transform: scale(1.15);
}
</style>

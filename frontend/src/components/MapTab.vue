<template>
  <div class="page fade-up">
    <div class="container">
      <!-- PAGE HEADER -->
      <div class="page-header">
        <div>
          <h2 class="section-head">Bản đồ Không gian Dự án (GIS Workspace)</h2>
          <p class="section-desc">
            Trực quan hóa vị trí địa lý các dự án đầu tư, phân loại nhóm rủi ro môi trường và trạng thái quan trắc trên nền bản đồ số.
          </p>
        </div>
      </div>

      <div class="card map-workspace-card">
        <!-- FILTER BAR -->
        <div class="map-toolbar">
          <div style="position:relative;min-width:220px;flex:1;max-width:320px">
            <i class="ti ti-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text3)"></i>
            <input type="text" v-model="searchQuery" placeholder="Tìm nhanh tên dự án..." style="padding-left:32px;height:36px" />
          </div>

          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:12.5px;font-weight:600;color:var(--text2);white-space:nowrap">Nhóm dự án:</label>
            <select v-model="filterNhom" style="width:150px;height:36px">
              <option value="">Tất cả nhóm</option>
              <option value="Nhóm I">Nhóm I</option>
              <option value="Nhóm II">Nhóm II</option>
              <option value="Nhóm III">Nhóm III</option>
              <option value="Nhóm IV">Nhóm IV</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:12.5px;font-weight:600;color:var(--text2);white-space:nowrap">Tỉnh / Thành:</label>
            <select v-model="filterTinh" style="width:180px;height:36px">
              <option value="">Tất cả địa phương</option>
              <option v-for="tinh in uniqueProvinces" :key="tinh" :value="tinh">{{ tinh }}</option>
            </select>
          </div>

          <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
            <span class="chip chip-gray">
              <i class="ti ti-map-pin" style="color:var(--accent)"></i>
              Hiển thị <strong>{{ filteredProjects.length }}</strong> / {{ projects.length }} dự án
            </span>
          </div>
        </div>

        <div v-if="error" style="padding:12px 16px;background:var(--red-bg);color:var(--red);border-bottom:1px solid var(--danger-border);font-size:13px">
          <i class="ti ti-alert-circle"></i> {{ error }}
        </div>

        <!-- SPLIT WORKSPACE: SIDEBAR LIST + LARGE MAP -->
        <div class="map-layout">
          <!-- Left Sidebar: Project List -->
          <div class="projects-list-side">
            <div class="side-header">
              <span>Danh sách dự án định vị ({{ filteredProjects.length }})</span>
            </div>
            <div class="side-scroll">
              <div v-if="filteredProjects.length === 0" class="empty-side">
                <i class="ti ti-map-off" style="font-size:24px;display:block;margin-bottom:6px"></i>
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
                  <i class="ti ti-map-pin" style="color:var(--text3)"></i>
                  <span>{{ p.dia_chi || p.tinh || 'Chưa rõ địa chỉ' }}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
                  <span class="p-user">
                    <i class="ti ti-user"></i> {{ p.user_name }}
                  </span>
                  <button type="button" class="btn-ghost btn-sm" style="height:24px;padding:0 8px;font-size:11px"
                          @click.stop="emit('view-project', p.id)">
                    <span>Mở hồ sơ</span>
                    <i class="ti ti-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Area: Interactive GIS Map -->
          <div class="map-container">
            <div id="gis-map" class="map-view"></div>

            <div class="map-legend">
              <div class="legend-title">Chú giải nhóm dự án</div>
              <div class="legend-item"><span class="color-dot" style="background: #e74c3c;"></span> Nhóm I (ĐTM cấp Bộ)</div>
              <div class="legend-item"><span class="color-dot" style="background: #e67e22;"></span> Nhóm II (ĐTM / GPMT)</div>
              <div class="legend-item"><span class="color-dot" style="background: #f1c40f;"></span> Nhóm III (GPMT / ĐKMT)</div>
              <div class="legend-item"><span class="color-dot" style="background: #27ae60;"></span> Nhóm IV (ĐKMT / Miễn)</div>
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
import { normalizeString } from '../utils/string-helpers.js'

const emit = defineEmits(['view-project'])

const projects = ref([])
const error = ref('')
const filterNhom = ref('')
const filterTinh = ref('')
const searchQuery = ref('')
const selectedProjectId = ref(null)

let map = null
let clusterGroup = null
const markerMap = new Map()

const uniqueProvinces = computed(() => {
  const provinces = new Set(projects.value.map(p => p.tinh).filter(Boolean))
  return Array.from(provinces).sort()
})

const filteredProjects = computed(() => {
  const q = normalizeString(searchQuery.value.trim())
  return projects.value.filter(p => {
    const matchNhom = !filterNhom.value || p.nhom_du_an === filterNhom.value
    const matchTinh = !filterTinh.value || p.tinh === filterTinh.value
    const matchSearch = !q || normalizeString(p.ten_du_an || '').includes(q) || normalizeString(p.dia_chi || '').includes(q)
    return matchNhom && matchTinh && matchSearch && p.latitude && p.longitude
  })
})

const getNhomColor = (nhom) => NHOM_COLORS[nhom] || NHOM_COLORS.default

const updateMapMarkers = (shouldFit = true) => {
  if (!map || !clusterGroup || !window.L) return

  clusterGroup.clearLayers()
  markerMap.clear()

  filteredProjects.value.forEach(p => {
    const color = getNhomColor(p.nhom_du_an)

    const iconHtml = `
      <div class="gis-pin" style="--pin-color: ${color}">
        <svg viewBox="0 0 24 36" width="28" height="38">
          <path fill="${color}" stroke="#ffffff" stroke-width="1.8" d="M12 0C5.38 0 0 5.38 0 12c0 9 12 24 12 24s12-15 12-24c0-6.62-5.38-12-12-12z" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.35))"/>
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
      <div style="min-width:240px;max-width:280px;font-family:'Be Vietnam Pro',sans-serif;padding:4px 2px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#192A21;line-height:1.4">${p.ten_du_an || 'Chưa có tên'}</div>
        <div style="font-size:12px;color:#526158;margin-bottom:8px;line-height:1.4">${p.dia_chi || p.tinh || 'Chưa có địa chỉ'}</div>
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
          <span style="background:${color};color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px">${p.nhom_du_an}</span>
          <span style="background:#EFF4F8;color:#5681A5;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px">${p.loai_ho_so}</span>
        </div>
        <div style="font-size:12px;color:#526158;margin-bottom:4px;line-height:1.4"><strong style="color:#192A21">Thẩm quyền:</strong> ${p.co_quan || '—'}</div>
        <div style="font-size:12px;color:#526158;margin-bottom:8px;line-height:1.4"><strong style="color:#192A21">Phụ trách:</strong> ${p.user_name || '—'}</div>
        ${p.quan_trac_gan_nhat_trang_thai ? `
        <div style="font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:6px;line-height:1.4">
          <strong style="color:#192A21">Quan trắc:</strong>
          <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${p.quan_trac_gan_nhat_trang_thai === 'vuot_nguong' ? '#FDF0F0' : p.quan_trac_gan_nhat_trang_thai === 'canh_bao' ? '#FCF6EC' : '#EAF5EF'};color:${p.quan_trac_gan_nhat_trang_thai === 'vuot_nguong' ? '#D65B5B' : p.quan_trac_gan_nhat_trang_thai === 'canh_bao' ? '#D99A38' : '#25845B'}">
            ${p.quan_trac_gan_nhat_trang_thai === 'vuot_nguong' ? 'Vượt ngưỡng' : p.quan_trac_gan_nhat_trang_thai === 'canh_bao' ? 'Cảnh báo' : 'Đạt chuẩn'}
          </span>
        </div>` : ''}
        <div style="margin-top:10px">
          <button onclick="window.__gisViewProject(${p.id})" style="background:#286B4F;color:#fff;border:none;padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;width:100%;text-align:center;font-family:inherit">
            Mở chi tiết hồ sơ dự án →
          </button>
        </div>
      </div>
    `

    marker.bindPopup(popupContent)
    clusterGroup.addLayer(marker)
    markerMap.set(p.id, marker)
  })

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
    }, 900)
  }
}

watch([filterNhom, filterTinh, searchQuery], () => {
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

const handleWindowResize = () => {
  if (map) map.invalidateSize()
}

onMounted(() => {
  window.__gisViewProject = (id) => {
    emit('view-project', id)
  }
  window.addEventListener('resize', handleWindowResize)

  nextTick(() => {
    if (!window.L) {
      error.value = 'Thư viện bản đồ Leaflet chưa sẵn sàng'
      return
    }

    map = window.L.map('gis-map').setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM)

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
  window.removeEventListener('resize', handleWindowResize)
  if (map) {
    map.remove()
  }
  delete window.__gisViewProject
})
</script>

<style scoped>
.map-workspace-card {
  padding: 0;
  overflow: hidden;
  margin-bottom: 0;
}

.map-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.map-layout {
  display: flex;
  height: calc(100vh - 235px);
  min-height: 540px;
}

.projects-list-side {
  width: 320px;
  border-right: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.side-header {
  padding: 12px 16px;
  font-weight: 600;
  font-size: 12.5px;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
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
  font-size: 12.5px;
  color: var(--text3);
  text-align: center;
  padding: 36px 12px;
}

.project-mini-card {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  background: var(--surface);
  transition: all 0.15s ease;
}

.project-mini-card:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.project-mini-card.active {
  border-color: var(--accent);
  background: var(--accent2);
}

.p-header {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.p-nhom-badge {
  font-size: 10.5px;
  font-weight: 600;
  color: #fff;
  padding: 2px 7px;
  border-radius: 4px;
}

.p-hs-badge {
  font-size: 10.5px;
  font-weight: 600;
  background: var(--surface2);
  color: var(--text2);
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.p-title {
  font-weight: 600;
  font-size: 13.5px;
  color: var(--text);
  line-height: 1.35;
  margin-bottom: 4px;
}

.p-meta {
  font-size: 12px;
  color: var(--text2);
  display: flex;
  align-items: flex-start;
  gap: 4px;
  line-height: 1.4;
}

.p-user {
  font-size: 11.5px;
  color: var(--text3);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.map-container {
  position: relative;
  flex: 1;
  height: 100%;
}

.map-view {
  width: 100%;
  height: 100%;
  background: var(--surface2);
}

.map-legend {
  position: absolute;
  bottom: 20px;
  right: 16px;
  background: rgba(255, 255, 255, 0.96);
  padding: 12px 14px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  z-index: 1000;
  pointer-events: none;
  border: 1px solid var(--border);
}

.legend-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 5px;
  color: var(--text);
}

.legend-item:last-child {
  margin-bottom: 0;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

@media (max-width: 900px) {
  .map-layout {
    flex-direction: column-reverse;
    height: auto;
  }
  .map-container {
    height: 440px;
  }
  .projects-list-side {
    width: 100%;
    border-right: none;
    border-top: 1px solid var(--border);
    max-height: 280px;
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

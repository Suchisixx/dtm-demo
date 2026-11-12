<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  DEFAULT_LAT,
  DEFAULT_LNG,
  DEFAULT_ZOOM,
  NHOM_COLORS,
  CARTO_VOYAGER_URL,
  CARTO_ATTRIBUTION,
  OSM_LANDUSE_URL,
  OSM_ATTRIBUTION,
  ESRI_IMAGERY_URL,
  EMBEDDED_GIS_LAYERS,
  API
} from '../utils/constants.js'
import { logger } from '../utils/logger.js'
import { normalizeString } from '../utils/string-helpers.js'

const emit = defineEmits(['view-project'])

const projects = ref([])
const error = ref('')
const filterNhom = ref('')
const filterHoSo = ref('')
const filterQcvn = ref('')
const filterTinh = ref('')
const searchQuery = ref('')
const selectedProjectId = ref(null)

const activeBaseMap = ref('voyager')
const showImpactBuffers = ref(true)
const showSensitiveLayers = ref(true)
let gisStaticLayers = EMBEDDED_GIS_LAYERS

let map = null
let baseTileLayer = null
let labelTileLayer = null
let clusterGroup = null
let bufferLayerGroup = null
let sensitiveLayerGroup = null
const markerMap = new Map()

const uniqueProvinces = computed(() => {
  const provinces = new Set(projects.value.map(p => p.tinh).filter(Boolean))
  return Array.from(provinces).sort()
})

const filteredProjects = computed(() => {
  const q = normalizeString(searchQuery.value.trim())
  return projects.value.filter(p => {
    const matchNhom = !filterNhom.value || (p.nhom_du_an || 'Cần rà soát') === filterNhom.value
    const matchHoSo = !filterHoSo.value || (p.loai_ho_so || 'Chưa xác định').includes(filterHoSo.value)
    const matchQcvn = !filterQcvn.value || (
      filterQcvn.value === 'dat'
        ? (p.quan_trac_gan_nhat_trang_thai === 'dat' || p.quan_trac_gan_nhat_trang_thai === 'dat_chuan')
        : p.quan_trac_gan_nhat_trang_thai === filterQcvn.value
    )
    const matchTinh = !filterTinh.value || p.tinh === filterTinh.value
    const matchSearch = !q || normalizeString(p.ten_du_an || '').includes(q) || normalizeString(p.dia_chi || '').includes(q)
    return matchNhom && matchHoSo && matchQcvn && matchTinh && matchSearch && p.latitude && p.longitude
  })
})

const getNhomColor = (nhom) => {
  if (nhom === 'Cần rà soát') return '#6B7280'
  return NHOM_COLORS[nhom] || NHOM_COLORS.default
}

const getQcvnBadgeMeta = (status) => {
  switch (status) {
    case 'vuot_nguong':
      return { cls: 'vuot_nguong', listLabel: 'Vượt QCVN', popupLabel: 'Vượt ngưỡng', bg: '#FDF0F0', color: '#D65B5B' }
    case 'canh_bao':
      return { cls: 'canh_bao', listLabel: 'Cảnh báo', popupLabel: 'Cảnh báo', bg: '#FCF6EC', color: '#D99A38' }
    case 'dat':
    case 'dat_chuan':
      return { cls: 'dat', listLabel: 'Đạt QCVN', popupLabel: 'Đạt chuẩn', bg: '#EAF5EF', color: '#25845B' }
    case 'chua_du_thong_so':
      return { cls: 'chua_du_thong_so', listLabel: 'Thiếu chỉ tiêu', popupLabel: 'Chưa đủ thông số', bg: '#EFF4F8', color: '#475569' }
    case 'period_mismatch':
      return { cls: 'can_ra_soat', listLabel: 'Lệch chu kỳ', popupLabel: 'Lệch chu kỳ lấy mẫu', bg: '#F3F4F6', color: '#4B5563' }
    case 'can_ra_soat':
    default:
      return { cls: 'can_ra_soat', listLabel: 'Cần rà soát', popupLabel: 'Cần rà soát', bg: '#F3F4F6', color: '#4B5563' }
  }
}

const switchBaseMap = (mode) => {
  activeBaseMap.value = mode
  if (!map || !window.L) return

  if (baseTileLayer) {
    map.removeLayer(baseTileLayer)
    baseTileLayer = null
  }
  if (labelTileLayer) {
    map.removeLayer(labelTileLayer)
    labelTileLayer = null
  }

  if (mode === 'voyager') {
    baseTileLayer = window.L.tileLayer(CARTO_VOYAGER_URL, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20
    }).addTo(map)
  } else if (mode === 'satellite') {
    baseTileLayer = window.L.tileLayer(ESRI_IMAGERY_URL, {
      attribution: '&copy; Google Satellite Hybrid',
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20
    }).addTo(map)
  } else {
    baseTileLayer = window.L.tileLayer(OSM_LANDUSE_URL, {
      attribution: OSM_ATTRIBUTION,
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19
    }).addTo(map)
  }
}

const renderStaticGisOverlays = () => {
  if (!map || !sensitiveLayerGroup || !window.L) return
  sensitiveLayerGroup.clearLayers()
  if (!showSensitiveLayers.value || !gisStaticLayers) return

  for (const kcn of (gisStaticLayers.industrialParks || [])) {
    const circle = window.L.circle([kcn.lat, kcn.lng], {
      radius: kcn.radiusKm * 1000,
      color: '#7C3AED',
      weight: 1.5,
      dashArray: '4, 4',
      fillColor: '#8B5CF6',
      fillOpacity: 0.16
    })
    circle.bindTooltip(
      `<div style="font-family:'Be Vietnam Pro',sans-serif;font-size:12px">
        <strong style="color:#7C3AED">${kcn.name}</strong><br/>
        <span>Địa bàn: ${kcn.province} (Bán kính ~${kcn.radiusKm} km)</span>
      </div>`,
      { sticky: true }
    )
    sensitiveLayerGroup.addLayer(circle)
  }

  for (const sz of (gisStaticLayers.sensitiveZones || [])) {
    const circle = window.L.circle([sz.lat, sz.lng], {
      radius: sz.radiusKm * 1000,
      color: '#D65B5B',
      weight: 1.5,
      dashArray: '6, 4',
      fillColor: '#D65B5B',
      fillOpacity: 0.12
    })
    circle.bindTooltip(
      `<div style="font-family:'Be Vietnam Pro',sans-serif;font-size:12px">
        <strong style="color:#D65B5B">Vùng bảo vệ: ${sz.name}</strong><br/>
        <span>Bán kính nhạy cảm: ${sz.radiusKm} km — ${sz.ref}</span>
      </div>`,
      { sticky: true }
    )
    sensitiveLayerGroup.addLayer(circle)
  }
}

const toggleImpactBuffers = () => {
  showImpactBuffers.value = !showImpactBuffers.value
  updateMapMarkers(false)
}

const toggleSensitiveLayers = () => {
  showSensitiveLayers.value = !showSensitiveLayers.value
  renderStaticGisOverlays()
}

const updateMapMarkers = (shouldFit = true) => {
  if (!map || !clusterGroup || !window.L) return

  clusterGroup.clearLayers()
  if (bufferLayerGroup) bufferLayerGroup.clearLayers()
  markerMap.clear()

  filteredProjects.value.forEach(p => {
    const color = getNhomColor(p.nhom_du_an)
    const radiusMeters = Number(p.impact_radius_meters) || 1000

    if (showImpactBuffers.value && bufferLayerGroup) {
      const impactCircle = window.L.circle([p.latitude, p.longitude], {
        radius: radiusMeters,
        color,
        weight: 1.5,
        dashArray: '5, 4',
        fillColor: color,
        fillOpacity: 0.12
      })
      impactCircle.bindTooltip(
        `<strong>${p.ten_du_an}</strong><br/>Phạm vi ảnh hưởng dự kiến: ${(radiusMeters / 1000).toFixed(1)} km`,
        { sticky: true }
      )
      bufferLayerGroup.addLayer(impactCircle)
    }

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

    const qcvnMeta = p.quan_trac_gan_nhat_trang_thai ? getQcvnBadgeMeta(p.quan_trac_gan_nhat_trang_thai) : null

    const popupContent = `
      <div style="min-width:250px;max-width:290px;font-family:'Be Vietnam Pro',sans-serif;padding:4px 2px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#192A21;line-height:1.4">${p.ten_du_an || 'Chưa có tên'}</div>
        <div style="font-size:12px;color:#526158;margin-bottom:8px;line-height:1.4">${p.dia_chi || p.tinh || 'Chưa có địa chỉ'}</div>
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
          <span style="background:${color};color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px">${p.nhom_du_an || 'Cần rà soát'}</span>
          <span style="background:#EFF4F8;color:#5681A5;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px">${p.loai_ho_so || 'Chưa xác định'}</span>
          <span style="background:#F0F4F1;color:#286B4F;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px">R=${(radiusMeters / 1000).toFixed(1)}km</span>
        </div>
        <div style="font-size:12px;color:#526158;margin-bottom:4px;line-height:1.4"><strong style="color:#192A21">Thẩm quyền:</strong> ${p.co_quan || '—'}</div>
        ${(p.nt || p.kt) ? `<div style="font-size:12px;color:#526158;margin-bottom:4px;line-height:1.4"><strong style="color:#192A21">Phát thải:</strong> NT ${p.nt || 0} m³/ngđ • KT ${p.kt || 0} m³/h</div>` : ''}
        <div style="font-size:12px;color:#526158;margin-bottom:8px;line-height:1.4"><strong style="color:#192A21">Phụ trách:</strong> ${p.user_name || '—'}</div>
        ${qcvnMeta ? `
        <div style="font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:6px;line-height:1.4">
          <strong style="color:#192A21">Quan trắc:</strong>
          <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${qcvnMeta.bg};color:${qcvnMeta.color}">
            ${qcvnMeta.popupLabel}
          </span>
        </div>` : ''}
        <div style="margin-top:10px">
          <button type="button" class="gis-popup-btn" onclick="window.__gisViewProject(${p.id})">
            Mở chi tiết hồ sơ dự án <i class="ti ti-arrow-right" style="vertical-align:-1px"></i>
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

watch([filterNhom, filterHoSo, filterQcvn, filterTinh, searchQuery], () => {
  updateMapMarkers(true)
})

const fetchData = async () => {
  try {
    renderStaticGisOverlays()
    const [geoRes, layersRes] = await Promise.all([
      fetch(API.PROJECTS_GEO),
      fetch(API.CLASSIFY_GIS_LAYERS)
    ])
    if (!geoRes.ok) throw new Error('Không thể tải dữ liệu bản đồ dự án')
    projects.value = await geoRes.json()

    if (layersRes.ok) {
      const ct = layersRes.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const lData = await layersRes.json()
        if (lData && lData.industrialParks) {
          gisStaticLayers = lData
          renderStaticGisOverlays()
        }
      }
    }

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

    map = window.L.map('gis-map', { zoomControl: false }).setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM)
    window.L.control.zoom({ position: 'bottomleft' }).addTo(map)

    switchBaseMap(activeBaseMap.value)

    sensitiveLayerGroup = window.L.layerGroup().addTo(map)
    bufferLayerGroup = window.L.layerGroup().addTo(map)

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

<template>
  <div class="page fade-up">
    <div class="container">
      <!-- PAGE HEADER -->
      <div class="page-header">
        <div>
          <h2 class="section-head">Bản đồ Không gian Dự án (GIS Workspace)</h2>
          <p class="section-desc">
            Trực quan hóa vị trí địa lý các dự án đầu tư, vùng đệm tác động môi trường, phân khu Khu công nghiệp / vùng nhạy cảm và trạng thái quan trắc QCVN trên nền bản đồ số.
          </p>
        </div>
      </div>

      <div class="card map-workspace-card">
        <!-- FILTER BAR -->
        <div class="map-toolbar">
          <div style="position:relative;min-width:200px;flex:1;max-width:260px">
            <i class="ti ti-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text3)"></i>
            <input type="text" v-model="searchQuery" placeholder="Tìm tên dự án, địa chỉ..." style="padding-left:32px;height:36px" />
          </div>

          <div class="toolbar-select-group">
            <label>Nhóm:</label>
            <select v-model="filterNhom" style="width:136px;height:36px">
              <option value="">Tất cả nhóm</option>
              <option value="Nhóm I">Nhóm I</option>
              <option value="Nhóm II">Nhóm II</option>
              <option value="Nhóm III">Nhóm III</option>
              <option value="Nhóm IV">Nhóm IV</option>
              <option value="Cần rà soát">Cần rà soát</option>
            </select>
          </div>

          <div class="toolbar-select-group">
            <label>Hồ sơ:</label>
            <select v-model="filterHoSo" style="width:142px;height:36px">
              <option value="">Tất cả hồ sơ</option>
              <option value="ĐTM">ĐTM</option>
              <option value="GPMT">GPMT</option>
              <option value="ĐKMT">ĐKMT</option>
              <option value="Chưa xác định">Chưa xác định</option>
            </select>
          </div>

          <div class="toolbar-select-group">
            <label>Quan trắc:</label>
            <select v-model="filterQcvn" style="width:155px;height:36px">
              <option value="">Mọi trạng thái</option>
              <option value="vuot_nguong">Vượt ngưỡng</option>
              <option value="canh_bao">Cảnh báo</option>
              <option value="dat">Đạt chuẩn</option>
              <option value="chua_du_thong_so">Thiếu chỉ tiêu</option>
              <option value="can_ra_soat">Cần rà soát</option>
            </select>
          </div>

          <div class="toolbar-select-group">
            <label>Địa phương:</label>
            <select v-model="filterTinh" style="width:160px;height:36px">
              <option value="">Tất cả Tỉnh/TP</option>
              <option v-for="tinh in uniqueProvinces" :key="tinh" :value="tinh">{{ tinh }}</option>
            </select>
          </div>

          <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
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
                    {{ p.nhom_du_an || 'Cần rà soát' }}
                  </span>
                  <span class="p-hs-badge">{{ p.loai_ho_so || 'Chưa xác định' }}</span>
                  <span
                    v-if="p.quan_trac_gan_nhat_trang_thai"
                    class="p-qcvn-badge"
                    :class="getQcvnBadgeMeta(p.quan_trac_gan_nhat_trang_thai).cls"
                  >
                    {{ getQcvnBadgeMeta(p.quan_trac_gan_nhat_trang_thai).listLabel }}
                  </span>
                </div>
                <div class="p-title">{{ p.ten_du_an }}</div>
                <div class="p-meta">
                  <i class="ti ti-map-pin" style="color:var(--text3)"></i>
                  <span>{{ p.dia_chi || p.tinh || 'Chưa rõ địa chỉ' }}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
                  <span class="p-user">
                    <i class="ti ti-radar-2" style="color:var(--accent)"></i>
                    R={{ ((p.impact_radius_meters || 1000) / 1000).toFixed(1) }}km • {{ p.user_name }}
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
            <!-- Floating Top-Left: Base Map Switcher -->
            <div class="gis-floating-controls left">
              <button
                type="button"
                class="gis-ctrl-pill"
                :class="{ active: activeBaseMap === 'landuse' }"
                @click="switchBaseMap('landuse')"
                title="Bản đồ phân vùng đất (KCN, Khu dân cư, Rừng, Nông nghiệp)"
              >
                <i class="ti ti-polygon"></i>
                <span>Phân vùng đất</span>
              </button>
              <button
                type="button"
                class="gis-ctrl-pill"
                :class="{ active: activeBaseMap === 'voyager' }"
                @click="switchBaseMap('voyager')"
                title="Bản đồ Vector hiện đại, tối giản"
              >
                <i class="ti ti-map"></i>
                <span>Tinh gọn</span>
              </button>
              <button
                type="button"
                class="gis-ctrl-pill"
                :class="{ active: activeBaseMap === 'satellite' }"
                @click="switchBaseMap('satellite')"
                title="Ảnh vệ tinh kết hợp nhãn địa danh"
              >
                <i class="ti ti-satellite"></i>
                <span>Vệ tinh</span>
              </button>
            </div>

            <!-- Floating Top-Right: Layer Toggles -->
            <div class="gis-floating-controls right">
              <button
                type="button"
                class="gis-ctrl-pill"
                :class="{ active: showImpactBuffers }"
                @click="toggleImpactBuffers"
                title="Hiển thị vòng tròn phạm vi bán kính ảnh hưởng môi trường của từng dự án"
              >
                <i class="ti ti-radar-2"></i>
                <span>Vùng đệm tác động</span>
              </button>
              <button
                type="button"
                class="gis-ctrl-pill"
                :class="{ active: showSensitiveLayers }"
                @click="toggleSensitiveLayers"
                title="Hiển thị các Khu công nghiệp và Vùng bảo tồn / Nhạy cảm môi trường trên bản đồ"
              >
                <i class="ti ti-layers-linked"></i>
                <span>Lớp KCN &amp; Vùng bảo tồn</span>
              </button>
            </div>

            <div id="gis-map" class="map-view"></div>

            <div class="map-legend">
              <div class="legend-title">Chú giải GIS Môi trường</div>
              <div class="legend-item"><span class="color-dot" style="background: #e74c3c;"></span> Nhóm I (ĐTM cấp Bộ / Nguy cơ cao)</div>
              <div class="legend-item"><span class="color-dot" style="background: #e67e22;"></span> Nhóm II (ĐTM / GPMT)</div>
              <div class="legend-item"><span class="color-dot" style="background: #f1c40f;"></span> Nhóm III (GPMT / ĐKMT)</div>
              <div class="legend-item"><span class="color-dot" style="background: #27ae60;"></span> Nhóm IV (ĐKMT / Ít nguy cơ)</div>
              <div class="legend-item"><span class="color-dot" style="background: #6B7280;"></span> Cần rà soát / Chưa đủ dữ liệu</div>
              <div class="legend-divider"></div>
              <div class="legend-item"><span class="color-ring" style="border-color: #7C3AED; background: rgba(139,92,246,0.2);"></span> Khu công nghiệp tập trung</div>
              <div class="legend-item"><span class="color-ring" style="border-color: #D65B5B; background: rgba(214,91,91,0.18);"></span> Khu bảo tồn / Di sản / Nguồn nước</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-workspace-card {
  padding: 0;
  overflow: hidden;
  margin-bottom: 0;
}

.map-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.toolbar-select-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-select-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text2);
  white-space: nowrap;
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
  flex-wrap: wrap;
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

.p-qcvn-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}
.p-qcvn-badge.vuot_nguong {
  background: var(--red-bg);
  color: var(--red);
}
.p-qcvn-badge.canh_bao {
  background: var(--warn-bg);
  color: var(--warn);
}
.p-qcvn-badge.dat,
.p-qcvn-badge.dat_chuan {
  background: var(--success-bg);
  color: var(--success);
}
.p-qcvn-badge.chua_du_thong_so {
  background: #EFF4F8;
  color: #475569;
}
.p-qcvn-badge.can_ra_soat {
  background: #F3F4F6;
  color: #4B5563;
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

.gis-floating-controls {
  position: absolute;
  top: 12px;
  z-index: 900;
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.96);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.gis-floating-controls.left {
  left: 12px;
}

.gis-floating-controls.right {
  right: 12px;
}

.gis-ctrl-pill {
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text2);
  font-size: 11.5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.gis-ctrl-pill:hover {
  background: var(--surface2);
  color: var(--text);
}

.gis-ctrl-pill.active {
  background: var(--accent);
  color: #ffffff;
}

.map-legend {
  position: absolute;
  bottom: 20px;
  right: 16px;
  background: rgba(255, 255, 255, 0.96);
  padding: 12px 14px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  z-index: 900;
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
  font-size: 11.5px;
  margin-bottom: 5px;
  color: var(--text);
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.color-ring {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1.5px dashed;
  display: inline-block;
  flex-shrink: 0;
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

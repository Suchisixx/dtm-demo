import {
  CARTO_VOYAGER_URL,
  CARTO_ATTRIBUTION,
  FALLBACK_CARTO_VOYAGER_URL,
  FALLBACK_CARTO_ATTRIBUTION,
  OSM_LANDUSE_URL,
  OSM_ATTRIBUTION,
  ESRI_IMAGERY_URL,
  ADMIN_WMS_URL,
  ADMIN_WMS_MAP_PATH,
  API,
} from './constants.js'

/**
 * Tạo lớp nền bản đồ Leaflet và tự động chuyển sang nguồn dự phòng nếu tile chính bị lỗi.
 */
export function createBaseTileLayer(L, mode, map, onLayerReplaced) {
  if (!L || !map) return null

  let layer
  if (mode === 'satellite') {
    layer = L.tileLayer(ESRI_IMAGERY_URL, {
      attribution: '&copy; Google Satellite Hybrid',
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
    })
  } else if (mode === 'landuse') {
    layer = L.tileLayer(OSM_LANDUSE_URL, {
      attribution: OSM_ATTRIBUTION,
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19,
    })
  } else {
    layer = L.tileLayer(CARTO_VOYAGER_URL, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
    })
  }

  let errorCount = 0
  let fallbackTriggered = false
  layer.on('tileerror', () => {
    errorCount += 1
    if (fallbackTriggered || errorCount < 4 || !map.hasLayer(layer)) return
    fallbackTriggered = true
    map.removeLayer(layer)
    const fallback = L.tileLayer(FALLBACK_CARTO_VOYAGER_URL, {
      attribution: FALLBACK_CARTO_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)
    if (typeof onLayerReplaced === 'function') {
      onLayerReplaced(fallback)
    }
  })

  return layer.addTo(map)
}

/**
 * Tạo lớp WMS ranh giới hành chính (Tỉnh/TP và Phường/Xã) từ dịch vụ bản đồ địa giới Việt Nam.
 */
export function createAdminBoundaryWmsLayer(L) {
  if (!L) return null
  return L.tileLayer.wms(ADMIN_WMS_URL, {
    layers: 'bando',
    map: ADMIN_WMS_MAP_PATH,
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    opacity: 0.78,
    maxZoom: 20,
    zIndex: 350,
  })
}

/**
 * Tải GeoJSON ranh giới hành chính theo mã tỉnh hoặc mã phường/xã và vẽ lên layerGroup.
 */
export async function fetchAndRenderAdminBoundary(L, map, layerGroup, code, options = {}) {
  if (!L || !layerGroup || !code) return null
  const response = await fetch(`${API.CLASSIFY_ADMIN_BOUNDARY}/${encodeURIComponent(code)}/boundary`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP_${response.status}`)
  }
  const data = await response.json()
  if (!data.featureCollection) throw new Error('Ranh giới không hợp lệ')

  layerGroup.clearLayers()
  const layer = L.geoJSON(data.featureCollection, {
    style: {
      color: options.color || '#15803d',
      weight: options.weight || 2.8,
      opacity: 0.95,
      fillColor: options.fillColor || '#16a34a',
      fillOpacity: options.fillOpacity ?? 0.12,
    },
  })
  layerGroup.addLayer(layer)
  const bounds = layer.getBounds()
  if (map && options.fitBounds !== false && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: options.maxZoom || 14 })
  }
  return { layer, bounds, data }
}

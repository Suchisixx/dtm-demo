import { createApp } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import './assets/css/styles.css'
import App from './App.vue'

// Gắn Leaflet lên window trước khi nạp plugin markercluster để giữ tương thích cho MapTab/ClassifyTab
if (typeof window !== 'undefined') {
  window.L = L
}
import('leaflet.markercluster').finally(() => {
  createApp(App).mount('#app')
})

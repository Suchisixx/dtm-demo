// frontend/src/composables/useAdministrativeDivisions.js
import { shallowRef, ref, onMounted } from 'vue';

const divisions = shallowRef([]);
const isLoaded = ref(false);
let loadPromise = null;

export function loadDivisions() {
  if (isLoaded.value && divisions.value.length > 0) {
    return Promise.resolve(divisions.value);
  }
  if (!loadPromise) {
    loadPromise = import('../data/vietnam-divisions.json')
      .then(m => {
        divisions.value = m.default || m;
        isLoaded.value = true;
        return divisions.value;
      })
      .catch(err => {
        console.error('Lỗi nạp danh mục địa giới hành chính:', err);
        return [];
      });
  }
  return loadPromise;
}

export function useAdministrativeDivisions() {
  onMounted(() => {
    if (!isLoaded.value) {
      loadDivisions();
    }
  });

  return {
    divisions,
    isLoaded,
    loadDivisions
  };
}

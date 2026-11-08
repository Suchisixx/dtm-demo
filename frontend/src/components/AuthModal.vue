<script setup>
import { ref } from 'vue'
import { API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'

const emit = defineEmits(['login-success', 'close'])

const username = ref('')
const password = ref('')
const errorMsg = ref('')

const handleLogin = async () => {
  errorMsg.value = ''
  try {
    const res = await fetch(API.AUTH_LOGIN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    })

    const data = await res.json()
    if (res.ok && (data.user || data.success)) {
      emit('login-success', data.user)
      username.value = ''
      password.value = ''
    } else {
      errorMsg.value = data.error || data.message || 'Tên đăng nhập hoặc mật khẩu không đúng.'
    }
  } catch (err) {
    logger.error('Lỗi đăng nhập:', err)
    errorMsg.value = 'Không thể kết nối đến máy chủ.'
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card fade-up">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="kpi-icon" style="width:32px;height:32px;font-size:16px">
            <i class="ti ti-shield-lock"></i>
          </div>
          <div>
            <h3 style="font-size:16px;font-weight:600;color:var(--text);margin:0;line-height:1.3">Đăng nhập hệ thống</h3>
            <div style="font-size:12px;color:var(--text3)">ETC LegalHub Workspace</div>
          </div>
        </div>
        <button type="button" class="drawer-close-btn" @click="emit('close')" aria-label="Đóng">
          <i class="ti ti-x"></i>
        </button>
      </div>

      <form @submit.prevent="handleLogin" id="login-form">
        <div class="form-group">
          <label class="form-label">Tên đăng nhập</label>
          <input type="text" v-model="username" placeholder="Nhập tên đăng nhập..." required />
        </div>
        <div class="form-group">
          <label class="form-label">Mật khẩu</label>
          <input type="password" v-model="password" placeholder="Nhập mật khẩu..." required />
        </div>
        <div v-if="errorMsg" style="color:var(--red);background:var(--red-bg);border:1px solid var(--danger-border);padding:8px 12px;border-radius:var(--radius);font-size:12.5px;margin-bottom:14px;display:flex;align-items:center;gap:6px">
          <i class="ti ti-alert-circle"></i>
          <span>{{ errorMsg }}</span>
        </div>
        <button type="submit" class="btn-classify" style="width:100%;margin-top:4px">
          <i class="ti ti-login"></i>
          <span>Đăng nhập</span>
        </button>
      </form>
    </div>
  </div>
</template>

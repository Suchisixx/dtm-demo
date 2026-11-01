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
  <div class="modal-overlay">
    <div class="modal-card fade-up">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-family:'Playfair Display',serif;font-size:20px;color:var(--accent);margin:0">Đăng nhập hệ thống</h3>
        <button @click="emit('close')"
          style="background:transparent;border:none;font-size:24px;cursor:pointer;color:var(--text3);line-height:1">&times;</button>
      </div>
      <form @submit.prevent="handleLogin" id="login-form">
        <div class="form-group">
          <label class="form-label">Tên đăng nhập</label>
          <input type="text" v-model="username" placeholder="Nhập tên đăng nhập..." required />
        </div>
        <div class="form-group">
          <label class="form-label">Mật khẩu</label>
          <input type="password" v-model="password" placeholder="Nhập mật khẩu..." required
            style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;color:var(--text);background:var(--surface)" />
        </div>
        <div v-if="errorMsg" style="color:var(--red);font-size:13px;margin-bottom:12px;">{{ errorMsg }}</div>
        <button type="submit" class="btn-classify" style="margin-top:8px">Đăng nhập</button>
      </form>
    </div>
  </div>
</template>

<template>
  <main class="login-page">
    <canvas ref="canvas" id="matrix-canvas"></canvas>
    <section class="login-panel">
      <div class="brand login-brand">
        <img class="brand-logo" src="/assets/coma-logo.png" alt="COM&A" />
        <div class="brand-text">
          <strong>COM&A</strong>
          <small>Ingreso al sistema</small>
        </div>
      </div>
      <form class="login-form" @submit.prevent="handleLogin">
        <label>
          <span>Usuario</span>
          <input v-model="username" name="username" autocomplete="username" placeholder="admin" />
        </label>
        <label>
          <span>Contrasena</span>
          <input v-model="password" name="password" type="password" autocomplete="current-password" placeholder="admin123" />
        </label>
        <button class="primary" :disabled="loading">{{ loading ? 'Ingresando...' : 'Ingresar' }}</button>
        <p class="error-text">{{ error }}</p>
      </form>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const canvas = ref(null)

let animationId = null

function homeRoute() {
  return auth.role === 'operador' ? '/blocks' : '/'
}

onMounted(() => {
  if (auth.isLoggedIn) {
    router.push(homeRoute())
    return
  }
  initMatrix()
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
})

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    router.push(homeRoute())
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function initMatrix() {
  const cvs = canvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')

  function resize() {
    cvs.width = window.innerWidth
    cvs.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  const chars = '0101010101010101ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$*+-/=%'.split('')
  const specialWords = ['COM&A', 'COTAP', 'EMC=2']
  const fontSize = 16
  const columnsCount = Math.floor(cvs.width / fontSize) + 1
  const columns = Array.from({ length: columnsCount }, () => ({ y: Math.floor(Math.random() * -100), wordQueue: [] }))

  let frameCount = 0
  function draw() {
    frameCount++
    if (frameCount % 4 === 0) {
      ctx.fillStyle = 'rgba(10, 22, 40, 0.06)'
      ctx.fillRect(0, 0, cvs.width, cvs.height)

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]
        const x = i * fontSize
        const y = col.y * fontSize

        if (y >= 0) {
          let text = ''
          let isSpecial = false
          if (col.wordQueue.length > 0) {
            text = col.wordQueue.shift()
            isSpecial = true
          } else {
            text = chars[Math.floor(Math.random() * chars.length)]
          }

          ctx.fillStyle = isSpecial ? '#ffffff' : (Math.random() > 0.985 ? '#ffffff' : '#5eead4')
          ctx.font = isSpecial ? `bold ${fontSize}px monospace` : `${fontSize}px monospace`
          ctx.fillText(text, x, y)
        }

        if (y > cvs.height && Math.random() > 0.975) {
          col.y = 0
          if (Math.random() > 0.8) {
            col.wordQueue = specialWords[Math.floor(Math.random() * specialWords.length)].split('')
          }
        }
        col.y++
      }
    }
    animationId = requestAnimationFrame(draw)
  }
  animationId = requestAnimationFrame(draw)
}
</script>

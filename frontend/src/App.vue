<template>
  <div class="app-layout" v-if="auth.isLoggedIn" :data-theme="theme">
    <AppTopbar @toggle="toggleSidebar" />
    <div class="app-body">
      <AppSidebar ref="sidebarRef" />
      <main class="main">
        <router-view />
      </main>
    </div>
  </div>
  <router-view v-else />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useRouter } from 'vue-router'
import { useTheme } from './composables/useTheme'
import AppSidebar from './components/AppSidebar.vue'
import AppTopbar from './components/AppTopbar.vue'

const auth = useAuthStore()
const router = useRouter()
const sidebarRef = ref(null)
const { theme } = useTheme()

function toggleSidebar() {
  sidebarRef.value?.toggle()
}

onMounted(() => {
  if (auth.isLoggedIn && router.currentRoute.value.path === '/') {
    return
  }
  if (!auth.isLoggedIn) {
    router.push('/login')
  }
})
</script>

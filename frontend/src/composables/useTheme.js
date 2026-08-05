import { ref, watch } from 'vue'

const theme = ref(localStorage.getItem('theme') || 'dark')

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

if (!localStorage.getItem('theme')) {
  theme.value = prefersDark.matches ? 'dark' : 'light'
}

function applyTheme(val) {
  document.documentElement.setAttribute('data-theme', val)
}

applyTheme(theme.value)

watch(theme, (val) => {
  localStorage.setItem('theme', val)
  applyTheme(val)
})

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggle }
}

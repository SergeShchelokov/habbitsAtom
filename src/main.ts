import '@fontsource-variable/roboto'
import './style.css'
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) })
}

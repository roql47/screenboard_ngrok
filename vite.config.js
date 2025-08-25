import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // 절대 경로로 정적 자산 로드
  server: {
    host: '0.0.0.0', // 모든 IP에서 접근 허용
    port: 5173,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '4a2021e0c8f0.ngrok-free.app', // 현재 ngrok URL 추가
      '.ngrok-free.app',  // 모든 ngrok 무료 도메인 허용
      '.ngrok.io',        // 모든 ngrok 도메인 허용
      'all'               // 모든 호스트 허용
    ],
    // CSS 및 정적 자산 캐시 설정
    headers: {
      'Cache-Control': 'public, max-age=0'
    }
  },
  // 빌드 시 CSS 최적화 설정
  css: {
    devSourcemap: true
  }
})


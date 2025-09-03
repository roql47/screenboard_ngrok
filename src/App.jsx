import React, { useState, useEffect } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import HospitalBoard from './components/HospitalBoard'
import Login from './components/Login'
import socketManager, { login, verifyToken } from './utils/socket'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)

  // 앱 시작 시 토큰 검증
  useEffect(() => {
    checkAuthentication()
  }, [])

  // 인증된 후 소켓 연결 (지연 추가)
  useEffect(() => {
    if (isAuthenticated) {
      console.log('🔐 인증 완료 - 소켓 연결 준비')
      
      // 약간의 지연 후 소켓 연결 (UI 렌더링 완료 후)
      const connectTimer = setTimeout(() => {
        console.log('🔌 소켓 연결 시작')
        try {
          socketManager.connect()
          console.log('✅ 소켓 연결 요청 완료')
        } catch (error) {
          console.error('❌ 소켓 연결 오류:', error)
        }
      }, 500) // 500ms 지연
      
      return () => {
        clearTimeout(connectTimer)
        console.log('🔌 소켓 연결 해제')
        socketManager.disconnect()
      }
    }
  }, [isAuthenticated])

  // 저장된 토큰으로 인증 상태 확인
  const checkAuthentication = async () => {
    try {
      const token = localStorage.getItem('hospital_auth_token')
      
      if (!token) {
        console.log('🔍 저장된 토큰 없음')
        setIsLoading(false)
        return
      }

      console.log('🔍 저장된 토큰 검증 중...')
      const result = await verifyToken(token)
      
      if (result.success) {
        console.log('✅ 토큰 검증 성공:', result.user)
        setUser(result.user)
        setIsAuthenticated(true)
      } else {
        console.log('❌ 토큰 검증 실패')
        localStorage.removeItem('hospital_auth_token')
      }
    } catch (error) {
      console.log('❌ 토큰 검증 오류:', error.message)
      localStorage.removeItem('hospital_auth_token')
    } finally {
      setIsLoading(false)
    }
  }

  // 로그인 처리
  const handleLogin = async (credentials) => {
    setLoginLoading(true)
    
    try {
      console.log('🔐 로그인 시도:', credentials.username)
      const result = await login(credentials)
      
      if (result.success) {
        console.log('✅ 로그인 성공:', result.user)
        
        // 토큰 저장
        localStorage.setItem('hospital_auth_token', result.token)
        
        // 상태 업데이트
        setUser(result.user)
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.error('❌ 로그인 실패:', error.message)
      throw error // Login 컴포넌트에서 에러 처리
    } finally {
      setLoginLoading(false)
    }
  }

  // 로그아웃 처리
  const handleLogout = () => {
    console.log('🔓 로그아웃')
    localStorage.removeItem('hospital_auth_token')
    setUser(null)
    setIsAuthenticated(false)
    socketManager.disconnect()
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">시스템 로딩 중...</p>
        </div>
      </div>
    )
  }

  // 인증되지 않은 경우 로그인 화면
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} isLoading={loginLoading} />
  }

  // 인증된 경우 메인 화면
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
        {/* 디버깅용 로그 */}
        {console.log('🎯 메인 화면 렌더링:', { isAuthenticated, user })}
        
        <HospitalBoard user={user} onLogout={handleLogout} />
      </div>
    </DndProvider>
  )
}

export default App

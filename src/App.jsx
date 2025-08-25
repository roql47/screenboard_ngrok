import React, { useState, useEffect } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import HospitalBoard from './components/HospitalBoard'
import socketManager from './utils/socket'
import './App.css'

function App() {
  useEffect(() => {
    // 앱이 시작될 때 소켓 연결
    socketManager.connect();
    
    return () => {
      // 앱이 종료될 때 소켓 연결 해제
      socketManager.disconnect();
    };
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <HospitalBoard />
      </div>
    </DndProvider>
  )
}

export default App

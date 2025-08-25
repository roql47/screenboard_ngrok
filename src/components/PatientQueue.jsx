import React, { useState } from 'react'
import { Clock, User, Stethoscope, Edit3, Check, X, Plus, Trash2 } from 'lucide-react'

const PatientQueue = ({ patients, roomTitle, isAdminMode, isPrivacyMode, onUpdatePatientName, onUpdatePatientNumber, onUpdatePatientStatus, onUpdatePatientProcedure, onUpdatePatientDoctor, onAddPatient, onDeletePatient, onMovePatientToRoom }) => {
  const [editingPatient, setEditingPatient] = useState(null)
  const [editValues, setEditValues] = useState({ name: '', number: '', procedure: '', doctor: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPatient, setNewPatient] = useState({
    number: '',
    name: '',
    procedure: '', // 시술명
    doctor: '', // 담당의사
    status: 'waiting'
  })

  // 드롭 기능 설정
  // 네이티브 드래그 앤 드롭 상태
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedPatient, setDraggedPatient] = useState(null)

  // 네이티브 드래그 앤 드롭 이벤트 핸들러
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
    console.log('🎯 드래그 오버:', roomTitle)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    console.log('👋 드래그 떠남:', roomTitle)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const patientData = e.dataTransfer.getData('application/json')
    console.log('📍 드롭 데이터:', patientData)
    
    try {
      const patient = JSON.parse(patientData)
      console.log('📍 드롭 시도:', patient.patientName, 'from', patient.currentRoom, '→', roomTitle)
      
      if (patient.currentRoom !== roomTitle) {
        console.log('✅ 환자 방 이동 실행:', patient.patientId, '→', roomTitle)
        onMovePatientToRoom(patient.patientId, roomTitle)
      } else {
        console.log('⚠️ 같은 방으로 이동 시도 - 무시')
      }
    } catch (error) {
      console.error('❌ 드롭 데이터 파싱 오류:', error)
    }
  }
  const getStatusColor = (status) => {
    switch (status) {
      case 'procedure':
        return 'bg-orange-900/30 border-orange-500 text-orange-200'
      case 'waiting':
        return 'bg-blue-900/30 border-blue-500 text-blue-200'
      case 'completed':
        return 'bg-gray-800/30 border-gray-500 text-gray-400'
      default:
        return 'bg-gray-800/30 border-gray-500 text-gray-300'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'procedure':
        return '시술중'
      case 'waiting':
        return '대기중'
      case 'completed':
        return '완료'
      default:
        return '대기중'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'procedure':
        return <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
      case 'waiting':
        return <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
      case 'completed':
        return <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
    }
  }

  // 편집 시작
  const startEdit = (patient) => {
    setEditingPatient(patient.id)
    setEditValues({ 
      name: patient.patient_name || patient.name || '', 
      number: patient.patient_id || patient.number || '',
      procedure: patient.procedure || patient.assigned_doctor || '',
      doctor: patient.doctor || ''
    })
  }

  // 편집 저장
  const saveEdit = () => {
    if (editValues.name.trim()) {
      onUpdatePatientName(editingPatient, editValues.name.trim())
    }
    if (editValues.number.trim()) {
      onUpdatePatientNumber(editingPatient, editValues.number.trim())
    }
    if (editValues.procedure.trim()) {
      onUpdatePatientProcedure(editingPatient, editValues.procedure.trim())
    }
    if (editValues.doctor.trim()) {
      onUpdatePatientDoctor(editingPatient, editValues.doctor.trim())
    }
    setEditingPatient(null)
    setEditValues({ name: '', number: '', procedure: '', doctor: '' })
  }

  // 편집 취소
  const cancelEdit = () => {
    setEditingPatient(null)
    setEditValues({ name: '', number: '', procedure: '', doctor: '' })
  }

  // 상태 변경
  const handleStatusChange = (patientId, newStatus) => {
    onUpdatePatientStatus(patientId, newStatus)
  }

  // 환자 추가 폼 표시/숨기기
  const toggleAddForm = () => {
    setShowAddForm(!showAddForm)
    setNewPatient({
      number: '',
      name: '',
      procedure: '',
      doctor: '',
      status: 'waiting'
    })
  }

  // 새 환자 추가
  const handleAddPatient = () => {
    if (newPatient.number.trim() && newPatient.name.trim() && newPatient.procedure.trim()) {
      onAddPatient({
        ...newPatient,
        room: roomTitle,
        department: roomTitle
      })
      toggleAddForm()
    }
  }

  // 환자 삭제
  const handleDeletePatient = (patientId) => {
    if (window.confirm('정말로 이 환자를 삭제하시겠습니까?')) {
      onDeletePatient(patientId)
    }
  }

  // 개인정보 마스킹 함수
  const maskPersonalInfo = (text, type = 'name') => {
    if (!isPrivacyMode || !text) return text || '' // null/undefined 체크 추가
    
    if (type === 'name') {
      // 이름 마스킹: 첫 글자만 보이고 나머지는 **
      if (text.length <= 1) return text
      return text.charAt(0) + '**'
    } else if (type === 'number') {
      // 등록번호 마스킹: 앞 2자리만 보이고 나머지는 **
      if (text.length <= 2) return text
      return text.substring(0, 2) + '**'
    }
    
    return text
  }

  return (
    <div 
      data-room={roomTitle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-black/40 backdrop-blur-md rounded-2xl p-6 board-shadow border-2 transition-all duration-300 ${
        isDragOver ? 'border-green-400 bg-green-900/30 shadow-lg shadow-green-400/20' : 'border-gray-700'
      }`}
    >
      <div className="flex items-center gap-3 mb-6">
        <User className="w-8 h-8 text-blue-400" />
        <h2 className="text-3xl font-bold text-white">{roomTitle}</h2>
        {isDragOver && (
          <div className="text-green-400 text-sm font-medium animate-pulse">
            🏠 환자를 여기로 이동
          </div>
        )}
      </div>

      <div className="space-y-3">
        {patients
          .sort((a, b) => {
            // 시술중이 맨 위
            if (a.status === 'procedure' && b.status !== 'procedure') return -1
            if (b.status === 'procedure' && a.status !== 'procedure') return 1
            // 그 다음 대기중
            if (a.status === 'waiting' && b.status === 'completed') return -1
            if (b.status === 'waiting' && a.status === 'completed') return 1
            // 같은 상태끼리는 ID 순서
            return a.id - b.id
          })
          .map((patient) => {
            // 각 환자 카드에 네이티브 드래그 기능 추가
            const DraggablePatientCard = () => {
              const [isDragging, setIsDragging] = useState(false)

              // 터치 상태 관리
              const [touchStartPos, setTouchStartPos] = useState(null)
              const [touchCurrentPos, setTouchCurrentPos] = useState(null)

              // 네이티브 드래그 이벤트 핸들러 (마우스용)
              const handleDragStart = (e) => {
                if (isAdminMode) {
                  e.preventDefault()
                  console.log('❌ 관리자 모드에서는 드래그 불가')
                  return
                }
                
                setIsDragging(true)
                console.log('🚀🚀🚀 네이티브 드래그 시작!', patient.patient_name || patient.name, 'from', patient.department || patient.room)
                
                const patientData = {
                  patientId: patient.id,
                  currentRoom: patient.department || patient.room,
                  patientName: patient.patient_name || patient.name,
                }
                
                e.dataTransfer.setData('application/json', JSON.stringify(patientData))
                e.dataTransfer.effectAllowed = 'move'
                console.log('📦 드래그 데이터 설정 완료:', patientData)
              }

              const handleDragEnd = (e) => {
                setIsDragging(false)
                console.log('🏁 네이티브 드래그 종료:', patient.patient_name || patient.name)
              }

              // 터치 이벤트 핸들러 (터치스크린용)
              const handleTouchStart = (e) => {
                if (isAdminMode) {
                  console.log('❌ 관리자 모드에서는 터치 드래그 불가')
                  return
                }
                
                const touch = e.touches[0]
                setTouchStartPos({ x: touch.clientX, y: touch.clientY })
                console.log('👆 터치 시작:', patient.patient_name || patient.name, 'at', touch.clientX, touch.clientY)
              }

              const handleTouchMove = (e) => {
                if (isAdminMode || !touchStartPos) return
                
                e.preventDefault() // 스크롤 방지
                const touch = e.touches[0]
                setTouchCurrentPos({ x: touch.clientX, y: touch.clientY })
                
                // 드래그 거리 계산
                const deltaX = Math.abs(touch.clientX - touchStartPos.x)
                const deltaY = Math.abs(touch.clientY - touchStartPos.y)
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
                
                // 일정 거리 이상 움직이면 드래그 시작
                if (distance > 10 && !isDragging) {
                  setIsDragging(true)
                  console.log('🚀👆 터치 드래그 시작!', patient.patient_name || patient.name)
                }
                
                console.log('👆 터치 이동:', touch.clientX, touch.clientY, 'distance:', distance)
              }

              const handleTouchEnd = (e) => {
                if (isAdminMode || !touchStartPos) return
                
                console.log('🏁👆 터치 종료:', patient.patient_name || patient.name)
                
                if (isDragging && touchCurrentPos) {
                  // 터치 종료 위치에서 드롭존 찾기
                  const elementBelow = document.elementFromPoint(touchCurrentPos.x, touchCurrentPos.y)
                  console.log('🎯 터치 종료 위치의 요소:', elementBelow)
                  
                  // 드롭존 찾기 (부모 요소들을 순회)
                  let dropZone = elementBelow
                  while (dropZone && !dropZone.hasAttribute('data-room')) {
                    dropZone = dropZone.parentElement
                  }
                  
                  if (dropZone) {
                    const targetRoom = dropZone.getAttribute('data-room')
                    const currentRoom = patient.department || patient.room
                    
                    console.log('📍 터치 드롭:', patient.patient_name || patient.name, 'from', currentRoom, '→', targetRoom)
                    
                    if (currentRoom !== targetRoom) {
                      console.log('✅ 터치로 환자 방 이동 실행:', patient.id, '→', targetRoom)
                      onMovePatientToRoom(patient.id, targetRoom)
                    } else {
                      console.log('⚠️ 같은 방으로 터치 이동 시도 - 무시')
                    }
                  }
                }
                
                // 상태 초기화
                setIsDragging(false)
                setTouchStartPos(null)
                setTouchCurrentPos(null)
              }

              return (
                <div
                  draggable={!isAdminMode}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className={`
                    relative p-4 rounded-xl border-2 transition-all duration-300 
                    ${!isAdminMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
                    ${getStatusColor(patient.status)}
                    ${patient.status === 'procedure' ? 'animate-pulse scale-105' : ''}
                    ${patient.status === 'completed' ? 'opacity-60' : ''}
                    ${isDragging ? 'opacity-50 scale-110 rotate-3 shadow-2xl border-yellow-400 bg-yellow-900/20 z-50' : 'hover:shadow-lg hover:scale-102'}
                  `}
                  style={{ 
                    opacity: isDragging ? 0.5 : 1,
                    transform: isDragging ? 'rotate(8deg) scale(1.1)' : 'none',
                    zIndex: isDragging ? 9999 : 'auto'
                  }}
                  title={isDragging ? '드래그 중... 다른 방에 놓으세요!' : (!isAdminMode ? '드래그해서 다른 방으로 이동' : '관리자 모드에서는 드래그 불가')}
                >

                  
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(patient.status)}
                  
                  <div className="flex-1 min-w-0">
                    {editingPatient === patient.id ? (
                      // 편집 모드
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editValues.number}
                            onChange={(e) => setEditValues(prev => ({ ...prev, number: e.target.value }))}
                            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm font-bold digital-font"
                            placeholder="등록번호"
                          />
                          <input
                            type="text"
                            value={editValues.name}
                            onChange={(e) => setEditValues(prev => ({ ...prev, name: e.target.value }))}
                            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                            placeholder="환자명"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editValues.procedure}
                            onChange={(e) => setEditValues(prev => ({ ...prev, procedure: e.target.value }))}
                            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                            placeholder="시술명"
                          />
                          <input
                            type="text"
                            value={editValues.doctor}
                            onChange={(e) => setEditValues(prev => ({ ...prev, doctor: e.target.value }))}
                            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                            placeholder="담당의사"
                          />
                        </div>
                      </div>
                    ) : (
                      // 일반 표시 모드
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xl font-bold digital-font text-white">
                            {maskPersonalInfo(patient.patient_id || patient.number, 'number')}
                          </div>
                          <div className="text-base opacity-75 text-gray-300">
                            {maskPersonalInfo(patient.patient_name || patient.name, 'name')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-gray-400" />
                          <div>
                            {(patient.procedure || patient.assigned_doctor) && (
                              <div className="text-base font-medium text-white">{patient.procedure || patient.assigned_doctor || ''}</div>
                            )}
                            {patient.doctor && (
                              <div className="text-sm opacity-75 text-gray-400">{patient.doctor}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0" style={{ pointerEvents: isAdminMode ? 'auto' : 'none' }}>
                  {/* 상태 표시/변경 */}
                  <div className="flex items-center gap-2">
                    {isAdminMode ? (
                      <select
                        value={patient.status}
                        onChange={(e) => handleStatusChange(patient.id, e.target.value)}
                        className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs pointer-events-auto"
                      >
                        <option value="waiting">대기중</option>
                        <option value="procedure">시술중</option>
                        <option value="completed">완료</option>
                      </select>
                    ) : (
                      <div className={`
                        px-2 py-1 rounded-full text-xs font-semibold
                        ${patient.status === 'procedure' ? 'bg-orange-600 text-white' : 
                          patient.status === 'completed' ? 'bg-gray-600/40 text-gray-300' : 
                          'bg-blue-600/40 text-blue-200'}
                      `}>
                        {getStatusText(patient.status)}
                      </div>
                    )}
                    
                    {/* 편집 버튼 */}
                    {isAdminMode && (
                      <div className="flex gap-1">
                        {editingPatient === patient.id ? (
                          <>
                            <button
                              onClick={saveEdit}
                              className="p-1 bg-green-600/20 border border-green-500 rounded text-green-300 hover:bg-green-600/30 pointer-events-auto"
                              title="저장"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 bg-red-600/20 border border-red-500 rounded text-red-300 hover:bg-red-600/30 pointer-events-auto"
                              title="취소"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(patient)}
                              className="p-1 bg-gray-600/20 border border-gray-500 rounded text-gray-300 hover:bg-gray-600/30 pointer-events-auto"
                              title="편집"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeletePatient(patient.id)}
                              className="p-1 bg-red-600/20 border border-red-500 rounded text-red-300 hover:bg-red-600/30 pointer-events-auto"
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 시술 시간 */}
                  {patient.status === 'procedure' && (
                    <div className="flex items-center gap-1 text-sm text-orange-400">
                      <Clock className="w-4 h-4" />
                      <span>{patient.wait_time || patient.waitTime || 0}분</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )
          }
          
          return <DraggablePatientCard key={patient.id} />
        })}

        {/* 환자 추가 버튼 및 폼 */}
        {isAdminMode && (
          <div className="mt-4">
            {!showAddForm ? (
              <button
                onClick={toggleAddForm}
                className="w-full p-4 bg-green-900/20 border-2 border-dashed border-green-700/50 rounded-xl text-green-300 hover:bg-green-800/30 hover:border-green-600/70 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>환자 추가</span>
              </button>
            ) : (
              <div className="p-4 bg-green-900/20 border-2 border-green-700/50 rounded-xl">
                <h4 className="text-green-300 font-semibold mb-3">새 환자 추가</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="등록번호 (예: A001)"
                      value={newPatient.number}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, number: e.target.value }))}
                      className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      placeholder="환자명"
                      value={newPatient.name}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, name: e.target.value }))}
                      className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="시술명 (예: Angio 1, PCI, Ablation)"
                      value={newPatient.procedure}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, procedure: e.target.value }))}
                      className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      placeholder="담당의사"
                      value={newPatient.doctor}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, doctor: e.target.value }))}
                      className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <select
                      value={newPatient.status}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, status: e.target.value }))}
                      className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="waiting">대기중</option>
                      <option value="procedure">시술중</option>
                      <option value="completed">완료</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddPatient}
                      className="flex-1 px-4 py-2 bg-green-600/20 border border-green-500 rounded text-green-300 hover:bg-green-600/30 transition-colors"
                    >
                      추가
                    </button>
                    <button
                      onClick={toggleAddForm}
                      className="flex-1 px-4 py-2 bg-gray-600/20 border border-gray-500 rounded text-gray-300 hover:bg-gray-600/30 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PatientQueue

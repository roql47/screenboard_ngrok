import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Clock, User, Stethoscope, Edit3, Check, X, Plus, Trash2 } from 'lucide-react'

const PatientQueue = React.memo(({ patients, roomTitle, selectedDate, isAdminMode, isPrivacyMode, isDarkMode, onUpdatePatientName, onUpdatePatientNumber, onUpdatePatientStatus, onUpdatePatientProcedure, onUpdatePatientDoctor, onUpdatePatientNotes, onUpdatePatientGenderAge, onUpdatePatientWard, onUpdatePatientDate, onAddPatient, onDeletePatient, onMovePatientToRoom, onReorderPatients, onEditingPatientChange }) => {
  
  // 환자 데이터 변경 감지
  useEffect(() => {
    // 로그 제거됨
  }, [patients, roomTitle])
  const [editingPatient, setEditingPatient] = useState(null)
  const [editValues, setEditValues] = useState({ name: '', number: '', procedure: '', doctor: '', notes: '', genderAge: '', ward: '', date: '' })
  
  // 입력 필드 ref 추가 (포커스 유지용)
  const inputRefs = useRef({})
  
  // 포커스 관련 상태 완전 제거
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPatient, setNewPatient] = useState({
    number: '',
    name: '',
    procedure: '', // 시술명
    doctor: '', // 담당의사
    notes: '', // 비고
    genderAge: '', // 성별/나이
    ward: '', // 병동
    status: 'waiting'
  })

  // 드롭 기능 설정
  // 네이티브 드래그 앤 드롭 상태
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedPatient, setDraggedPatient] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  
  // 터치 드래그 전역 상태
  const [globalTouchDragging, setGlobalTouchDragging] = useState(false)
  
  // 터치 이벤트 throttling을 위한 ref
  const touchThrottleRef = useRef(null)

  // 관리자 모드 변경 시 편집 상태 초기화
  useEffect(() => {
    if (!isAdminMode && editingPatient) {
      setEditingPatient(null)
      setEditValues({ name: '', number: '', procedure: '', doctor: '', notes: '', genderAge: '', ward: '' })
      setShowAddForm(false)
    }
  }, [isAdminMode, editingPatient])

  // 터치 이벤트 최적화 (삼성 칠판용)
  useEffect(() => {
    // 터치 이벤트 passive 설정으로 성능 향상
    const handleTouchMove = (e) => {
      if (globalTouchDragging) {
        e.preventDefault()
      }
    }

    // 전역 터치 이벤트 리스너 추가 (passive: false로 preventDefault 가능하게)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMove)
    }
  }, [globalTouchDragging])

  // 새로 추가된 환자 표시를 위한 상태
  const [currentTime, setCurrentTime] = useState(Date.now())

  // 1분마다 현재 시간 업데이트 (새로 추가됨 표시 실시간 반영)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000) // 1분마다 업데이트

    return () => clearInterval(timer)
  }, [])

  // 환자가 새로 추가된지 5분 이내인지 확인하는 함수
  const isNewlyAdded = (patient) => {
    const addedTime = patient.added_at || patient.addedAt // 두 필드명 모두 지원
    if (!addedTime) return false
    
    const fiveMinutes = 5 * 60 * 1000 // 5분을 밀리초로 변환
    const timeDiff = currentTime - addedTime
    return timeDiff < fiveMinutes
  }

  // 네이티브 드래그 앤 드롭 이벤트 핸들러
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const patientData = e.dataTransfer.getData('application/json')
    
    try {
      const patient = JSON.parse(patientData)
      
      if (patient.currentRoom !== roomTitle) {
        onMovePatientToRoom(patient.patientId, roomTitle)
      } else if (patient.isInternalReorder && dragOverIndex !== null && dragOverIndex !== patient.currentIndex) {
        handleInternalReorder(patient.patientId, patient.currentIndex, dragOverIndex)
      }
    } catch (error) {
      console.error('❌ 드롭 데이터 파싱 오류:', error)
    }
    
    setDragOverIndex(null)
  }

  // 같은 방 내 환자 순서 변경 처리
  const handleInternalReorder = (patientId, fromIndex, toIndex) => {
    
    const roomPatients = patients.filter(p => p.department === roomTitle || p.room === roomTitle)
    const sortedPatients = roomPatients.sort((a, b) => {
      if (a.display_order && b.display_order) {
        return a.display_order - b.display_order
      }
      return a.id - b.id
    })
    
    if (fromIndex >= sortedPatients.length || toIndex > sortedPatients.length || fromIndex < 0 || toIndex < 0) {
      console.error('❌ 잘못된 인덱스:', fromIndex, toIndex)
      return
    }
    
    // 새로운 순서로 환자 배열 재정렬
    const reorderedPatients = [...sortedPatients]
    const [movedPatient] = reorderedPatients.splice(fromIndex, 1)
    reorderedPatients.splice(toIndex, 0, movedPatient)
    
    // 서버로 순서 업데이트 전송
    const patientOrders = reorderedPatients.map((patient, index) => ({
      patientId: patient.id,
      newOrder: index + 1
    }))
    
    onReorderPatients(patientOrders)
  }

  const getStatusColor = (status) => {
    const baseClasses = isDarkMode 
      ? {
          procedure: 'bg-orange-900/30 border-orange-500 text-orange-200',
          waiting: 'bg-blue-900/30 border-blue-500 text-blue-200',
          completed: 'bg-gray-800/30 border-gray-500 text-gray-400',
          default: 'bg-gray-800/30 border-gray-500 text-gray-300'
        }
      : {
          procedure: 'bg-orange-50 border-orange-300 text-black',
          waiting: 'bg-blue-50 border-blue-300 text-black',
          completed: 'bg-gray-100 border-gray-300 text-black',
          default: 'bg-gray-100 border-gray-300 text-black'
        };

    switch (status) {
      case 'procedure':
        return baseClasses.procedure
      case 'waiting':
        return baseClasses.waiting
      case 'completed':
        return baseClasses.completed
      default:
        return baseClasses.default
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

  // 병동별 색상 매핑
  const getWardColor = (ward) => {
    const wardColors = isDarkMode 
      ? {
          'ACC': 'bg-red-900/30 border border-red-600/50 text-red-200',
          'GW': 'bg-green-900/30 border border-green-600/50 text-green-200', 
          'SubCCU': 'bg-amber-900/30 border border-amber-600/50 text-amber-200',
          'CCU': 'bg-purple-900/30 border border-purple-600/50 text-purple-200',
          'ICU': 'bg-cyan-900/30 border border-cyan-600/50 text-cyan-200',
          'ER': 'bg-pink-900/30 border border-pink-600/50 text-pink-200'
        }
      : {
          'ACC': 'bg-red-50 border border-red-200 text-red-800',
          'GW': 'bg-green-50 border border-green-200 text-green-800',
          'SubCCU': 'bg-amber-50 border border-amber-200 text-amber-800', 
          'CCU': 'bg-purple-50 border border-purple-200 text-purple-800',
          'ICU': 'bg-cyan-50 border border-cyan-200 text-cyan-800',
          'ER': 'bg-pink-50 border border-pink-200 text-pink-800'
        };

    return wardColors[ward] || (isDarkMode 
      ? 'bg-gray-900/30 border border-gray-600/50 text-gray-200' 
      : 'bg-gray-50 border border-gray-200 text-gray-800');
  }

  // 편집 시작
  const startEdit = (patient) => {
    setEditingPatient(patient.id)
    setEditValues({ 
      name: patient.patient_name || patient.name || '', 
      number: patient.patient_id || patient.number || '',
      procedure: patient.procedure || patient.assigned_doctor || '',
      doctor: patient.doctor || '',
      notes: patient.notes || '',
      genderAge: patient.gender_age || '',
      ward: patient.ward || '',
      date: patient.patient_date || selectedDate || ''
    })
    // 편집 중인 환자 ID를 상위 컴포넌트에 알림
    if (onEditingPatientChange) {
      onEditingPatientChange(patient.id)
    }
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
    // 비고는 빈 값도 저장 허용 (항상 업데이트)
    onUpdatePatientNotes(editingPatient, editValues.notes)
    
    if (editValues.genderAge.trim()) {
      onUpdatePatientGenderAge(editingPatient, editValues.genderAge.trim())
    }
    if (editValues.ward.trim()) {
      onUpdatePatientWard(editingPatient, editValues.ward.trim())
    }
    if (editValues.date && editValues.date !== selectedDate) {
      onUpdatePatientDate(editingPatient, editValues.date)
    }
    
    setEditingPatient(null)
    setEditValues({ name: '', number: '', procedure: '', doctor: '', notes: '', genderAge: '', ward: '', date: '' })
    // 편집 종료를 상위 컴포넌트에 알림
    if (onEditingPatientChange) {
      onEditingPatientChange(null)
    }
  }

  // 모든 포커스 복원 로직 완전 삭제

  // 한글 조합 관련 코드 제거됨 - 단순한 onChange 방식 사용

  // 편집 중 필드별 저장 (Enter 키나 포커스 이탈 시에만)
  const saveField = useCallback((field, value) => {
    // 필수 필드들은 빈 값일 때 저장하지 않음, 비고는 빈 값 허용
    if (field !== 'notes' && !value.trim()) return;
    
    
    switch (field) {
      case 'name':
        onUpdatePatientName(editingPatient, value.trim());
        break;
      case 'number':
        onUpdatePatientNumber(editingPatient, value.trim());
        break;
      case 'procedure':
        onUpdatePatientProcedure(editingPatient, value.trim());
        break;
      case 'doctor':
        onUpdatePatientDoctor(editingPatient, value.trim());
        break;
      case 'notes':
        onUpdatePatientNotes(editingPatient, value); // 비고는 trim하지 않고 그대로 저장 (빈 값 포함)
        break;
      case 'genderAge':
        onUpdatePatientGenderAge(editingPatient, value.trim());
        break;
      case 'ward':
        onUpdatePatientWard(editingPatient, value.trim());
        break;
    }
  }, [editingPatient, onUpdatePatientName, onUpdatePatientNumber, onUpdatePatientProcedure, onUpdatePatientDoctor, onUpdatePatientNotes, onUpdatePatientGenderAge, onUpdatePatientWard])
  
  // 입력 필드 onChange 핸들러들을 메모이제이션
  const handleNumberChange = useCallback((e) => {
    setEditValues(prev => ({ ...prev, number: e.target.value }));
  }, []);
  
  const handleNameChange = useCallback((e) => {
    setEditValues(prev => ({ ...prev, name: e.target.value }));
  }, []);
  
  const handleProcedureChange = useCallback((e) => {
    setEditValues(prev => ({ ...prev, procedure: e.target.value }));
  }, []);
  
  const handleDoctorChange = useCallback((e) => {
    setEditValues(prev => ({ ...prev, doctor: e.target.value }));
  }, []);
  
  const handleNotesChange = useCallback((e) => {
    setEditValues(prev => ({ ...prev, notes: e.target.value }));
  }, []);
  
  const handleGenderAgeChange = useCallback((e) => {
    setEditValues(prev => ({ ...prev, genderAge: e.target.value }));
  }, []);
  
  const handleWardChange = useCallback((e) => {
    setEditValues(prev => ({ ...prev, ward: e.target.value }));
    // select 변경 시 즉시 저장
    if (e.target.value) {
      saveField('ward', e.target.value);
    }
  }, [saveField]);

  // 편집 취소
  const cancelEdit = () => {
    setEditingPatient(null)
    setEditValues({ name: '', number: '', procedure: '', doctor: '', notes: '', genderAge: '', ward: '' })
    // 편집 종료를 상위 컴포넌트에 알림
    if (onEditingPatientChange) {
      onEditingPatientChange(null)
    }
  }

  // 포커스 관련 함수들 완전 제거

  // 포커스 관련 함수들 완전 제거

  // 상태 변경
  const handleStatusChange = (patientId, newStatus) => {
    // 환자 정보에서 기존 시술명 찾기
    const patient = patients.find(p => p.id === patientId);
    const currentProcedure = patient?.assigned_doctor || patient?.procedure;
    
    
    // 기존 시술명을 함께 전달하여 보존
    onUpdatePatientStatus(patientId, newStatus, currentProcedure)
  }

  // 환자 추가 폼 표시/숨기기
  const toggleAddForm = () => {
    setShowAddForm(!showAddForm)
    setNewPatient({
      number: '',
      name: '',
      procedure: '',
      doctor: '',
      notes: '',
      genderAge: '',
      ward: '',
      status: 'waiting'
    })
  }

  // 새 환자 추가
  const handleAddPatient = () => {
    if (newPatient.number.trim() && newPatient.name.trim() && newPatient.procedure.trim()) {
      const patientWithTime = {
        ...newPatient,
        room: roomTitle,
        department: roomTitle,
        patient_date: selectedDate, // 선택된 날짜 추가
        addedAt: Date.now() // 추가된 시간 기록
      }
      onAddPatient(patientWithTime)
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
      className={`backdrop-blur-md rounded-2xl p-6 border-2 transition-all duration-300 ${
        isDarkMode 
          ? 'bg-black/40 border-gray-600' 
          : 'bg-white/90 border-gray-300'
      } ${
        isDragOver ? 'border-green-400 bg-green-900/30 shadow-lg shadow-green-400/20' : 'border-gray-700'
      }`}
    >
      <div className="flex items-center gap-3 mb-6">
        <User className={`w-8 h-8 transition-colors duration-300 ${
          isDarkMode ? 'text-blue-400' : 'text-blue-600'
        }`} />
        <h2 className={`text-3xl font-bold transition-colors duration-300 ${
          isDarkMode ? 'text-white' : 'text-black'
        }`}>{roomTitle}</h2>
      </div>

      <div className="space-y-2">
        {patients
          .sort((a, b) => {
            // 시술중이 항상 맨 위 (최우선)
            if (a.status === 'procedure' && b.status !== 'procedure') return -1
            if (b.status === 'procedure' && a.status !== 'procedure') return 1
            
            // 시술중끼리는 display_order 또는 ID 순서
            if (a.status === 'procedure' && b.status === 'procedure') {
              if (a.display_order && b.display_order) {
                return a.display_order - b.display_order
              }
              return a.id - b.id
            }
            
            // 시술중이 아닌 경우 기존 로직
            // display_order가 있으면 그것을 우선 사용
            if (a.display_order && b.display_order) {
              return a.display_order - b.display_order
            }
            // 그 다음 대기중
            if (a.status === 'waiting' && b.status === 'completed') return -1
            if (b.status === 'waiting' && a.status === 'completed') return 1
            // 같은 상태끼리는 ID 순서
            return a.id - b.id
          })
          .map((patient, index) => {
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
                  return
                }
                
                setIsDragging(true)
                
                const patientData = {
                  patientId: patient.id,
                  currentRoom: patient.department || patient.room,
                  patientName: patient.patient_name || patient.name,
                  currentIndex: index,
                  isInternalReorder: true // 같은 방 내 순서 변경임을 표시
                }
                
                e.dataTransfer.setData('application/json', JSON.stringify(patientData))
                e.dataTransfer.effectAllowed = 'move'
              }

              const handleDragEnd = (e) => {
                setIsDragging(false)
              }

               // 터치 이벤트 핸들러 (터치스크린용)
               const handleTouchStart = (e) => {
                 if (isAdminMode) {
                   return
                 }
                 
                 // 터치 이벤트 전파 방지 (다른 터치 핸들러와 충돌 방지)
                 e.stopPropagation()
                 
                 // 드래그 상태 초기화
                 setIsDragging(false)
                 
                 const touch = e.touches[0]
                 setTouchStartPos({ x: touch.clientX, y: touch.clientY })
                 
                 console.log('🖐️ 터치 시작:', { x: touch.clientX, y: touch.clientY })
               }

              const handleTouchMove = (e) => {
                if (isAdminMode || !touchStartPos) return
                
                // 터치 이벤트 전파 방지
                e.stopPropagation()
                
                const touch = e.touches[0]
                
                // 터치 이벤트 throttling (성능 최적화)
                if (touchThrottleRef.current) {
                  clearTimeout(touchThrottleRef.current)
                }
                
                touchThrottleRef.current = setTimeout(() => {
                  setTouchCurrentPos({ x: touch.clientX, y: touch.clientY })
                }, 16) // ~60fps
                
                // 드래그 거리 계산
                const deltaX = Math.abs(touch.clientX - touchStartPos.x)
                const deltaY = Math.abs(touch.clientY - touchStartPos.y)
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
                
                // 삼성 칠판용 드래그 시작 거리를 15px로 더 감소 (매우 민감하게)
                if (distance > 15 && !isDragging) {
                  setIsDragging(true)
                  setGlobalTouchDragging(true) // 전역 드래그 상태 업데이트
                  console.log('🚀 터치 드래그 시작:', { 
                    distance, 
                    touch: { x: touch.clientX, y: touch.clientY },
                    patient: patient.patient_name 
                  })
                  
                  // 햅틱 피드백 (지원하는 디바이스에서)
                  if (navigator.vibrate) {
                    navigator.vibrate(50)
                  }
                }
                
                // 드래그 모드일 때 스크롤 방지
                if (isDragging) {
                  e.preventDefault()
                  
                  // 터치 드래그 중 드롭존 하이라이트
                  const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY)
                  const dropZone = elementBelow?.closest('[data-drop-index]')
                  
                  if (dropZone) {
                    const dropIndex = parseInt(dropZone.getAttribute('data-drop-index'))
                    if (dropIndex !== dragOverIndex) {
                      setDragOverIndex(dropIndex)
                      console.log('🎯 드롭존 하이라이트:', dropIndex)
                    }
                  } else if (dragOverIndex !== null) {
                    setDragOverIndex(null)
                  }
                  
                  // 로그 빈도 줄이기 (throttling)
                  if (Math.random() < 0.05) { // 5%만 로그
                    console.log('👆 터치 드래그 중:', { x: touch.clientX, y: touch.clientY })
                  }
                }
                
              }

              const handleTouchEnd = (e) => {
                if (isAdminMode || !touchStartPos) return
                
                // 터치 이벤트 전파 방지
                e.stopPropagation()
                e.preventDefault()
                
                console.log('🖐️ 터치 종료:', { 
                  isDragging, 
                  touchCurrentPos, 
                  patient: patient.patient_name,
                  touchStartPos
                })
                
                if (isDragging && touchCurrentPos) {
                  // 터치 종료 위치에서 요소 찾기
                  const elementBelow = document.elementFromPoint(touchCurrentPos.x, touchCurrentPos.y)
                  console.log('🎯 터치 종료 지점 요소:', elementBelow)
                  
                  // 더 간단한 드롭 로직: 가장 가까운 방 찾기
                  let targetRoom = null
                  let attempts = 0
                  let dropZone = elementBelow
                  
                  // DOM 트리를 올라가면서 data-room 속성을 가진 요소 찾기
                  while (dropZone && !dropZone.hasAttribute('data-room') && attempts < 10) {
                    dropZone = dropZone.parentElement
                    attempts++
                  }
                  
                  if (dropZone && dropZone.hasAttribute('data-room')) {
                    targetRoom = dropZone.getAttribute('data-room')
                    console.log('🎯 찾은 타겟 방:', targetRoom)
                  } else {
                    // 방을 찾지 못한 경우, 더 정확한 위치 기반 방 결정
                    const screenWidth = window.innerWidth
                    const screenHeight = window.innerHeight
                    const x = touchCurrentPos.x
                    const y = touchCurrentPos.y
                    
                    // 모든 방 요소들의 위치를 확인
                    const roomElements = document.querySelectorAll('[data-room]')
                    let closestRoom = null
                    let closestDistance = Infinity
                    
                    roomElements.forEach(roomEl => {
                      const rect = roomEl.getBoundingClientRect()
                      const roomCenterX = rect.left + rect.width / 2
                      const roomCenterY = rect.top + rect.height / 2
                      
                      const distance = Math.sqrt(
                        Math.pow(x - roomCenterX, 2) + Math.pow(y - roomCenterY, 2)
                      )
                      
                      if (distance < closestDistance) {
                        closestDistance = distance
                        closestRoom = roomEl.getAttribute('data-room')
                      }
                    })
                    
                    if (closestRoom) {
                      targetRoom = closestRoom
                      console.log('📍 가장 가까운 방 결정:', targetRoom, { distance: closestDistance })
                    } else {
                      // 백업: 화면 위치 기반
                      if (x < screenWidth / 3) {
                        targetRoom = 'Angio 1R'
                      } else if (x < screenWidth * 2 / 3) {
                        targetRoom = 'Angio 2R'  
                      } else {
                        targetRoom = 'Hybrid Room'
                      }
                      console.log('📍 백업 위치 기반 방 결정:', targetRoom, { x, screenWidth })
                    }
                  }
                  
                  const currentRoom = patient.department || patient.room
                  console.log('🏠 현재 방:', currentRoom, '→ 타겟 방:', targetRoom)
                  
                  // 유효한 방 이름인지 확인
                  const validRooms = ['Angio 1R', 'Angio 2R', 'Hybrid Room']
                  
                  if (validRooms.includes(targetRoom)) {
                    if (currentRoom !== targetRoom) {
                      // 다른 방으로 이동
                      console.log('✅ 환자 방 이동 실행:', patient.patient_name, currentRoom, '→', targetRoom)
                      onMovePatientToRoom(patient.id, targetRoom)
                    } else {
                      // 같은 방 내에서 순서 변경 시도
                      console.log('🔄 같은 방 내 순서 변경 시도:', patient.patient_name)
                      
                      // 터치 위치를 기반으로 새로운 인덱스 계산
                      const roomPatients = patients.filter(p => 
                        (p.department === targetRoom || p.room === targetRoom) && p.id !== patient.id
                      )
                      
                      let newIndex = roomPatients.length // 기본: 맨 아래
                      
                      // Y 위치를 기반으로 삽입 위치 결정
                      for (let i = 0; i < roomPatients.length; i++) {
                        const otherPatient = roomPatients[i]
                        const otherCard = document.querySelector(`[data-patient-id="${otherPatient.id}"]`)
                        
                        if (otherCard) {
                          const rect = otherCard.getBoundingClientRect()
                          const cardMiddleY = rect.top + rect.height / 2
                          
                          if (touchCurrentPos.y < cardMiddleY) {
                            newIndex = i
                            break
                          }
                        }
                      }
                      
                      console.log('🎯 계산된 새 인덱스:', newIndex, '/ 총', roomPatients.length + 1, '개')
                      
                      if (newIndex !== index) {
                        console.log('✅ 같은 방 내 순서 변경 실행:', patient.patient_name, index, '→', newIndex)
                        handleInternalReorder(patient.id, index, newIndex)
                      } else {
                        console.log('❌ 같은 위치 - 순서 변경 안함')
                      }
                    }
                  } else {
                    console.log('❌ 잘못된 방:', { targetRoom, validRooms })
                  }
                }
                
                // 상태 초기화
                setIsDragging(false)
                setGlobalTouchDragging(false) // 전역 드래그 상태 초기화
                setTouchStartPos(null)
                setTouchCurrentPos(null)
              }

              return (
                <div
                  data-patient-id={patient.id}
                  draggable={!isAdminMode}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
              className={`
                    relative p-4 rounded-xl border-2 transition-all duration-300 
                    ${!isAdminMode ? 'cursor-grab active:cursor-grabbing touch-manipulation select-none touch-drag-optimized touch-area-large touch-feedback' : 'cursor-default'}
                ${getStatusColor(patient.status)}
                ${patient.status === 'procedure' ? 'animate-pulse scale-105' : ''}
                ${patient.status === 'completed' ? 'opacity-60' : ''}
                    ${isDragging ? 'opacity-50 scale-110 rotate-3 shadow-2xl border-yellow-400 bg-yellow-900/20 z-50 dragging-touch' : (!isAdminMode ? 'hover:shadow-lg hover:scale-102 active:scale-95' : '')}
                    ${isNewlyAdded(patient) ? (isDarkMode 
                      ? 'ring-2 ring-green-400/50 shadow-lg shadow-green-400/20 bg-gradient-to-r from-green-900/10 to-emerald-900/10 animate-pulse' 
                      : 'ring-2 ring-green-400/60 shadow-lg shadow-green-400/30 bg-gradient-to-r from-green-50/80 to-emerald-50/80 animate-pulse'
                    ) : ''}
                  `}
                  style={{ 
                    opacity: isDragging ? 0.5 : 1,
                    transform: isDragging ? 'rotate(8deg) scale(1.1)' : 'none',
                    zIndex: isDragging ? 9999 : 'auto'
                  }}
                >
                  {/* 새로 추가된 환자 인디케이터 */}
                  {isNewlyAdded(patient) && (
                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping ${
                      isDarkMode ? 'bg-green-400' : 'bg-green-500'
                    }`}></div>
                  )}
                  {isNewlyAdded(patient) && (
                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                      isDarkMode ? 'bg-green-400' : 'bg-green-500'
                    }`}></div>
                  )}
                  
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(patient.status)}
                  
                  <div className="flex-1 min-w-0">
                    {editingPatient === patient.id ? (
                      // 편집 모드 - 새 환자 추가와 완전히 동일한 구조
                      <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          key={`number-${patient.id}`}
                          type="text"
                          placeholder="등록번호"
                          value={editValues.number}
                          onChange={handleNumberChange}
                          ref={(el) => inputRefs.current[`number-${patient.id}`] = el}
                          className={`px-3 py-2 border rounded text-sm font-bold digital-font transition-colors duration-300 ${
                            isDarkMode 
                              ? 'bg-gray-800 border-gray-600 text-white' 
                              : 'bg-white border-gray-300 text-black'
                          }`}
                        />
                        <input
                          key={`name-${patient.id}`}
                          type="text"
                          placeholder="환자명"
                          value={editValues.name}
                          onChange={handleNameChange}
                          ref={(el) => inputRefs.current[`name-${patient.id}`] = el}
                          className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                            isDarkMode 
                              ? 'bg-gray-800 border-gray-600 text-white' 
                              : 'bg-white border-gray-300 text-black'
                          }`}
                        />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            key={`procedure-${patient.id}`}
                            type="text"
                            placeholder="시술명 (예: Angio 1, PCI, Ablation)"
                            value={editValues.procedure}
                            onChange={handleProcedureChange}
                            ref={(el) => inputRefs.current[`procedure-${patient.id}`] = el}
                            className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                          />
                          <input
                            key={`doctor-${patient.id}`}
                            type="text"
                            placeholder="담당의사"
                            value={editValues.doctor}
                            onChange={handleDoctorChange}
                            ref={(el) => inputRefs.current[`doctor-${patient.id}`] = el}
                            className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            key={`notes-${patient.id}`}
                            type="text"
                            placeholder="비고 (선택사항)"
                            value={editValues.notes}
                            onChange={handleNotesChange}
                            ref={(el) => inputRefs.current[`notes-${patient.id}`] = el}
                            className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            key={`genderAge-${patient.id}`}
                            type="text"
                            placeholder="성별/나이 (예: M/65, F/45)"
                            value={editValues.genderAge}
                            onChange={handleGenderAgeChange}
                            ref={(el) => inputRefs.current[`genderAge-${patient.id}`] = el}
                            className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                          />
                          <select
                            key={`ward-${patient.id}`}
                            value={editValues.ward}
                            onChange={handleWardChange}
                            ref={(el) => inputRefs.current[`ward-${patient.id}`] = el}
                            className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                          >
                            <option value="">병동 선택</option>
                            <option value="ACC">ACC</option>
                            <option value="GW">GW</option>
                            <option value="SubCCU">SubCCU</option>
                            <option value="CCU">CCU</option>
                            <option value="ICU">ICU</option>
                            <option value="ER">ER</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      // 일반 표시 모드
                      <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                              {/* 병동이 있을 때만 표시 */}
                              {patient.ward && patient.ward.trim() && (
                                <div className={`text-xs px-2 py-1 rounded transition-colors duration-300 ${
                                  getWardColor(patient.ward)
                                }`}>
                                  {patient.ward}
                                </div>
                              )}
                              <div className={`text-xl font-bold digital-font transition-colors duration-300 ${
                                isDarkMode ? 'text-white' : 'text-black'
                              }`}>
                                {maskPersonalInfo(patient.patient_id || patient.number, 'number')}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`text-lg opacity-75 transition-colors duration-300 ${
                                isDarkMode ? 'text-gray-300' : 'text-black'
                              }`}>
                                {maskPersonalInfo(patient.patient_name || patient.name, 'name')}
                              </div>
                              {patient.gender_age && (
                                <div className={`text-lg opacity-75 transition-colors duration-300 ${
                                  isDarkMode ? 'text-gray-300' : 'text-black'
                                }`}>
                                  {patient.gender_age}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Stethoscope className={`w-4 h-4 transition-colors duration-300 ${
                              isDarkMode ? 'text-gray-400' : 'text-black'
                            }`} />
                            <div>
                              {(patient.procedure || patient.assigned_doctor) && (
                                <div className={`text-lg font-medium transition-colors duration-300 ${
                                  isDarkMode ? 'text-white' : 'text-black'
                                }`}>{patient.procedure || patient.assigned_doctor || ''}</div>
                              )}
                              {patient.doctor && (
                                <div className={`text-base opacity-75 transition-colors duration-300 ${
                                  isDarkMode ? 'text-gray-400' : 'text-black'
                                }`}>{patient.doctor}</div>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* 비고가 있을 때만 표시 */}
                        {patient.notes && patient.notes.trim() && (
                          <div className={`text-sm font-medium px-2 py-1 rounded transition-colors duration-300 ${
                            isDarkMode ? 'bg-emerald-900/40 border border-emerald-600/60 text-emerald-200' : 'bg-indigo-100 border border-indigo-300 text-indigo-800'
                          }`}>
                            {patient.notes}
                          </div>
                        )}
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
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          
                          // 🔥 CAG 환자가 "시술완료"를 선택한 경우 PCI로 변경
                          if (newStatus === 'procedure_completed' && 
                              (patient.assigned_doctor || '').toUpperCase().includes('CAG')) {
                            // CAG → PCI 변경 및 완료 상태로 설정
                            onUpdatePatientProcedure(patient.id, 'PCI');
                            onUpdatePatientStatus(patient.id, 'completed', 'PCI');
                          } else {
                            handleStatusChange(patient.id, newStatus);
                          }
                        }}
                        className={`px-2 py-1 border rounded text-xs pointer-events-auto transition-colors duration-300 ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-black'
                        }`}
                      >
                        <option value="waiting">대기중</option>
                        <option value="procedure">시술중</option>
                        <option value="completed">완료</option>
                        {/* CAG 환자인 경우에만 시술완료 옵션 표시 */}
                        {(patient.assigned_doctor || '').toUpperCase().includes('CAG') && (
                          <option value="procedure_completed">시술완료 (CAG→PCI)</option>
                        )}
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
                              className={`p-1 border rounded pointer-events-auto transition-colors duration-300 ${
                                isDarkMode 
                                  ? 'bg-green-600/20 border-green-500 text-green-300 hover:bg-green-600/30' 
                                  : 'bg-green-100 border-green-600 text-green-800 hover:bg-green-200'
                              }`}
                              title="모든 변경사항 저장 (Enter 키로도 개별 저장 가능)"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className={`p-1 border rounded pointer-events-auto transition-colors duration-300 ${
                                isDarkMode 
                                  ? 'bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/30' 
                                  : 'bg-red-100 border-red-600 text-red-800 hover:bg-red-200'
                              }`}
                              title="취소"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(patient)}
                              className={`p-1 border rounded pointer-events-auto transition-colors duration-300 ${
                                isDarkMode 
                                  ? 'bg-gray-600/20 border-gray-500 text-gray-300 hover:bg-gray-600/30' 
                                  : 'bg-gray-100 border-gray-600 text-gray-800 hover:bg-gray-200'
                              }`}
                              title="편집"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeletePatient(patient.id)}
                              className={`p-1 border rounded pointer-events-auto transition-colors duration-300 ${
                                isDarkMode 
                                  ? 'bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/30' 
                                  : 'bg-red-100 border-red-600 text-red-800 hover:bg-red-200'
                              }`}
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
          
          return (
            <React.Fragment key={patient.id}>
              {/* 환자 카드 위쪽 드롭존 */}
              {index === 0 && (
                <div
                  data-drop-index="0"
                  className={`transition-all duration-200 ${
                    dragOverIndex === 0 ? 'h-8 bg-green-400/30 border-2 border-green-400 border-dashed rounded-lg' : 'h-2'
                  } ${globalTouchDragging ? 'bg-green-400/10 border border-green-400/30 border-dashed rounded-lg min-h-[8px]' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverIndex(0)
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    const patientData = JSON.parse(e.dataTransfer.getData('application/json'))
                    if (patientData.isInternalReorder && patientData.currentRoom === roomTitle) {
                      handleInternalReorder(patientData.patientId, patientData.currentIndex, 0)
                    }
                    setDragOverIndex(null)
                  }}
                />
              )}
              
              <DraggablePatientCard />
              
              {/* 환자 카드 아래쪽 드롭존 */}
              <div
                data-drop-index={index + 1}
                className={`transition-all duration-200 ${
                  dragOverIndex === index + 1 ? 'h-8 bg-green-400/30 border-2 border-green-400 border-dashed rounded-lg' : 'h-2'
                } ${globalTouchDragging ? 'bg-green-400/10 border border-green-400/30 border-dashed rounded-lg min-h-[8px]' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverIndex(index + 1)
                }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  const patientData = JSON.parse(e.dataTransfer.getData('application/json'))
                  if (patientData.isInternalReorder && patientData.currentRoom === roomTitle) {
                    handleInternalReorder(patientData.patientId, patientData.currentIndex, index + 1)
                  }
                  setDragOverIndex(null)
                }}
              />
            </React.Fragment>
          )
        })}

        {/* 환자 추가 버튼 및 폼 */}
        {isAdminMode && (
          <div className="mt-4">
            {!showAddForm ? (
              <button
                onClick={toggleAddForm}
                className={`w-full p-4 border-2 border-dashed rounded-xl transition-all flex items-center justify-center gap-2 ${
                  isDarkMode 
                    ? 'bg-green-900/20 border-green-700/50 text-green-300 hover:bg-green-800/30 hover:border-green-600/70' 
                    : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-400'
                }`}
              >
                <Plus className="w-5 h-5" />
                <span>환자 추가</span>
              </button>
            ) : (
              <div className={`p-4 border-2 rounded-xl transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-green-900/20 border-green-700/50' 
                  : 'bg-green-50 border-green-300'
              }`}>
                <h4 className={`font-semibold mb-3 transition-colors duration-300 ${
                  isDarkMode ? 'text-green-300' : 'text-green-700'
                }`}>새 환자 추가</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="등록번호 (예: A001)"
                      value={newPatient.number}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, number: e.target.value }))}
                      className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-black'
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="환자명"
                      value={newPatient.name}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, name: e.target.value }))}
                      className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-black'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="시술명 (예: Angio 1, PCI, Ablation)"
                      value={newPatient.procedure}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, procedure: e.target.value }))}
                      className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-black'
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="담당의사"
                      value={newPatient.doctor}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, doctor: e.target.value }))}
                      className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-black'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="성별/나이 (예: M/64)"
                      value={newPatient.genderAge}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, genderAge: e.target.value }))}
                      className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-black'
                      }`}
                    />
                    <select
                      value={newPatient.ward}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, ward: e.target.value }))}
                      className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-black'
                      }`}
                    >
                      <option value="">병동 선택</option>
                      <option value="ACC">ACC</option>
                      <option value="GW">GW</option>
                      <option value="SubCCU">SubCCU</option>
                      <option value="CCU">CCU</option>
                      <option value="ICU">ICU</option>
                      <option value="ER">ER</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      placeholder="비고 (선택사항)"
                      value={newPatient.notes}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, notes: e.target.value }))}
                      className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-black'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <select
                      value={newPatient.status}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        
                        // 🔥 CAG 환자가 "시술완료"를 선택한 경우 PCI로 변경
                        if (newStatus === 'procedure_completed' && 
                            newPatient.procedure.toUpperCase().includes('CAG')) {
                          setNewPatient(prev => ({ 
                            ...prev, 
                            status: 'completed',
                            procedure: 'PCI'
                          }));
                        } else {
                          setNewPatient(prev => ({ ...prev, status: newStatus }));
                        }
                      }}
                      className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-black'
                      }`}
                    >
                      <option value="waiting">대기중</option>
                      <option value="procedure">시술중</option>
                      <option value="completed">완료</option>
                      {/* CAG 환자인 경우에만 시술완료 옵션 표시 */}
                      {newPatient.procedure.toUpperCase().includes('CAG') && (
                        <option value="procedure_completed">시술완료 (CAG→PCI)</option>
                      )}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddPatient}
                      className={`flex-1 px-4 py-2 border rounded transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-green-600/20 border-green-500 text-green-300 hover:bg-green-600/30' 
                          : 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      추가
                    </button>
                    <button
                      onClick={toggleAddForm}
                      className={`flex-1 px-4 py-2 border rounded transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-600/20 border-gray-500 text-gray-300 hover:bg-gray-600/30' 
                          : 'bg-gray-600 border-gray-600 text-white hover:bg-gray-700'
                      }`}
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
})

export default PatientQueue

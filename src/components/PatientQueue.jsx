import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Clock, User, Stethoscope, Edit3, Check, X, Plus, Trash2 } from 'lucide-react'

const PatientQueue = ({ patients, roomTitle, isAdminMode, isPrivacyMode, isDarkMode, onUpdatePatientName, onUpdatePatientNumber, onUpdatePatientStatus, onUpdatePatientProcedure, onUpdatePatientDoctor, onUpdatePatientNotes, onUpdatePatientGenderAge, onUpdatePatientWard, onAddPatient, onDeletePatient, onMovePatientToRoom, onReorderPatients }) => {
  const [editingPatient, setEditingPatient] = useState(null)
  const [editValues, setEditValues] = useState({ name: '', number: '', procedure: '', doctor: '', notes: '', genderAge: '', ward: '' })
  
  // 입력 필드 포커스 유지를 위한 ref들
  const numberInputRef = useRef(null)
  const nameInputRef = useRef(null)
  const procedureInputRef = useRef(null)
  const doctorInputRef = useRef(null)
  const notesInputRef = useRef(null)
  const genderAgeInputRef = useRef(null)
  const wardSelectRef = useRef(null)
  
  // 포커스 상태 추적
  const [focusedField, setFocusedField] = useState(null)
  const [cursorPosition, setCursorPosition] = useState(0)
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

  // 관리자 모드 변경 시 편집 상태 초기화
  useEffect(() => {
    if (!isAdminMode && editingPatient) {
      console.log('🔒 관리자 모드 해제 - 편집 모드 종료')
      setEditingPatient(null)
      setEditValues({ name: '', number: '', procedure: '', doctor: '', notes: '', genderAge: '', ward: '' })
      setFocusedField(null)
      setCursorPosition(0)
      setShowAddForm(false)
    }
  }, [isAdminMode, editingPatient])

  // 드롭 기능 설정
  // 네이티브 드래그 앤 드롭 상태
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedPatient, setDraggedPatient] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

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
    if (!addedTime) {
      console.log('❌ added_at/addedAt 없음:', patient.patient_name || patient.name)
      return false
    }
    const fiveMinutes = 5 * 60 * 1000 // 5분을 밀리초로 변환
    const timeDiff = currentTime - addedTime
    const isNew = timeDiff < fiveMinutes
    console.log('⏰ 새로 추가됨 체크:', patient.patient_name || patient.name, 
      '추가시간:', new Date(addedTime).toLocaleTimeString(),
      '경과시간:', Math.floor(timeDiff / 1000), '초',
      '새로운가?:', isNew)
    return isNew
  }

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
      } else if (patient.isInternalReorder && dragOverIndex !== null && dragOverIndex !== patient.currentIndex) {
        console.log('🔄 같은 방 내 순서 변경:', patient.patientName, 'from index', patient.currentIndex, '→', dragOverIndex)
        handleInternalReorder(patient.patientId, patient.currentIndex, dragOverIndex)
      } else {
        console.log('⚠️ 같은 방으로 이동 시도 - 무시')
      }
    } catch (error) {
      console.error('❌ 드롭 데이터 파싱 오류:', error)
    }
    
    setDragOverIndex(null)
  }

  // 같은 방 내 환자 순서 변경 처리
  const handleInternalReorder = (patientId, fromIndex, toIndex) => {
    console.log('🔄 방 내 순서 변경 처리:', { patientId, fromIndex, toIndex })
    
    const roomPatients = patients.filter(p => p.department === roomTitle || p.room === roomTitle)
    const sortedPatients = roomPatients.sort((a, b) => {
      if (a.display_order && b.display_order) {
        return a.display_order - b.display_order
      }
      return a.id - b.id
    })
    
    // 새로운 순서로 환자 배열 재정렬
    const reorderedPatients = [...sortedPatients]
    const [movedPatient] = reorderedPatients.splice(fromIndex, 1)
    reorderedPatients.splice(toIndex, 0, movedPatient)
    
    // 서버로 순서 업데이트 전송
    const patientOrders = reorderedPatients.map((patient, index) => ({
      patientId: patient.id,
      newOrder: index + 1
    }))
    
    console.log('📤 서버로 순서 변경 전송:', patientOrders)
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
      ward: patient.ward || ''
    })
  }

  // 편집 저장
  const saveEdit = () => {
    console.log('💾 편집 저장 시작:', editValues);
    
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
    
    console.log('✅ 편집 저장 완료 - 편집 모드 종료');
    setEditingPatient(null)
    setEditValues({ name: '', number: '', procedure: '', doctor: '', notes: '', genderAge: '', ward: '' })
  }

  // 포커스와 커서 위치 복원을 위한 useEffect
  useEffect(() => {
    if (focusedField && editingPatient) {
      const getInputRef = (field) => {
        switch (field) {
          case 'number': return numberInputRef;
          case 'name': return nameInputRef;
          case 'procedure': return procedureInputRef;
          case 'doctor': return doctorInputRef;
          case 'notes': return notesInputRef;
          case 'genderAge': return genderAgeInputRef;
          case 'ward': return wardSelectRef;
          default: return null;
        }
      };
      
      const inputRef = getInputRef(focusedField);
      if (inputRef?.current) {
        console.log(`🎯 포커스 복원: ${focusedField}, 커서위치: ${cursorPosition}`);
        inputRef.current.focus();
        // select 요소는 setSelectionRange를 지원하지 않으므로 체크
        if (inputRef.current.setSelectionRange && focusedField !== 'ward') {
          inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      }
    }
  }, [editValues, focusedField, cursorPosition, editingPatient]);

  // 포커스 유지하면서 값 변경
  const handleFieldChange = useCallback((field, value, inputRef) => {
    // 현재 커서 위치 저장 (select 요소는 selectionStart를 지원하지 않음)
    const currentElement = inputRef.current;
    const newCursorPosition = currentElement && currentElement.selectionStart !== undefined 
      ? currentElement.selectionStart 
      : 0;
    
    console.log(`✏️ 필드 변경: ${field} = "${value}", 커서위치: ${newCursorPosition}`);
    
    // 포커스 상태 업데이트
    setFocusedField(field);
    setCursorPosition(newCursorPosition);
    
    // 상태 업데이트
    setEditValues(prev => ({ ...prev, [field]: value }));
  }, []);

  // 편집 중 필드별 저장 (Enter 키나 포커스 이탈 시에만)
  const saveField = (field, value) => {
    // 필수 필드들은 빈 값일 때 저장하지 않음, 비고는 빈 값 허용
    if (field !== 'notes' && !value.trim()) return;
    
    console.log(`💾 필드 저장: ${field} = "${value}"`);
    
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
  }

  // 편집 취소
  const cancelEdit = () => {
    setEditingPatient(null)
    setEditValues({ name: '', number: '', procedure: '', doctor: '', notes: '', genderAge: '', ward: '' })
    setFocusedField(null)
    setCursorPosition(0)
  }

  // 포커스 시작 핸들러
  const handleFocus = (field, inputRef) => {
    console.log(`🎯 포커스 시작: ${field}`);
    setFocusedField(field);
    const currentElement = inputRef.current;
    if (currentElement && currentElement.selectionStart !== undefined) {
      setCursorPosition(currentElement.selectionStart || 0);
    } else {
      setCursorPosition(0); // select 요소의 경우 0으로 설정
    }
  }

  // 포커스 종료 핸들러  
  const handleBlur = () => {
    console.log('🔄 포커스 종료');
    // 포커스 상태는 유지하되, 약간의 지연 후 체크
    setTimeout(() => {
      const activeElement = document.activeElement;
      const isInputField = [numberInputRef, nameInputRef, procedureInputRef, doctorInputRef, notesInputRef, genderAgeInputRef, wardSelectRef]
        .some(ref => ref.current === activeElement);
      
      if (!isInputField) {
        setFocusedField(null);
        setCursorPosition(0);
      }
    }, 100);
  }

  // 상태 변경
  const handleStatusChange = (patientId, newStatus) => {
    // 환자 정보에서 기존 시술명 찾기
    const patient = patients.find(p => p.id === patientId);
    const currentProcedure = patient?.assigned_doctor || patient?.procedure;
    
    console.log(`🔄 상태 변경: 환자ID=${patientId}, 상태=${newStatus}, 기존시술명="${currentProcedure}"`);
    
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
        addedAt: Date.now() // 추가된 시간 기록
      }
      console.log('🆕 새 환자 추가:', patientWithTime.name, '시간:', new Date(patientWithTime.addedAt).toLocaleTimeString())
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
        {isDragOver && (
          <div className="text-green-400 text-sm font-medium animate-pulse">
            🏠 환자를 여기로 이동
          </div>
        )}
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
                  console.log('❌ 관리자 모드에서는 드래그 불가')
                  return
                }
                
                setIsDragging(true)
                console.log('🚀🚀🚀 네이티브 드래그 시작!', patient.patient_name || patient.name, 'from', patient.department || patient.room)
                
                const patientData = {
                  patientId: patient.id,
                  currentRoom: patient.department || patient.room,
                  patientName: patient.patient_name || patient.name,
                  currentIndex: index,
                  isInternalReorder: true // 같은 방 내 순서 변경임을 표시
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
                  let attempts = 0
                  const maxAttempts = 10 // 무한 루프 방지
                  
                  while (dropZone && !dropZone.hasAttribute('data-room') && attempts < maxAttempts) {
                    dropZone = dropZone.parentElement
                    attempts++
                  }
                  
                  if (dropZone && dropZone.hasAttribute('data-room')) {
                    const targetRoom = dropZone.getAttribute('data-room')
                    const currentRoom = patient.department || patient.room
                    
                    console.log('📍 터치 드롭:', patient.patient_name || patient.name, 'from', currentRoom, '→', targetRoom)
                    
                    // 유효한 방 이름인지 확인
                    const validRooms = ['Angio 1R', 'Angio 2R', 'Hybrid Room']
                    if (validRooms.includes(targetRoom)) {
                      if (currentRoom !== targetRoom) {
                        console.log('✅ 터치로 환자 방 이동 실행:', patient.id, '→', targetRoom)
                        onMovePatientToRoom(patient.id, targetRoom)
                      } else {
                        console.log('⚠️ 같은 방으로 터치 이동 시도 - 무시')
                      }
                    } else {
                      console.log('❌ 유효하지 않은 방 이름:', targetRoom)
                    }
                  } else {
                    console.log('❌ 유효한 드롭존을 찾을 수 없음 - 드래그 취소')
                    console.log('💡 올바른 방(Angio 1R, 2R, Hybrid Room)에 드롭해주세요')
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
                  title={isDragging ? '드래그 중... 다른 방에 놓으세요!' : (!isAdminMode ? '드래그해서 다른 방으로 이동' : '관리자 모드에서는 드래그 불가')}
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
                      // 편집 모드
                      <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                            ref={numberInputRef}
                          type="text"
                          value={editValues.number}
                            onChange={(e) => handleFieldChange('number', e.target.value, numberInputRef)}
                            onFocus={() => handleFocus('number', numberInputRef)}
                            onBlur={handleBlur}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                saveField('number', e.target.value);
                              }
                            }}
                            className={`px-2 py-1 border rounded text-sm font-bold digital-font transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                          placeholder="등록번호"
                        />
                        <input
                            ref={nameInputRef}
                          type="text"
                          value={editValues.name}
                            onChange={(e) => handleFieldChange('name', e.target.value, nameInputRef)}
                            onFocus={() => handleFocus('name', nameInputRef)}
                            onBlur={handleBlur}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                saveField('name', e.target.value);
                              }
                            }}
                            className={`px-2 py-1 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                          placeholder="환자명"
                        />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            ref={procedureInputRef}
                            type="text"
                            value={editValues.procedure}
                            onChange={(e) => handleFieldChange('procedure', e.target.value, procedureInputRef)}
                            onFocus={() => handleFocus('procedure', procedureInputRef)}
                            onBlur={handleBlur}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                saveField('procedure', e.target.value);
                              }
                            }}
                            className={`px-2 py-1 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                            placeholder="시술명"
                          />
                          <input
                            ref={doctorInputRef}
                            type="text"
                            value={editValues.doctor}
                            onChange={(e) => handleFieldChange('doctor', e.target.value, doctorInputRef)}
                            onFocus={() => handleFocus('doctor', doctorInputRef)}
                            onBlur={handleBlur}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                saveField('doctor', e.target.value);
                              }
                            }}
                            className={`px-2 py-1 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                            placeholder="담당의사"
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            ref={notesInputRef}
                            type="text"
                            value={editValues.notes}
                            onChange={(e) => handleFieldChange('notes', e.target.value, notesInputRef)}
                            onFocus={() => handleFocus('notes', notesInputRef)}
                            onBlur={handleBlur}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                saveField('notes', e.target.value);
                              }
                            }}
                            className={`px-2 py-1 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                            placeholder="비고 (선택사항)"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            ref={genderAgeInputRef}
                            type="text"
                            value={editValues.genderAge}
                            onChange={(e) => handleFieldChange('genderAge', e.target.value, genderAgeInputRef)}
                            onFocus={() => handleFocus('genderAge', genderAgeInputRef)}
                            onBlur={handleBlur}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                saveField('genderAge', e.target.value);
                              }
                            }}
                            className={`px-2 py-1 border rounded text-sm transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-black'
                            }`}
                            placeholder="성별/나이 (예: M/64)"
                          />
                          <select
                            ref={wardSelectRef}
                            value={editValues.ward}
                            onChange={(e) => {
                              handleFieldChange('ward', e.target.value, wardSelectRef);
                              // select 변경 시 즉시 저장
                              if (e.target.value) {
                                saveField('ward', e.target.value);
                              }
                            }}
                            onFocus={() => handleFocus('ward', wardSelectRef)}
                            onBlur={handleBlur}
                            className={`px-2 py-1 border rounded text-sm transition-colors duration-300 ${
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
                              {patient.ward && (
                                <div className={`text-xs px-2 py-1 rounded transition-colors duration-300 ${getWardColor(patient.ward)}`}>
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
                        onChange={(e) => handleStatusChange(patient.id, e.target.value)}
                        className={`px-2 py-1 border rounded text-xs pointer-events-auto transition-colors duration-300 ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-black'
                        }`}
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
                  className={`h-2 rounded transition-all duration-200 ${
                    dragOverIndex === 0 ? 'bg-green-400/30 border-2 border-green-400 border-dashed' : ''
                  }`}
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
                className={`h-2 rounded transition-all duration-200 ${
                  dragOverIndex === index + 1 ? 'bg-green-400/30 border-2 border-green-400 border-dashed' : ''
                }`}
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
                      onChange={(e) => setNewPatient(prev => ({ ...prev, status: e.target.value }))}
                      className={`px-3 py-2 border rounded text-sm transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-black'
                      }`}
                    >
                      <option value="waiting">대기중</option>
                      <option value="procedure">시술중</option>
                      <option value="completed">완료</option>
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
}

export default PatientQueue

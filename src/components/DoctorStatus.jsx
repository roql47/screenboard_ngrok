import React, { useState, useEffect } from 'react'
import { Calendar, User, Edit3, Check, X, Plus, Minus } from 'lucide-react'

const DoctorSchedule = ({ isAdminMode, schedule = {}, onUpdateSchedule }) => {
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  
  // 로컬 스케줄 상태 (props에서 받은 스케줄을 기본값으로 사용)
  const [localSchedule, setLocalSchedule] = useState(schedule)

  // props에서 받은 스케줄이 변경될 때 로컬 상태 동기화
  useEffect(() => {
    if (schedule && Object.keys(schedule).length > 0) {
      setLocalSchedule(schedule);
    } else {
      // 빈 스케줄일 때 기본 구조 생성
      const defaultSchedule = {};
      const days = ['월', '화', '수', '목', '금'];
      const times = ['오전', '오후'];
      
      days.forEach(day => {
        defaultSchedule[day] = {};
        times.forEach(time => {
          defaultSchedule[day][time] = [];
        });
      });
      
      setLocalSchedule(defaultSchedule);
    }
  }, [schedule]);

  const days = ['월', '화', '수', '목', '금']
  const times = ['오전', '오후']

  // 편집 시작
  const startEdit = (day, time, index, currentName) => {
    setEditingCell(`${day}-${time}-${index}`)
    setEditValue(currentName)
  }

  // 편집 저장
  const saveEdit = (day, time, index) => {
    if (editValue.trim()) {
      const newSchedule = {
        ...localSchedule,
        [day]: {
          ...localSchedule[day],
          [time]: localSchedule[day][time].map((name, i) => 
            i === index ? editValue.trim() : name
          )
        }
      };
      
      setLocalSchedule(newSchedule);
      
      // 서버로 스케줄 업데이트 전송
      console.log('📤 편집 저장 - 스케줄 업데이트를 서버로 전송:', newSchedule);
      if (onUpdateSchedule) {
        console.log('✅ onUpdateSchedule 함수 호출');
        onUpdateSchedule(newSchedule);
      } else {
        console.error('❌ onUpdateSchedule 함수가 없습니다!');
      }
    }
    setEditingCell(null)
    setEditValue('')
  }

  // 편집 취소
  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  // 의사 추가
  const addDoctor = (day, time) => {
    const newDoctorName = prompt('추가할 의사 이름을 입력하세요:')
    if (newDoctorName && newDoctorName.trim()) {
      const newSchedule = {
        ...localSchedule,
        [day]: {
          ...localSchedule[day],
          [time]: [...(localSchedule[day]?.[time] || []), newDoctorName.trim()]
        }
      };
      
      setLocalSchedule(newSchedule);
      
      // 서버로 스케줄 업데이트 전송
      console.log('📤 의사 추가 - 스케줄 업데이트를 서버로 전송:', newSchedule);
      if (onUpdateSchedule) {
        console.log('✅ onUpdateSchedule 함수 호출');
        onUpdateSchedule(newSchedule);
      } else {
        console.error('❌ onUpdateSchedule 함수가 없습니다!');
      }
    }
  }

  // 의사 제거
  const removeDoctor = (day, time, index) => {
    if (localSchedule[day]?.[time]?.length > 1) { // 최소 1명은 유지
      const newSchedule = {
        ...localSchedule,
        [day]: {
          ...localSchedule[day],
          [time]: localSchedule[day][time].filter((_, i) => i !== index)
        }
      };
      
      setLocalSchedule(newSchedule);
      
      // 서버로 스케줄 업데이트 전송
      console.log('📤 의사 제거 - 스케줄 업데이트를 서버로 전송:', newSchedule);
      if (onUpdateSchedule) {
        console.log('✅ onUpdateSchedule 함수 호출');
        onUpdateSchedule(newSchedule);
      } else {
        console.error('❌ onUpdateSchedule 함수가 없습니다!');
      }
    }
  }

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 board-shadow border border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-6 h-6 text-blue-400" />
        <h3 className="text-2xl font-semibold text-white">외래 진료일정</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-600 bg-gray-800/50 p-3 text-white font-semibold text-center">
                시간
              </th>
              {days.map((day) => (
                <th key={day} className="border border-gray-600 bg-gray-800/50 p-3 text-white font-semibold text-center min-w-[120px]">
                  {day}요일
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => (
              <tr key={time}>
                <td className="border border-gray-600 bg-gray-800/30 p-3 text-white font-semibold text-center">
                  {time}
                </td>
                {days.map((day) => (
                  <td key={`${day}-${time}`} className="border border-gray-600 p-2 text-center">
                    <div className="space-y-1">
                      {(localSchedule[day]?.[time] || []).map((doctor, index) => {
                        const cellKey = `${day}-${time}-${index}`
                        const isEditing = editingCell === cellKey
                        
                        return (
                          <div
                            key={index}
                            className={`
                              flex items-center justify-center gap-1 p-2 bg-blue-900/20 rounded-lg border border-blue-700/30 relative group
                              ${isAdminMode ? 'hover:bg-blue-800/30' : ''}
                            `}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-16 px-1 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm text-center"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') saveEdit(day, time, index)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveEdit(day, time, index)}
                                  className="p-1 text-green-400 hover:bg-green-600/20 rounded"
                                  title="저장"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1 text-red-400 hover:bg-red-600/20 rounded"
                                  title="취소"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <User className="w-3 h-3 text-blue-400" />
                                <span className="text-base text-blue-200 font-medium whitespace-nowrap">
                                  {doctor}
                                </span>
                                {isAdminMode && (
                                  <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => startEdit(day, time, index, doctor)}
                                      className="p-1 bg-gray-600/20 border border-gray-500 rounded text-gray-300 hover:bg-gray-600/30"
                                      title="편집"
                                    >
                                      <Edit3 className="w-2 h-2" />
                                    </button>
                                    {schedule[day][time].length > 1 && (
                                      <button
                                        onClick={() => removeDoctor(day, time, index)}
                                        className="p-1 bg-red-600/20 border border-red-500 rounded text-red-300 hover:bg-red-600/30"
                                        title="제거"
                                      >
                                        <Minus className="w-2 h-2" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })}
                      
                      {/* 의사 추가 버튼 */}
                      {isAdminMode && (
                        <button
                          onClick={() => addDoctor(day, time)}
                          className="w-full p-2 bg-green-900/20 border-2 border-dashed border-green-700/50 rounded-lg text-green-300 hover:bg-green-800/30 hover:border-green-600/70 transition-all"
                          title="의사 추가"
                        >
                          <Plus className="w-4 h-4 mx-auto" />
                        </button>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
          <span>외래 진료</span>
        </div>
      </div>
    </div>
  )
}

export default DoctorSchedule

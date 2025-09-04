import React, { useState, useEffect } from 'react'
import { Users, Clock, CheckCircle, AlertCircle, Edit3, Check, X } from 'lucide-react'
import socketManager, { fetchDutyStaff, updateDutyStaff } from '../utils/socket'

const PatientSummary = ({ patients, isPrivacyMode, isAdminMode, isDarkMode, onMovePatientToRoom }) => {
  // 당직 정보 상태 관리
  const [dutyStaff, setDutyStaff] = useState({
    Doctor: '김교수',
    RN: '박간호사', 
    RT: '이방사선사'
  })
  const [editingStaff, setEditingStaff] = useState(null) // 'Doctor', 'RN', 'RT' 중 하나
  const [editValue, setEditValue] = useState('')

  // 컴포넌트 마운트 시 당직 데이터 로드
  useEffect(() => {
    const loadDutyStaff = async () => {
      try {
        const data = await fetchDutyStaff();
        console.log('🔄 당직 의료진 데이터 로드:', data);
        setDutyStaff(data);
      } catch (error) {
        console.error('❌ 당직 의료진 로드 실패:', error);
        // 실패 시 localStorage에서 백업 데이터 사용
        const backup = localStorage.getItem('dutyStaff_backup');
        if (backup) {
          console.log('🔄 localStorage에서 당직 데이터 복원');
          setDutyStaff(JSON.parse(backup));
        }
      }
    };

    loadDutyStaff();
  }, []);

  // Socket.IO 이벤트 리스너 설정
  useEffect(() => {
    const handleDutyUpdate = (updatedDutyStaff) => {
      console.log('📡 당직 의료진 실시간 업데이트 수신:', updatedDutyStaff);
      setDutyStaff(updatedDutyStaff);
      // localStorage에 백업
      localStorage.setItem('dutyStaff_backup', JSON.stringify(updatedDutyStaff));
    };

    socketManager.on('duty_updated', handleDutyUpdate);

    return () => {
      socketManager.off('duty_updated', handleDutyUpdate);
    };
  }, []);

  // localStorage 백업 (상태 변경 시)
  useEffect(() => {
    if (dutyStaff && Object.keys(dutyStaff).length > 0) {
      localStorage.setItem('dutyStaff_backup', JSON.stringify(dutyStaff));
    }
  }, [dutyStaff]);

  // 개인정보 마스킹 함수
  const maskPersonalInfo = (text, type = 'name') => {
    if (!isPrivacyMode || !text) return text || '' // null/undefined 체크 추가
    
    if (type === 'name') {
      if (text.length <= 1) return text
      return text.charAt(0) + '**'
    } else if (type === 'number') {
      if (text.length <= 2) return text
      return text.substring(0, 2) + '**'
    }
    
    return text
  }

  // 당직 편집 시작
  const startEdit = (staffType) => {
    setEditingStaff(staffType)
    setEditValue(dutyStaff[staffType])
  }

  // 당직 편집 저장
  const saveEdit = async () => {
    if (!editValue.trim()) return
    
    const newDutyStaff = {
      ...dutyStaff,
      [editingStaff]: editValue.trim()
    };
    
    try {
      // 즉시 로컬 상태 업데이트 (UI 반응성)
      setDutyStaff(newDutyStaff);
      
      // 백엔드에 업데이트 전송
      console.log('🔄 당직 의료진 서버 업데이트 시작:', newDutyStaff);
      await updateDutyStaff(newDutyStaff);
      console.log('✅ 당직 의료진 서버 업데이트 완료');
      
    } catch (error) {
      console.error('❌ 당직 의료진 업데이트 실패:', error);
      // 실패 시 이전 상태로 롤백
      setDutyStaff(dutyStaff);
    }
    
    setEditingStaff(null);
    setEditValue('');
  }

  // 당직 편집 취소
  const cancelEdit = () => {
    setEditingStaff(null)
    setEditValue('')
  }

  // 상태별 환자 분류
  const waitingPatients = patients.filter(p => p.status === 'waiting')
  const procedurePatients = patients.filter(p => p.status === 'procedure')
  const completedPatients = patients.filter(p => p.status === 'completed')

  return (
    <div className="space-y-4">
      {/* 대기 중 환자 */}
      <div className={`backdrop-blur-md rounded-2xl p-3  border transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-black/40 border-gray-700' 
          : 'bg-white/90 border-gray-300'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <Clock className={`w-6 h-6 transition-colors duration-300 ${
            isDarkMode ? 'text-blue-400' : 'text-blue-600'
          }`} />
          <h3 className={`text-2xl font-semibold transition-colors duration-300 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>대기 중 환자</h3>
          <span className={`px-3 py-1 rounded-full text-base font-bold transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-blue-600/20 text-blue-300' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {waitingPatients.length}명
          </span>
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {waitingPatients.length > 0 && (
            waitingPatients
              .sort((a, b) => (b.wait_time || b.waitTime || 0) - (a.wait_time || a.waitTime || 0)) // 대기시간 긴 순서
              .map((patient) => (
                <div key={patient.id} className={`p-2 rounded-lg border transition-colors duration-300 ${
                  isDarkMode 
                    ? 'bg-blue-900/20 border-blue-700/30' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                        isDarkMode ? 'bg-blue-400' : 'bg-blue-600'
                      }`}></div>
                      <div>
                        <div className={`text-base font-semibold transition-colors duration-300 ${
                          isDarkMode ? 'text-blue-200' : 'text-black'
                        }`}>
                          {maskPersonalInfo(patient.patient_id || patient.number, 'number')} {maskPersonalInfo(patient.patient_name || patient.name, 'name')}
                        </div>
                        {(patient.assigned_doctor || patient.doctor) && (
                          <div className={`text-sm transition-colors duration-300 ${
                            isDarkMode ? 'text-blue-300/70' : 'text-black opacity-70'
                          }`}>{patient.assigned_doctor || patient.doctor}</div>
                        )}
                      </div>
                    </div>
                    {(patient.wait_time || patient.waitTime) > 0 && (
                      <div className={`text-sm flex items-center gap-1 transition-colors duration-300 ${
                        isDarkMode ? 'text-blue-300' : 'text-black'
                      }`}>
                        <Clock className={`w-4 h-4 transition-colors duration-300 ${
                          isDarkMode ? 'text-blue-400' : 'text-black'
                        }`} />
                        {patient.wait_time || patient.waitTime}분
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>



      {/* 완료된 환자 */}
      <div className={`backdrop-blur-md rounded-2xl p-3  border transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-black/40 border-gray-700' 
          : 'bg-white/90 border-gray-300'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className={`w-6 h-6 transition-colors duration-300 ${
            isDarkMode ? 'text-green-400' : 'text-green-600'
          }`} />
          <h3 className={`text-2xl font-semibold transition-colors duration-300 ${
            isDarkMode ? 'text-white' : 'text-black'
          }`}>완료된 환자</h3>
          <span className={`px-3 py-1 rounded-full text-base font-bold transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-green-600/20 text-green-300' 
              : 'bg-green-100 text-green-800'
          }`}>
            {completedPatients.length}명
          </span>
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {completedPatients.length > 0 ? (
            completedPatients
              .sort((a, b) => b.id - a.id) // 최근 완료 순서
              .map((patient) => (
                <div key={patient.id} className={`p-2 rounded-lg border opacity-80 transition-colors duration-300 ${
                  isDarkMode 
                    ? 'bg-green-900/20 border-green-700/30' 
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                        isDarkMode ? 'bg-green-400' : 'bg-green-600'
                      }`}></div>
                      <div>
                        <div className={`text-base font-semibold transition-colors duration-300 ${
                          isDarkMode ? 'text-green-200' : 'text-black'
                        }`}>
                          {maskPersonalInfo(patient.patient_id || patient.number, 'number')} {maskPersonalInfo(patient.patient_name || patient.name, 'name')}
                        </div>
                        {(patient.assigned_doctor || patient.doctor) && (
                          <div className={`text-sm transition-colors duration-300 ${
                            isDarkMode ? 'text-green-300/70' : 'text-black opacity-70'
                          }`}>{patient.assigned_doctor || patient.doctor}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-sm flex items-center gap-1 transition-colors duration-300 ${
                        isDarkMode ? 'text-green-300' : 'text-black'
                      }`}>
                        <CheckCircle className={`w-4 h-4 transition-colors duration-300 ${
                          isDarkMode ? 'text-green-400' : 'text-black'
                        }`} />
                        완료
                      </div>
                      {isAdminMode && onMovePatientToRoom && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => onMovePatientToRoom(patient.id, 'Angio 1R')}
                            className={`px-2 py-1 text-xs rounded transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30' 
                                : 'bg-blue-100 border border-blue-300 text-blue-700 hover:bg-blue-200'
                            }`}
                            title="Angio 1R로 이동"
                          >
                            1R
                          </button>
                          <button
                            onClick={() => onMovePatientToRoom(patient.id, 'Angio 2R')}
                            className={`px-2 py-1 text-xs rounded transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30' 
                                : 'bg-blue-100 border border-blue-300 text-blue-700 hover:bg-blue-200'
                            }`}
                            title="Angio 2R로 이동"
                          >
                            2R
                          </button>
                          <button
                            onClick={() => onMovePatientToRoom(patient.id, 'Hybrid Room')}
                            className={`px-2 py-1 text-xs rounded transition-colors duration-300 ${
                              isDarkMode 
                                ? 'bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30' 
                                : 'bg-purple-100 border border-purple-300 text-purple-700 hover:bg-purple-200'
                            }`}
                            title="Hybrid Room으로 이동"
                          >
                            HR
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className={`p-4 text-center transition-colors duration-300 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <CheckCircle className={`w-8 h-8 mx-auto mb-2 transition-colors duration-300 ${
                isDarkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <p className="text-sm">완료된 환자가 없습니다</p>
              {isAdminMode && (
                <p className="text-xs mt-1 opacity-70">환자를 '완료' 상태로 변경하면 여기에 표시됩니다</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 전체 통계 */}
      <div className={`backdrop-blur-md rounded-2xl p-3  border transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-black/40 border-gray-700' 
          : 'bg-white/90 border-gray-300'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <Users className={`w-6 h-6 transition-colors duration-300 ${
            isDarkMode ? 'text-purple-400' : 'text-purple-600'
          }`} />
          <h3 className={`text-2xl font-semibold transition-colors duration-300 ${
            isDarkMode ? 'text-white' : 'text-black'
          }`}>전체 통계</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          <div className={`flex items-center justify-between p-2 rounded-lg border transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-purple-900/20 border-purple-700/30' 
              : 'bg-purple-50 border-purple-200'
          }`}>
            <div className="flex items-center gap-3">
              <Users className={`w-4 h-4 transition-colors duration-300 ${
                isDarkMode ? 'text-purple-400' : 'text-black'
              }`} />
              <span className={`text-base transition-colors duration-300 ${
                isDarkMode ? 'text-purple-300' : 'text-black'
              }`}>총 환자</span>
            </div>
            <div className={`text-2xl font-bold transition-colors duration-300 ${
              isDarkMode ? 'text-purple-300' : 'text-black'
            }`}>{patients.length}명</div>
          </div>
        </div>
      </div>

      {/* 오늘 당직 (전체 통계와 동일한 레이아웃) */}
      <div className={`backdrop-blur-md rounded-2xl p-3  border transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-black/40 border-gray-700' 
          : 'bg-white/90 border-gray-300'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <Users className={`w-6 h-6 transition-colors duration-300 ${
            isDarkMode ? 'text-orange-400' : 'text-orange-600'
          }`} />
          <h3 className={`text-2xl font-semibold transition-colors duration-300 ${
            isDarkMode ? 'text-white' : 'text-black'
          }`}>오늘 당직</h3>
          {isAdminMode && (
            <div className={`text-xs font-medium transition-colors duration-300 ${
              isDarkMode ? 'text-orange-400' : 'text-orange-600'
            }`}>
              편집 가능
            </div>
          )}
        </div>
        
                <div className="grid grid-cols-1 gap-3">
          {/* Doctor */}
          <div className={`flex items-center justify-between p-2 rounded-lg border group transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-blue-900/20 border-blue-700/30' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center gap-3">
              <Users className={`w-4 h-4 transition-colors duration-300 ${
                isDarkMode ? 'text-blue-400' : 'text-black'
              }`} />
              <span className={`text-base transition-colors duration-300 ${
                isDarkMode ? 'text-blue-300' : 'text-black'
              }`}>Doctor</span>
            </div>
            {editingStaff === 'Doctor' ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={`px-2 py-1 rounded text-sm w-20 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'bg-gray-800 text-white border border-gray-600' 
                      : 'bg-white text-black border border-gray-300'
                  }`}
                  onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                  autoFocus
                />
                <button
                  onClick={saveEdit}
                  className={`p-1 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'text-green-400 hover:text-green-300' 
                      : 'text-green-600 hover:text-green-700'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={cancelEdit}
                  className={`p-1 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'text-red-400 hover:text-red-300' 
                      : 'text-red-600 hover:text-red-700'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className={`text-base font-bold transition-colors duration-300 ${
                  isDarkMode ? 'text-blue-300' : 'text-black'
                }`}>{dutyStaff.Doctor}</div>
                {isAdminMode && (
                  <button
                    onClick={() => startEdit('Doctor')}
                    className="p-1 text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* RN */}
          <div className={`flex items-center justify-between p-2 rounded-lg border group transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-green-900/20 border-green-700/30' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center gap-3">
              <Users className={`w-4 h-4 transition-colors duration-300 ${
                isDarkMode ? 'text-green-400' : 'text-black'
              }`} />
              <span className={`text-base transition-colors duration-300 ${
                isDarkMode ? 'text-green-300' : 'text-black'
              }`}>RN</span>
            </div>
            {editingStaff === 'RN' ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={`px-2 py-1 rounded text-sm w-20 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'bg-gray-800 text-white border border-gray-600' 
                      : 'bg-white text-black border border-gray-300'
                  }`}
                  onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                  autoFocus
                />
                <button
                  onClick={saveEdit}
                  className={`p-1 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'text-green-400 hover:text-green-300' 
                      : 'text-green-600 hover:text-green-700'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={cancelEdit}
                  className={`p-1 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'text-red-400 hover:text-red-300' 
                      : 'text-red-600 hover:text-red-700'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className={`text-base font-bold transition-colors duration-300 ${
                  isDarkMode ? 'text-green-300' : 'text-black'
                }`}>{dutyStaff.RN}</div>
                {isAdminMode && (
                  <button
                    onClick={() => startEdit('RN')}
                    className="p-1 text-green-400 hover:text-green-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* RT */}
          <div className={`flex items-center justify-between p-2 rounded-lg border group transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-purple-900/20 border-purple-700/30' 
              : 'bg-purple-50 border-purple-200'
          }`}>
            <div className="flex items-center gap-3">
              <Users className={`w-4 h-4 transition-colors duration-300 ${
                isDarkMode ? 'text-purple-400' : 'text-black'
              }`} />
              <span className={`text-base transition-colors duration-300 ${
                isDarkMode ? 'text-purple-300' : 'text-black'
              }`}>RT</span>
            </div>
            {editingStaff === 'RT' ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={`px-2 py-1 rounded text-sm w-20 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'bg-gray-800 text-white border border-gray-600' 
                      : 'bg-white text-black border border-gray-300'
                  }`}
                  onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                  autoFocus
                />
                <button
                  onClick={saveEdit}
                  className={`p-1 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'text-green-400 hover:text-green-300' 
                      : 'text-green-600 hover:text-green-700'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={cancelEdit}
                  className={`p-1 transition-colors duration-300 ${
                    isDarkMode 
                      ? 'text-red-400 hover:text-red-300' 
                      : 'text-red-600 hover:text-red-700'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className={`text-base font-bold transition-colors duration-300 ${
                  isDarkMode ? 'text-purple-300' : 'text-black'
                }`}>{dutyStaff.RT}</div>
                {isAdminMode && (
                  <button
                    onClick={() => startEdit('RT')}
                    className="p-1 text-purple-400 hover:text-purple-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  )
}

export default PatientSummary

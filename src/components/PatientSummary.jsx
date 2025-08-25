import React from 'react'
import { Users, Clock, CheckCircle, AlertCircle } from 'lucide-react'

const PatientSummary = ({ patients, isPrivacyMode }) => {
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

  // 상태별 환자 분류
  const waitingPatients = patients.filter(p => p.status === 'waiting')
  const procedurePatients = patients.filter(p => p.status === 'procedure')
  const completedPatients = patients.filter(p => p.status === 'completed')

  return (
    <div className="space-y-4">
      {/* 대기 중 환자 */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl p-3 board-shadow border border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-6 h-6 text-blue-400" />
          <h3 className="text-2xl font-semibold text-white">대기 중 환자</h3>
          <span className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-base font-bold">
            {waitingPatients.length}명
          </span>
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {waitingPatients.length > 0 && (
            waitingPatients
              .sort((a, b) => (b.wait_time || b.waitTime || 0) - (a.wait_time || a.waitTime || 0)) // 대기시간 긴 순서
              .map((patient) => (
                <div key={patient.id} className="p-2 bg-blue-900/20 rounded-lg border border-blue-700/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <div>
                        <div className="text-base font-semibold text-blue-200">
                          {maskPersonalInfo(patient.patient_id || patient.number, 'number')} {maskPersonalInfo(patient.patient_name || patient.name, 'name')}
                        </div>
                        {(patient.assigned_doctor || patient.doctor) && (
                          <div className="text-sm text-blue-300/70">{patient.assigned_doctor || patient.doctor}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-blue-300 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {patient.wait_time || patient.waitTime || 0}분
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>



      {/* 완료된 환자 */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl p-3 board-shadow border border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <h3 className="text-2xl font-semibold text-white">완료된 환자</h3>
          <span className="bg-green-600/20 text-green-300 px-3 py-1 rounded-full text-base font-bold">
            {completedPatients.length}명
          </span>
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {completedPatients.length > 0 && (
            completedPatients
              .sort((a, b) => b.id - a.id) // 최근 완료 순서
              .map((patient) => (
                <div key={patient.id} className="p-2 bg-green-900/20 rounded-lg border border-green-700/30 opacity-80">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <div>
                        <div className="text-base font-semibold text-green-200">
                          {maskPersonalInfo(patient.patient_id || patient.number, 'number')} {maskPersonalInfo(patient.patient_name || patient.name, 'name')}
                        </div>
                        {(patient.assigned_doctor || patient.doctor) && (
                          <div className="text-sm text-green-300/70">{patient.assigned_doctor || patient.doctor}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-green-300 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      완료
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* 전체 통계 */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl p-3 board-shadow border border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-6 h-6 text-purple-400" />
          <h3 className="text-2xl font-semibold text-white">전체 통계</h3>
        </div>
        
                <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center justify-between p-2 bg-purple-900/20 rounded-lg border border-purple-700/30">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-base text-purple-300">총 환자</span>
            </div>
            <div className="text-2xl font-bold text-purple-300">{patients.length}명</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PatientSummary

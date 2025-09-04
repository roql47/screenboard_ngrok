import { io } from 'socket.io-client';

const getServerURL = () => {
  // 로컬 개발 환경인지 확인
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🏠 백엔드 서버 URL (로컬):', 'http://localhost:3001');
    return 'http://localhost:3001';
  } else {
    // ngrok을 통해 접속한 경우, 현재 도메인을 기반으로 백엔드 URL 생성
    // 프론트엔드가 https://abc123.ngrok-free.app라면
    // 백엔드는 포트를 3001로 변경해서 접근
    const currentUrl = window.location.origin;
    const backendUrl = currentUrl.replace(':5173', ':3001').replace(/:\d+/, '') + ':3001';
    
    // ngrok 백엔드 터널 URL
    const ngrokBackendUrl = 'https://b62c635d9f86.ngrok.app';
    
    console.log('🌐 백엔드 서버 URL (ngrok):', ngrokBackendUrl);
    return ngrokBackendUrl;
  }
};

const SERVER_URL = getServerURL();

class SocketManager {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    console.log('서버 연결 시도:', SERVER_URL);

    this.socket = io(SERVER_URL, {
      transports: ['polling'], // ngrok에서는 polling만 사용 (더 안정적)
      timeout: 30000,
      forceNew: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      maxReconnectionAttempts: 10,
      // ngrok 호환성을 위한 설정 (업그레이드 비활성화)
      upgrade: false,
      rememberUpgrade: false,
      pingTimeout: 120000, // ngrok 타임아웃 고려하여 증가
      pingInterval: 30000,
      // ngrok 브라우저 경고 우회
      extraHeaders: {
        'ngrok-skip-browser-warning': 'true'
      }
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket 서버에 연결되었습니다:', this.socket.id);
      console.log('사용 중인 전송 방식:', this.socket.io.engine.transport.name);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ 서버 연결이 끊어졌습니다. 이유:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔴 Socket.IO 연결 오류:', error);
      console.log('연결 시도 URL:', SERVER_URL);
      console.log('사용 중인 전송 방식:', this.socket.io.opts.transports);
    });

    this.socket.on('error', (error) => {
      console.error('🔴 Socket.IO 일반 오류:', error);
    });

    // 전송 방식 변경 감지
    this.socket.io.on('upgrade', () => {
      console.log('🚀 WebSocket으로 업그레이드됨:', this.socket.io.engine.transport.name);
    });

    this.socket.io.on('upgradeError', (error) => {
      console.error('⚠️ WebSocket 업그레이드 실패:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 이벤트 리스너 등록
  on(event, callback) {
    if (!this.socket) {
      this.connect();
    }
    
    this.socket.on(event, callback);
    
    // 리스너 추적을 위해 저장
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // 이벤트 리스너 제거
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
    
    // 리스너 목록에서 제거
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 이벤트 발송
  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // API 호출 헬퍼 함수들
  async fetchDoctors() {
    try {
      const response = await fetch(`${SERVER_URL}/api/doctors`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('의사 데이터 조회 실패:', error);
      return [];
    }
  }

  async fetchPatients() {
    try {
      console.log('환자 데이터 요청 URL:', `${SERVER_URL}/api/patients`);
      const response = await fetch(`${SERVER_URL}/api/patients`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json'
        }
      });
      console.log('환자 데이터 응답 상태:', response.status);
      const data = await response.json();
      console.log('환자 데이터 수신 성공:', data);
      return data;
    } catch (error) {
      console.error('환자 데이터 조회 실패:', error);
      return [];
    }
  }

  async fetchStats() {
    try {
      const response = await fetch(`${SERVER_URL}/api/stats`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('통계 데이터 조회 실패:', error);
      return {};
    }
  }

  async updateDoctorStatus(doctorId, status, currentPatient = null) {
    try {
      const response = await fetch(`${SERVER_URL}/api/doctors/${doctorId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status, 
          current_patient: currentPatient 
        }),
      });
      return await response.json();
    } catch (error) {
      console.error('의사 상태 업데이트 실패:', error);
      throw error;
    }
  }

  async updatePatientStatus(patientId, status, assignedDoctor = null) {
    try {
      console.log('🌐 API 호출: 환자 상태 업데이트', { patientId, status, assignedDoctor });
      
      const response = await fetch(`${SERVER_URL}/api/patients/${patientId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ 
          status, 
          assigned_doctor: assignedDoctor 
        }),
      });

      const result = await response.json();
      console.log('📥 API 응답:', result);

      if (!response.ok) {
        throw new Error(result.error || 'API 호출 실패');
      }

      return result;
    } catch (error) {
      console.error('환자 상태 업데이트 실패:', error);
      throw error;
    }
  }

  async addPatient(patientData) {
    try {
      console.log('🌐 API 호출: 환자 추가', patientData);
      
      const response = await fetch(`${SERVER_URL}/api/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(patientData),
      });
      
      const result = await response.json();
      console.log('📥 API 응답:', result);
      
      if (!response.ok) {
        throw new Error(result.error || 'API 호출 실패');
      }
      
      return result;
    } catch (error) {
      console.error('환자 추가 실패:', error);
      throw error;
    }
  }

  async deletePatient(patientId) {
    try {
      console.log('🌐 API 호출: 환자 삭제', patientId);
      
      const response = await fetch(`${SERVER_URL}/api/patients/${patientId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      const result = await response.json();
      console.log('📥 API 응답:', result);

      if (!response.ok) {
        throw new Error(result.error || 'API 호출 실패');
      }

      return result;
    } catch (error) {
      console.error('환자 삭제 실패:', error);
      throw error;
    }
  }

  async updatePatientProcedure(patientId, newProcedure) {
    try {
      console.log('🏥 API 호출: 시술명 업데이트', { patientId, newProcedure });
      
      // 백엔드에는 Socket.IO를 통해 전송 (기존 방식 유지)
      this.emit('admin_action', {
        type: 'update_patient_procedure',
        patientId,
        newProcedure,
        timestamp: new Date()
      });
      
      console.log('✅ 시술명 업데이트 전송 완료');
      return { success: true };
    } catch (error) {
      console.error('시술명 업데이트 실패:', error);
      throw error;
    }
  }

  async updatePatientNotes(patientId, newNotes) {
    try {
      console.log('📝 API 호출: 비고 업데이트', { patientId, newNotes });
      
      // 백엔드에는 Socket.IO를 통해 전송
      this.emit('admin_action', {
        type: 'update_patient_notes',
        patientId,
        newNotes,
        timestamp: new Date()
      });
      
      console.log('✅ 비고 업데이트 전송 완료');
      return { success: true };
    } catch (error) {
      console.error('비고 업데이트 실패:', error);
      throw error;
    }
  }

  async updatePatientGenderAge(patientId, newGenderAge) {
    try {
      console.log('👤 API 호출: 성별/나이 업데이트', { patientId, newGenderAge });
      
      this.emit('admin_action', {
        type: 'update_patient_gender_age',
        patientId,
        newGenderAge,
        timestamp: new Date()
      });
      
      console.log('✅ 성별/나이 업데이트 전송 완료');
      return { success: true };
    } catch (error) {
      console.error('성별/나이 업데이트 실패:', error);
      throw error;
    }
  }

  async updatePatientWard(patientId, newWard) {
    try {
      console.log('🏥 API 호출: 병동 업데이트', { patientId, newWard });
      
      this.emit('admin_action', {
        type: 'update_patient_ward',
        patientId,
        newWard,
        timestamp: new Date()
      });
      
      console.log('✅ 병동 업데이트 전송 완료');
      return { success: true };
    } catch (error) {
      console.error('병동 업데이트 실패:', error);
      throw error;
    }
  }

  async reorderPatients(patientOrders) {
    try {
      console.log('🔄 API 호출: 환자 순서 변경', patientOrders);
      
      this.emit('admin_action', {
        type: 'reorder_patients',
        patientOrders,
        timestamp: new Date()
      });
      
      console.log('✅ 환자 순서 변경 전송 완료');
      return { success: true };
    } catch (error) {
      console.error('환자 순서 변경 실패:', error);
      throw error;
    }
  }

  async fetchSchedule() {
    try {
      console.log('📅 스케줄 데이터 요청 URL:', `${SERVER_URL}/api/schedule`);
      const response = await fetch(`${SERVER_URL}/api/schedule`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json'
        }
      });
      console.log('📅 스케줄 데이터 응답 상태:', response.status);
      const data = await response.json();
      console.log('📅 스케줄 데이터 수신 성공:', data);
      return data;
    } catch (error) {
      console.error('스케줄 데이터 조회 실패:', error);
      return {};
    }
  }

  async updateSchedule(schedule) {
    try {
      console.log('🌐 API 호출: 스케줄 업데이트', schedule);
      
      const response = await fetch(`${SERVER_URL}/api/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ schedule }),
      });
      
      const result = await response.json();
      console.log('📥 API 응답:', result);
      
      if (!response.ok) {
        throw new Error(result.error || 'API 호출 실패');
      }
      
      return result;
    } catch (error) {
      console.error('스케줄 업데이트 실패:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스 생성
// 로그인 API
export const login = async (credentials) => {
  try {
    console.log('🔐 로그인 요청 시작:', `${getServerURL()}/api/login`)
    
    const response = await fetch(`${getServerURL()}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json'
      },
      body: JSON.stringify(credentials),
    })
    
    console.log('📡 응답 상태:', response.status, response.statusText)
    console.log('📡 응답 헤더:', response.headers.get('content-type'))
    
    // HTML 응답인지 확인
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await response.text()
      console.error('❌ HTML 응답 수신:', textResponse.substring(0, 200))
      throw new Error('서버에서 HTML을 반환했습니다. 백엔드 서버가 실행 중인지 확인하세요.')
    }
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.message || '로그인 실패')
    }
    
    return data
  } catch (error) {
    console.error('🔥 로그인 API 오류:', error)
    throw error
  }
}

// 토큰 검증 API
export const verifyToken = async (token) => {
  const response = await fetch(`${getServerURL()}/api/verify-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ token }),
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.message || '토큰 검증 실패')
  }
  
  return data
}

// 당직 의료진 조회 API
export const fetchDutyStaff = async () => {
  try {
    const response = await fetch(`${getServerURL()}/api/duty`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ 당직 의료진 조회 성공:', data);
    return data;
  } catch (error) {
    console.error('❌ 당직 의료진 조회 실패:', error);
    throw error;
  }
}

// 당직 의료진 업데이트 API
export const updateDutyStaff = async (dutyStaff) => {
  try {
    const response = await fetch(`${getServerURL()}/api/duty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ dutyStaff }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ 당직 의료진 업데이트 성공:', data);
    return data;
  } catch (error) {
    console.error('❌ 당직 의료진 업데이트 실패:', error);
    throw error;
  }
}

const socketManager = new SocketManager();

export default socketManager;

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173", 
      "https://4a2021e0c8f0.ngrok-free.app", // 현재 프론트엔드 ngrok URL
      "https://d606ec20e07d.ngrok-free.app", // 현재 백엔드 ngrok URL
      /^https:\/\/.*\.ngrok-free\.app$/,
      /^https:\/\/.*\.loca\.lt$/
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  // ngrok 호환성을 위한 설정 (polling만 사용)
  transports: ['polling'],
  allowEIO3: true,
  pingTimeout: 120000, // ngrok 타임아웃 고려
  pingInterval: 30000
});

// 미들웨어 설정
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://4a2021e0c8f0.ngrok-free.app", // 현재 프론트엔드 ngrok URL
    "https://d606ec20e07d.ngrok-free.app", // 현재 백엔드 ngrok URL
    /^https:\/\/.*\.ngrok-free\.app$/,
    /^https:\/\/.*\.loca\.lt$/
  ],
  credentials: true
}));
app.use(express.json());

// SQLite 데이터베이스 설정
const dbPath = path.join(__dirname, 'hospital.db');
const db = new sqlite3.Database(dbPath);

// 데이터베이스 테이블 생성
db.serialize(() => {
  // 의사 테이블
  db.run(`CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    current_patient TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 환자 대기열 테이블
  db.run(`CREATE TABLE IF NOT EXISTS patient_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    department TEXT NOT NULL,
    priority INTEGER DEFAULT 1,
    status TEXT DEFAULT 'waiting',
    assigned_doctor TEXT,
    wait_time INTEGER DEFAULT 0,
    procedure_start_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 병원 통계 테이블
  db.run(`CREATE TABLE IF NOT EXISTS hospital_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_patients INTEGER DEFAULT 0,
    waiting_patients INTEGER DEFAULT 0,
    in_treatment INTEGER DEFAULT 0,
    completed_today INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 외래 진료 스케줄 테이블
  db.run(`CREATE TABLE IF NOT EXISTS doctor_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week TEXT NOT NULL,
    time_period TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    position_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 초기 데이터 삽입
  db.get("SELECT COUNT(*) as count FROM doctors", (err, row) => {
    if (row.count === 0) {
      const doctors = [
        ['김철수', 'Angio 1R', 'available'],
        ['이영희', 'Angio 2R', 'busy'],
        ['박민수', 'Hybrid Room', 'available'],
        ['정수진', 'Angio 1R', 'break'],
        ['최동욱', 'Angio 2R', 'available']
      ];

      const stmt = db.prepare("INSERT INTO doctors (name, department, status) VALUES (?, ?, ?)");
      doctors.forEach(doctor => {
        stmt.run(doctor);
      });
      stmt.finalize();
    }
  });

  // 기존 하드코딩된 환자 데이터 삭제 (한 번만 실행)
  db.run(`DELETE FROM patient_queue WHERE 
    patient_id IN ('P001', 'P002', 'P003', 'P004', 'P005') OR
    patient_name IN ('홍길동', '김영수', '이미영', '박준호', '정민아')`, (err) => {
    if (!err) {
      console.log('기존 하드코딩된 환자 데이터 삭제 완료');
    }
  });

  // 초기 환자 데이터는 추가하지 않음 - 실제 환자만 표시

  // 초기 통계 데이터 - 실제 데이터로 시작
  db.get("SELECT COUNT(*) as count FROM hospital_stats", (err, row) => {
    if (row.count === 0) {
      db.run("INSERT INTO hospital_stats (total_patients, waiting_patients, in_treatment, completed_today) VALUES (0, 0, 0, 0)");
    }
  });

  // 초기 외래 진료 스케줄 데이터
  db.get("SELECT COUNT(*) as count FROM doctor_schedule", (err, row) => {
    if (row.count === 0) {
      const scheduleData = [
        // 월요일
        ['월', '오전', '김영상', 0],
        ['월', '오전', '이영상', 1],
        ['월', '오전', '박민수', 2],
        ['월', '오후', '박영상', 0],
        ['월', '오후', '최영상', 1],
        ['월', '오후', '정현우', 2],
        // 화요일
        ['화', '오전', '이영상', 0],
        ['화', '오전', '박영상', 1],
        ['화', '오전', '강지연', 2],
        ['화', '오후', '김영상', 0],
        ['화', '오후', '정영상', 1],
        ['화', '오후', '윤서준', 2],
        // 수요일
        ['수', '오전', '박영상', 0],
        ['수', '오전', '최영상', 1],
        ['수', '오전', '장하늘', 2],
        ['수', '오후', '이영상', 0],
        ['수', '오후', '김영상', 1],
        ['수', '오후', '조예린', 2],
        // 목요일
        ['목', '오전', '최영상', 0],
        ['목', '오전', '정영상', 1],
        ['목', '오전', '김철수', 2],
        ['목', '오후', '박영상', 0],
        ['목', '오후', '이영상', 1],
        ['목', '오후', '이영희', 2],
        // 금요일
        ['금', '오전', '정영상', 0],
        ['금', '오전', '김영상', 1],
        ['금', '오전', '최수진', 2],
        ['금', '오후', '최영상', 0],
        ['금', '오후', '박영상', 1],
        ['금', '오후', '박민수', 2]
      ];

      const stmt = db.prepare("INSERT INTO doctor_schedule (day_of_week, time_period, doctor_name, position_index) VALUES (?, ?, ?, ?)");
      scheduleData.forEach(schedule => {
        stmt.run(schedule);
      });
      stmt.finalize();
      console.log('초기 외래 진료 스케줄 데이터 삽입 완료');
    }
  });

  // 기존 테이블에 procedure_start_time 컬럼 추가 (마이그레이션)
  db.run("ALTER TABLE patient_queue ADD COLUMN procedure_start_time DATETIME", (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('procedure_start_time 컬럼 추가 실패:', err.message);
    }
  });

  // 기존 테이블에 doctor 컬럼 추가 (마이그레이션)
  db.run("ALTER TABLE patient_queue ADD COLUMN doctor TEXT", (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('doctor 컬럼 추가 실패:', err.message);
    }
  });

  // Angio 3R을 Hybrid Room으로 변경 (마이그레이션)
  db.run("UPDATE doctors SET department = 'Hybrid Room' WHERE department = 'Angio 3R'", (err) => {
    if (!err) {
      console.log('Angio 3R → Hybrid Room 업데이트 완료');
    }
  });

  // 환자 대기열의 department도 업데이트
  db.run("UPDATE patient_queue SET department = 'Hybrid Room' WHERE department = 'Angio 3R'", (err) => {
    if (!err) {
      console.log('환자 대기열 Angio 3R → Hybrid Room 업데이트 완료');
    }
  });
});

// API 엔드포인트들
app.get('/api/doctors', (req, res) => {
  db.all("SELECT * FROM doctors ORDER BY department", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/patients', (req, res) => {
  db.all("SELECT * FROM patient_queue ORDER BY priority DESC, created_at ASC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/stats', (req, res) => {
  db.get("SELECT * FROM hospital_stats ORDER BY updated_at DESC LIMIT 1", (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row || {});
  });
});

// 외래 진료 스케줄 조회
app.get('/api/schedule', (req, res) => {
  db.all("SELECT * FROM doctor_schedule ORDER BY day_of_week, time_period, position_index", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 데이터를 프론트엔드 형식으로 변환
    const schedule = {};
    const days = ['월', '화', '수', '목', '금'];
    const times = ['오전', '오후'];
    
    // 빈 스케줄 구조 초기화
    days.forEach(day => {
      schedule[day] = {};
      times.forEach(time => {
        schedule[day][time] = [];
      });
    });
    
    // 데이터 채우기
    rows.forEach(row => {
      if (schedule[row.day_of_week] && schedule[row.day_of_week][row.time_period]) {
        schedule[row.day_of_week][row.time_period][row.position_index] = row.doctor_name;
      }
    });
    
    res.json(schedule);
  });
});

// 외래 진료 스케줄 업데이트
app.post('/api/schedule', (req, res) => {
  const { schedule } = req.body;
  
  if (!schedule) {
    return res.status(400).json({ error: 'Schedule data is required' });
  }
  
  // 기존 스케줄 데이터 삭제 후 새로 삽입
  db.run("DELETE FROM doctor_schedule", (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const stmt = db.prepare("INSERT INTO doctor_schedule (day_of_week, time_period, doctor_name, position_index) VALUES (?, ?, ?, ?)");
    
    Object.keys(schedule).forEach(day => {
      Object.keys(schedule[day]).forEach(time => {
        schedule[day][time].forEach((doctorName, index) => {
          if (doctorName && doctorName.trim()) {
            stmt.run([day, time, doctorName.trim(), index]);
          }
        });
      });
    });
    
    stmt.finalize((err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      console.log('📅 외래 진료 스케줄 업데이트 완료');
      
      // 모든 클라이언트에게 스케줄 업데이트 알림
      io.emit('schedule_updated', schedule);
      
      res.json({ message: 'Schedule updated successfully', schedule });
    });
  });
});

// 관리자 대시보드 API
app.get('/api/admin/clients', (req, res) => {
  const clientsInfo = Array.from(connectedClients.values()).map(client => ({
    id: client.id,
    connectedAt: client.connectedAt,
    lastActivity: client.lastActivity,
    userAgent: client.userAgent,
    ipAddress: client.ipAddress,
    lastAction: client.lastAction || null
  }));
  
  res.json({
    totalClients: connectedClients.size,
    clients: clientsInfo,
    serverStartTime: new Date() // 서버 시작 시간 (임시)
  });
});

// 서버 상태 API
app.get('/api/admin/server-status', (req, res) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    connectedClients: connectedClients.size,
    serverTime: new Date(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

// 데이터베이스 백업 API
app.get('/api/admin/backup', (req, res) => {
  const backupData = {
    timestamp: new Date(),
    doctors: [],
    patients: [],
    stats: null
  };
  
  // 모든 데이터 조회
  db.all("SELECT * FROM doctors", (err, doctors) => {
    if (!err) backupData.doctors = doctors;
    
    db.all("SELECT * FROM patient_queue", (err, patients) => {
      if (!err) backupData.patients = patients;
      
      db.get("SELECT * FROM hospital_stats ORDER BY updated_at DESC LIMIT 1", (err, stats) => {
        if (!err) backupData.stats = stats;
        
        res.json(backupData);
      });
    });
  });
});

// 의사 상태 업데이트
app.post('/api/doctors/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, current_patient } = req.body;
  
  db.run(
    "UPDATE doctors SET status = ?, current_patient = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [status, current_patient, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 실시간으로 모든 클라이언트에게 업데이트 전송
      io.emit('doctor_updated', { id, status, current_patient });
      res.json({ message: 'Doctor status updated' });
    }
  );
});

// 환자 상태 업데이트
app.post('/api/patients/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, assigned_doctor } = req.body;
  
  // 시술중으로 변경될 때 시작 시간 기록
  let updateQuery, updateParams;
  if (status === 'procedure') {
    console.log(`🕐 환자 ${id} 시술중 상태로 변경 - 시간 0분으로 초기화`);
    updateQuery = "UPDATE patient_queue SET status = ?, assigned_doctor = ?, procedure_start_time = CURRENT_TIMESTAMP, wait_time = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    updateParams = [status, assigned_doctor, id];
  } else if (status === 'waiting') {
    // 대기중으로 변경될 때 시작 시간 초기화
    console.log(`⏸️ 환자 ${id} 대기중 상태로 변경 - 시술 시간 초기화`);
    updateQuery = "UPDATE patient_queue SET status = ?, assigned_doctor = ?, procedure_start_time = NULL, wait_time = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    updateParams = [status, assigned_doctor, id];
  } else {
    // 완료 등 다른 상태
    console.log(`📝 환자 ${id} 상태 변경: ${status}`);
    updateQuery = "UPDATE patient_queue SET status = ?, assigned_doctor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    updateParams = [status, assigned_doctor, id];
  }
  
  db.run(
    updateQuery,
    updateParams,
    function(err) {
      if (err) {
        console.error('환자 상태 업데이트 실패:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 업데이트된 환자 정보를 다시 조회해서 전송
      db.get(
        "SELECT * FROM patient_queue WHERE id = ?",
        [id],
        (err, updatedPatient) => {
          if (err) {
            console.error('업데이트된 환자 조회 실패:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          
          if (updatedPatient) {
            console.log('✅ 환자 상태 업데이트 완료:', updatedPatient);
            
            // 실시간으로 모든 클라이언트에게 업데이트된 환자 정보 전송
            io.emit('patient_updated', updatedPatient);
            
            // 전체 환자 목록도 함께 전송하여 확실한 동기화
            db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
              if (!err) {
                io.emit('patients_data', allPatients);
              }
            });
            
            updateHospitalStats();
            res.json({ message: 'Patient status updated', patient: updatedPatient });
          } else {
            res.status(404).json({ error: 'Patient not found' });
          }
        }
      );
    }
  );
});

// 새 환자 추가
app.post('/api/patients', (req, res) => {
  const { patient_name, patient_id, department, assigned_doctor, doctor, priority } = req.body;
  
  console.log('🆕 새 환자 추가 요청:', { patient_name, patient_id, department, assigned_doctor, doctor, priority });
  
  // 중복 확인
  db.get(
    "SELECT id FROM patient_queue WHERE patient_id = ?",
    [patient_id],
    (err, existingPatient) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (existingPatient) {
        console.log('⚠️ 중복된 환자 ID:', patient_id);
        res.status(400).json({ error: '이미 존재하는 환자 ID입니다.' });
        return;
      }
      
      // 새 환자 추가
      db.run(
        "INSERT INTO patient_queue (patient_name, patient_id, department, assigned_doctor, doctor, priority) VALUES (?, ?, ?, ?, ?, ?)",
        [patient_name, patient_id, department, assigned_doctor, doctor, priority || 1],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          const newPatient = {
            id: this.lastID,
            patient_name,
            patient_id,
            department,
            assigned_doctor: assigned_doctor || null,
            doctor: doctor || null,
            priority: priority || 1,
            status: 'waiting',
            wait_time: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          console.log('✅ 새 환자 추가 완료:', newPatient);
          
          // 실시간으로 모든 클라이언트에게 새 환자 정보 전송
          io.emit('patient_added', newPatient);
          updateHospitalStats();
          res.json(newPatient);
        }
      );
    }
  );
});

// 환자 삭제
app.delete('/api/patients/:id', (req, res) => {
  const { id } = req.params;
  
  console.log('🗑️ 환자 삭제 요청:', id);
  
  db.run("DELETE FROM patient_queue WHERE id = ?", [id], function(err) {
    if (err) {
      console.error('환자 삭제 실패:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    console.log('✅ 환자 삭제 완료:', id);
    
    // 실시간으로 모든 클라이언트에게 삭제 알림
    io.emit('patient_deleted', { id: parseInt(id) });
    
    // 전체 환자 목록 재전송
    db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
      if (!err) {
        io.emit('patients_data', allPatients);
      }
    });
    
    updateHospitalStats();
    res.json({ message: 'Patient deleted successfully' });
  });
});

// 통계 업데이트 함수
function updateHospitalStats() {
  db.get(`
    SELECT 
      COUNT(*) as total_patients,
      COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_patients,
      COUNT(CASE WHEN status = 'procedure' THEN 1 END) as in_treatment,
      COUNT(CASE WHEN status = 'completed' AND DATE(updated_at) = DATE('now') THEN 1 END) as completed_today
    FROM patient_queue
  `, (err, stats) => {
    if (err) return;
    
    db.run(
      "UPDATE hospital_stats SET total_patients = ?, waiting_patients = ?, in_treatment = ?, completed_today = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
      [stats.total_patients, stats.waiting_patients, stats.in_treatment, stats.completed_today]
    );
    
    // 실시간으로 통계 업데이트 전송
    io.emit('stats_updated', stats);
  });
}

// 시술중 환자들의 대기시간 업데이트 함수
function updateProcedureWaitTimes() {
  db.all(`
    SELECT id, procedure_start_time 
    FROM patient_queue 
    WHERE status = 'procedure' AND procedure_start_time IS NOT NULL
  `, (err, patients) => {
    if (err) {
      console.error('시술중 환자 조회 실패:', err);
      return;
    }
    
    patients.forEach(patient => {
      const startTime = new Date(patient.procedure_start_time);
      const currentTime = new Date();
      const waitTimeMinutes = Math.floor((currentTime - startTime) / (1000 * 60));
      
      // 대기시간 업데이트
      db.run(
        "UPDATE patient_queue SET wait_time = ? WHERE id = ?",
        [waitTimeMinutes, patient.id],
        function(err) {
          if (err) {
            console.error('대기시간 업데이트 실패:', err);
          }
        }
      );
    });
    
    // 업데이트된 환자 데이터를 모든 클라이언트에게 전송
    db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
      if (!err) {
        io.emit('patients_data', allPatients);
      }
    });
  });
}

// 1분마다 시술중 환자들의 대기시간 업데이트
setInterval(updateProcedureWaitTimes, 60000); // 60초마다 실행

// 연결된 클라이언트 관리
const connectedClients = new Map();

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  const clientInfo = {
    id: socket.id,
    connectedAt: new Date(),
    lastActivity: new Date(),
    userAgent: socket.handshake.headers['user-agent'] || 'Unknown',
    ipAddress: socket.handshake.address
  };
  
  connectedClients.set(socket.id, clientInfo);
  console.log(`클라이언트가 연결되었습니다: ${socket.id} (총 ${connectedClients.size}개 연결)`);
  console.log(`클라이언트 정보:`, clientInfo);
  
  // 모든 클라이언트에게 연결 상태 알림
  io.emit('client_count_updated', {
    totalClients: connectedClients.size,
    connectedClients: Array.from(connectedClients.values())
  });
  
  // 클라이언트가 연결되면 현재 데이터 전송
  sendInitialDataToClient(socket);
  
  // 실시간 데이터 요청 처리
  socket.on('request_update', () => {
    updateClientActivity(socket.id);
    updateHospitalStats();
  });
  
  // 클라이언트 활동 추적
  socket.on('client_activity', (data) => {
    updateClientActivity(socket.id, data);
  });

  // 스케줄 브로드캐스트 이벤트 처리
  socket.on('schedule_broadcast', (data) => {
    console.log('📅 스케줄 브로드캐스트 수신:', data);
    console.log('📡 모든 클라이언트에게 스케줄 업데이트 전송');
    
    // 모든 클라이언트에게 스케줄 업데이트 전송
    io.emit('schedule_updated', data.schedule);
    
    console.log('✅ 스케줄 브로드캐스트 완료');
  });
  
  // 관리자 전용 이벤트
  socket.on('admin_action', (data) => {
    updateClientActivity(socket.id, { action: 'admin', data });
    console.log(`🔥 관리자 액션 수신 - ${socket.id}:`, data);
    console.log(`📡 현재 연결된 클라이언트 수: ${connectedClients.size}`);
    
    // 실시간 데이터 동기화 처리
    if (data.type === 'update_patient_name') {
      console.log(`🚀 환자 이름 업데이트를 모든 클라이언트에게 브로드캐스트: ${data.patientId} -> ${data.newName}`);
      // 모든 클라이언트에게 환자 이름 업데이트 전송 (본인 제외)
      socket.broadcast.emit('patient_name_updated', {
        patientId: data.patientId,
        newName: data.newName
      });
      // 모든 클라이언트에게 전송 (본인 포함)
      io.emit('patient_name_updated', {
        patientId: data.patientId,
        newName: data.newName
      });
    } else if (data.type === 'update_patient_number') {
      console.log(`🚀 환자 번호 업데이트를 모든 클라이언트에게 브로드캐스트: ${data.patientId} -> ${data.newNumber}`);
      // 모든 클라이언트에게 환자 번호 업데이트 전송
      io.emit('patient_number_updated', {
        patientId: data.patientId,
        newNumber: data.newNumber
      });
    } else if (data.type === 'update_patient_procedure') {
      console.log(`🏥 시술명 업데이트 요청 받음: 환자ID=${data.patientId}, 새시술명="${data.newProcedure}"`);
      
      // 먼저 기존 환자 정보 확인
      db.get("SELECT * FROM patient_queue WHERE id = ?", [data.patientId], (err, patient) => {
        if (err) {
          console.error('환자 조회 실패:', err);
          return;
        }
        
        if (!patient) {
          console.error('환자를 찾을 수 없음:', data.patientId);
          return;
        }
        
        console.log(`📋 기존 환자 정보: ${patient.patient_name}, 기존 시술명="${patient.assigned_doctor}"`);
        
        // 데이터베이스 업데이트
        db.run(
          "UPDATE patient_queue SET assigned_doctor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [data.newProcedure, data.patientId],
          function(err) {
            if (err) {
              console.error('❌ 시술명 데이터베이스 업데이트 실패:', err);
              return;
            }
            
            console.log(`✅ 시술명 데이터베이스 업데이트 성공: ${patient.patient_name} → "${data.newProcedure}"`);
            console.log(`📊 영향받은 행 수: ${this.changes}`);
            
            // 업데이트된 환자 정보 다시 조회
            db.get("SELECT * FROM patient_queue WHERE id = ?", [data.patientId], (err, updatedPatient) => {
              if (!err && updatedPatient) {
                console.log(`🔍 업데이트 확인: ${updatedPatient.patient_name}, 시술명="${updatedPatient.assigned_doctor}"`);
              }
            });
            
            // 모든 클라이언트에게 업데이트 전송
            io.emit('patient_procedure_updated', {
              patientId: data.patientId,
              newProcedure: data.newProcedure
            });
            
            // 전체 환자 목록도 다시 전송하여 확실한 동기화
            db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
              if (!err) {
                console.log(`📤 전체 환자 목록 재전송 (${allPatients.length}명)`);
                io.emit('patients_data', allPatients);
              }
            });
          }
        );
      });
    } else if (data.type === 'update_patient_doctor') {
      console.log(`👨‍⚕️ 담당의사 업데이트 요청 받음: 환자ID=${data.patientId}, 새담당의사="${data.newDoctor}"`);
      
      // 먼저 기존 환자 정보 확인
      db.get("SELECT * FROM patient_queue WHERE id = ?", [data.patientId], (err, patient) => {
        if (err) {
          console.error('환자 조회 실패:', err);
          return;
        }
        
        if (!patient) {
          console.error('환자를 찾을 수 없음:', data.patientId);
          return;
        }
        
        console.log(`📋 기존 환자 정보: ${patient.patient_name}, 기존 담당의사="${patient.doctor}"`);
        
        // 데이터베이스 업데이트
        db.run(
          "UPDATE patient_queue SET doctor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [data.newDoctor, data.patientId],
          function(err) {
            if (err) {
              console.error('❌ 담당의사 데이터베이스 업데이트 실패:', err);
              return;
            }
            
            console.log(`✅ 담당의사 데이터베이스 업데이트 성공: ${patient.patient_name} → "${data.newDoctor}"`);
            console.log(`📊 영향받은 행 수: ${this.changes}`);
            
            // 업데이트된 환자 정보 다시 조회
            db.get("SELECT * FROM patient_queue WHERE id = ?", [data.patientId], (err, updatedPatient) => {
              if (!err && updatedPatient) {
                console.log(`🔍 업데이트 확인: ${updatedPatient.patient_name}, 담당의사="${updatedPatient.doctor}"`);
              }
            });
            
            // 모든 클라이언트에게 업데이트 전송
            io.emit('patient_doctor_updated', {
              patientId: data.patientId,
              newDoctor: data.newDoctor
            });
            
            // 전체 환자 목록도 다시 전송하여 확실한 동기화
            db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
              if (!err) {
                console.log(`📤 전체 환자 목록 재전송 (${allPatients.length}명)`);
                io.emit('patients_data', allPatients);
              }
            });
          }
        );
      });
    } else if (data.type === 'move_patient_room') {
      console.log(`🏠 환자 방 이동 요청 받음: 환자ID=${data.patientId}, 새방="${data.newRoom}"`);
      
      // 먼저 기존 환자 정보 확인
      db.get("SELECT * FROM patient_queue WHERE id = ?", [data.patientId], (err, patient) => {
        if (err) {
          console.error('환자 조회 실패:', err);
          return;
        }
        
        if (!patient) {
          console.error('환자를 찾을 수 없음:', data.patientId);
          return;
        }
        
        console.log(`📋 기존 환자 정보: ${patient.patient_name}, 기존 방="${patient.department}"`);
        
        // 데이터베이스 업데이트
        db.run(
          "UPDATE patient_queue SET department = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [data.newRoom, data.patientId],
          function(err) {
            if (err) {
              console.error('❌ 방 이동 데이터베이스 업데이트 실패:', err);
              return;
            }
            
            console.log(`✅ 방 이동 데이터베이스 업데이트 성공: ${patient.patient_name} → "${data.newRoom}"`);
            console.log(`📊 영향받은 행 수: ${this.changes}`);
            
            // 업데이트된 환자 정보 다시 조회
            db.get("SELECT * FROM patient_queue WHERE id = ?", [data.patientId], (err, updatedPatient) => {
              if (!err && updatedPatient) {
                console.log(`🔍 업데이트 확인: ${updatedPatient.patient_name}, 방="${updatedPatient.department}"`);
              }
            });
            
            // 모든 클라이언트에게 업데이트 전송
            io.emit('patient_room_moved', {
              patientId: data.patientId,
              newRoom: data.newRoom
            });
            
            // 전체 환자 목록도 다시 전송하여 확실한 동기화
            db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
              if (!err) {
                console.log(`📤 전체 환자 목록 재전송 (${allPatients.length}명)`);
                io.emit('patients_data', allPatients);
              }
            });
          }
        );
      });
    }
  });

  // 직접 환자 정보 업데이트 이벤트 처리
  socket.on('patient_name_updated', (data) => {
    console.log(`📢 환자 이름 직접 업데이트 브로드캐스트: ${data.patientId} -> ${data.newName}`);
    socket.broadcast.emit('patient_name_updated', data);
  });
  
  socket.on('disconnect', () => {
    connectedClients.delete(socket.id);
    console.log(`클라이언트가 연결을 끊었습니다: ${socket.id} (총 ${connectedClients.size}개 연결)`);
    
    // 모든 클라이언트에게 연결 상태 업데이트
    io.emit('client_count_updated', {
      totalClients: connectedClients.size,
      connectedClients: Array.from(connectedClients.values())
    });
  });
});

// 초기 데이터 전송 함수
function sendInitialDataToClient(socket) {
  db.all("SELECT * FROM doctors ORDER BY department", (err, doctors) => {
    if (!err) socket.emit('doctors_data', doctors);
  });
  
  db.all("SELECT * FROM patient_queue ORDER BY priority DESC, created_at ASC", (err, patients) => {
    if (!err) socket.emit('patients_data', patients);
  });
  
  db.get("SELECT * FROM hospital_stats ORDER BY updated_at DESC LIMIT 1", (err, stats) => {
    if (!err) socket.emit('stats_data', stats);
  });
}

// 클라이언트 활동 업데이트
function updateClientActivity(socketId, activityData = {}) {
  if (connectedClients.has(socketId)) {
    const client = connectedClients.get(socketId);
    client.lastActivity = new Date();
    if (activityData) {
      client.lastAction = activityData;
    }
    connectedClients.set(socketId, client);
  }
}

// 주기적으로 통계 업데이트 (30초마다)
setInterval(() => {
  updateHospitalStats();
}, 30000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`API 엔드포인트: http://localhost:${PORT}/api`);
});

module.exports = { app, server, db };

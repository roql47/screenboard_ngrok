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
    origin: process.env.NODE_ENV === 'production' 
      ? true  // 프로덕션: 모든 origin 허용 (Nginx가 제어)
      : [
          "http://localhost:5173",  // 로컬 개발
          /^https:\/\/.*\.ngrok-free\.app$/,  // ngrok 테스트
          /^https:\/\/.*\.ngrok\.app$/,
          /^https:\/\/.*\.loca\.lt$/
        ],
    methods: ["GET", "POST"],
    credentials: true
  },
  // WebSocket 우선, 폴링 백업
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000, // 핑 타임아웃 단축 (더 빠른 응답)
  pingInterval: 5000 // 핑 간격 단축 (더 빠른 감지)
});

// 미들웨어 설정
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? true  // 프로덕션: 모든 origin 허용 (Nginx가 제어)
    : [
        "http://localhost:5173",  // 로컬 개발
        /^https:\/\/.*\.ngrok-free\.app$/,  // ngrok 테스트
        /^https:\/\/.*\.ngrok\.app$/,
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

  // 날짜별 당직 정보 테이블
  db.run(`CREATE TABLE IF NOT EXISTS doctor_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_date TEXT NOT NULL,
    doctor_name TEXT DEFAULT '',
    rn_name TEXT DEFAULT '',
    pa_name TEXT DEFAULT '',
    rt_name TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_date)
  )`);

  console.log('✅ 날짜별 당직 정보 테이블 생성 완료');

  // 기존 테이블에 PA 컬럼 추가 (마이그레이션)
  db.run(`ALTER TABLE doctor_schedules ADD COLUMN pa_name TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('PA 필드 추가 중 오류 (이미 존재할 수 있음):', err.message);
    } else if (!err) {
      console.log('✅ doctor_schedules 테이블에 PA(pa_name) 필드 추가 완료');
    }
  });

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
    notes TEXT DEFAULT '',
    added_at INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 기존 테이블에 added_at 컬럼 추가 (없을 경우에만)
  db.run(`ALTER TABLE patient_queue ADD COLUMN added_at INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('added_at 컬럼 추가 실패:', err);
    } else if (!err) {
      console.log('✅ added_at 컬럼 추가 완료');
    }
  });

  // 현지 시간 기준 오늘 날짜 함수 (시간대 문제 해결)
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 기존 테이블에 patient_date 컬럼 추가 (날짜별 환자 관리용)
  db.run(`ALTER TABLE patient_queue ADD COLUMN patient_date TEXT DEFAULT '${getTodayDate()}'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('patient_date 컬럼 추가 실패:', err);
    } else if (!err) {
      console.log('✅ patient_date 컬럼 추가 완료');
    }
  });

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

  // 당직 의료진 테이블
  db.run(`CREATE TABLE IF NOT EXISTS duty_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_type TEXT NOT NULL UNIQUE,
    staff_name TEXT NOT NULL,
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

  // 기존 테이블에 비고 필드 추가 (마이그레이션)
  db.run(`ALTER TABLE patient_queue ADD COLUMN notes TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('비고 필드 추가 중 오류 (이미 존재할 수 있음):', err.message);
    } else if (!err) {
      console.log('✅ patient_queue 테이블에 비고(notes) 필드 추가 완료');
    }
  });

  // 성별/나이 필드 추가 마이그레이션
  db.run(`ALTER TABLE patient_queue ADD COLUMN gender_age TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('성별/나이 필드 추가 중 오류 (이미 존재할 수 있음):', err.message);
    } else if (!err) {
      console.log('✅ patient_queue 테이블에 성별/나이(gender_age) 필드 추가 완료');
    }
  });

  // 병동 필드 추가 마이그레이션
  db.run(`ALTER TABLE patient_queue ADD COLUMN ward TEXT DEFAULT ''`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('병동 필드 추가 중 오류 (이미 존재할 수 있음):', err.message);
    } else if (!err) {
      console.log('✅ patient_queue 테이블에 병동(ward) 필드 추가 완료');
    }
  });

  // 환자 순서 필드 추가 마이그레이션
  db.run(`ALTER TABLE patient_queue ADD COLUMN display_order INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('순서 필드 추가 중 오류 (이미 존재할 수 있음):', err.message);
    } else if (!err) {
      console.log('✅ patient_queue 테이블에 순서(display_order) 필드 추가 완료');
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

  // 초기 당직 의료진 데이터
  db.get("SELECT COUNT(*) as count FROM duty_staff", (err, row) => {
    if (row.count === 0) {
      const dutyData = [
        ['Doctor', '김교수'],
        ['RN', '박간호사'],
        ['RT', '이방사선사']
      ];

      const stmt = db.prepare("INSERT INTO duty_staff (staff_type, staff_name) VALUES (?, ?)");
      dutyData.forEach(duty => {
        stmt.run(duty);
      });
      stmt.finalize();
      console.log('초기 당직 의료진 데이터 삽입 완료');
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
  const { date } = req.query;
  
  let query = "SELECT * FROM patient_queue";
  let params = [];
  
  if (date) {
    query += " WHERE patient_date = ?";
    params.push(date);
  } else {
    // 날짜가 지정되지 않으면 오늘 날짜의 환자만 조회
    const today = new Date().toISOString().split('T')[0];
    query += " WHERE patient_date = ?";
    params.push(today);
  }
  
  query += " ORDER BY department, display_order, priority DESC, created_at ASC";
  
  console.log('📅 환자 조회 요청:', { date: date || '오늘', query });
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    console.log('📅 환자 조회 결과:', rows.length, '명');
    res.json(rows);
  });
});

// 날짜별 환자 목록 조회 API
app.get('/api/patients/date/:date', (req, res) => {
  const { date } = req.params;
  
  console.log('📅 특정 날짜 환자 조회:', date);
  
  db.all(
    "SELECT * FROM patient_queue WHERE patient_date = ? ORDER BY department, display_order, priority DESC, created_at ASC",
    [date],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      console.log('📅 날짜별 환자 조회 결과:', date, rows.length, '명');
      res.json(rows);
    }
  );
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

// 날짜별 당직 의료진 조회
app.get('/api/duty', (req, res) => {
  const { date } = req.query;
  const targetDate = date || getTodayDate();
  
  db.get("SELECT * FROM doctor_schedules WHERE schedule_date = ?", [targetDate], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row) {
      // 날짜별 당직 정보가 있으면 반환
      res.json({
        doctor: row.doctor_name || '',
        rn: row.rn_name || '',
        pa: row.pa_name || '',
        rt: row.rt_name || ''
      });
    } else {
      // 데이터가 없으면 빈 값 반환
      res.json({
        doctor: '',
        rn: '',
        pa: '',
        rt: ''
      });
    }
  });
});

// 날짜별 당직 의료진 조회 (명시적 날짜)
app.get('/api/duty/date/:date', (req, res) => {
  const { date } = req.params;
  
  db.get("SELECT * FROM doctor_schedules WHERE schedule_date = ?", [date], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row) {
      res.json({
        doctor: row.doctor_name || '',
        rn: row.rn_name || '',
        pa: row.pa_name || '',
        rt: row.rt_name || ''
      });
    } else {
      res.json({
        doctor: '',
        rn: '',
        pa: '',
        rt: ''
      });
    }
  });
});

// 당직 의료진 업데이트
app.post('/api/duty', (req, res) => {
  const { dutyStaff } = req.body;
  
  if (!dutyStaff) {
    return res.status(400).json({ error: 'Duty staff data is required' });
  }
  
  console.log('🔥 당직 의료진 업데이트 요청:', dutyStaff);
  
  const stmt = db.prepare("INSERT OR REPLACE INTO duty_staff (staff_type, staff_name, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)");
  
  try {
    Object.keys(dutyStaff).forEach(staffType => {
      const staffName = dutyStaff[staffType];
      if (staffName && staffName.trim()) {
        stmt.run([staffType, staffName.trim()]);
        console.log(`✅ 당직 업데이트: ${staffType} = ${staffName.trim()}`);
      }
    });
    
    stmt.finalize();
    
    console.log('📡 당직 의료진 업데이트 브로드캐스트');
    io.emit('duty_updated', dutyStaff);
    
    res.json({ success: true, dutyStaff });
  } catch (error) {
    console.error('❌ 당직 의료진 업데이트 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// 날짜별 당직 의료진 업데이트 (새로운 API)
app.post('/api/duty/schedule', (req, res) => {
  const { dutyStaff, date } = req.body;
  const targetDate = date || getTodayDate();
  
  if (!dutyStaff) {
    return res.status(400).json({ error: 'Duty staff data is required' });
  }
  
  console.log(`🔥 ${targetDate} 당직 의료진 업데이트 요청:`, dutyStaff);
  
  const doctorName = dutyStaff.doctor || '';
  const rnName = dutyStaff.rn || '';
  const paName = dutyStaff.pa || '';
  const rtName = dutyStaff.rt || '';
  
  db.run(
    "INSERT OR REPLACE INTO doctor_schedules (schedule_date, doctor_name, rn_name, pa_name, rt_name, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [targetDate, doctorName, rnName, paName, rtName],
    function(err) {
      if (err) {
        console.error('❌ 당직 의료진 업데이트 실패:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      console.log(`✅ ${targetDate} 당직 의료진 업데이트 완료`);
      
      // 모든 클라이언트에게 업데이트 알림
      io.emit('duty_schedule_updated', {
        date: targetDate,
        dutyStaff: {
          doctor: doctorName,
          rn: rnName,
          pa: paName,
          rt: rtName
        }
      });
      
      res.json({ success: true, dutyStaff: { doctor: doctorName, rn: rnName, pa: paName, rt: rtName } });
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
    console.log(`🕐 환자 ${id} 시술중 상태로 변경 - 시간 0분으로 강제 초기화`);
    
    // 한국시간으로 현재 시간 생성
    const koreanTime = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Seoul'});
    console.log(`🕐 새로운 시작시간 설정: ${koreanTime} (한국시간)`);
    
    // 강제로 wait_time을 0으로 설정하고 시작시간을 한국시간으로 완전히 재설정
    updateQuery = "UPDATE patient_queue SET status = ?, assigned_doctor = ?, procedure_start_time = ?, wait_time = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    updateParams = [status, assigned_doctor, koreanTime, id];
    
    console.log(`🔥 환자 ${id} 데이터베이스 시술시간 강제 초기화 실행`);
    
    // 추가: 즉시 클라이언트에게 0분으로 브로드캐스트
    setTimeout(() => {
      console.log(`📡 환자 ${id} 시술시간 0분 브로드캐스트`);
      io.emit('patient_updated', { 
        id: parseInt(id), 
        status: status, 
        assigned_doctor: assigned_doctor,
        wait_time: 0,
        procedure_start_time: koreanTime
      });
    }, 100);
    
  } else if (status === 'waiting') {
    // 대기중으로 변경될 때 시작 시간 초기화
    console.log(`⏸️ 환자 ${id} 대기중 상태로 변경 - 시술 시간 완전 초기화`);
    updateQuery = "UPDATE patient_queue SET status = ?, assigned_doctor = ?, procedure_start_time = NULL, wait_time = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    updateParams = [status, assigned_doctor, id];
    
    // 추가: 즉시 클라이언트에게 초기화 브로드캐스트
    setTimeout(() => {
      console.log(`📡 환자 ${id} 대기시간 0분 브로드캐스트`);
      io.emit('patient_updated', { 
        id: parseInt(id), 
        status: status, 
        assigned_doctor: assigned_doctor,
        wait_time: 0,
        procedure_start_time: null
      });
    }, 100);
  } else if (status === 'completed') {
    // 완료로 변경될 때도 시작 시간 초기화
    console.log(`✅ 환자 ${id} 완료 상태로 변경 - 시술 시간 초기화`);
    updateQuery = "UPDATE patient_queue SET status = ?, assigned_doctor = ?, procedure_start_time = NULL, wait_time = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    updateParams = [status, assigned_doctor, id];
    
    // 추가: 즉시 클라이언트에게 초기화 브로드캐스트
    setTimeout(() => {
      console.log(`📡 환자 ${id} 완료 - 시술시간 초기화 브로드캐스트`);
      io.emit('patient_updated', { 
        id: parseInt(id), 
        status: status, 
        assigned_doctor: assigned_doctor,
        wait_time: 0,
        procedure_start_time: null
      });
    }, 100);
  } else {
    // 기타 다른 상태
    console.log(`📝 환자 ${id} 상태 변경: ${status}`);
    updateQuery = "UPDATE patient_queue SET status = ?, assigned_doctor = ?, procedure_start_time = NULL, wait_time = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
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
  const { patient_name, patient_id, department, assigned_doctor, doctor, priority, notes, gender_age, ward, patient_date } = req.body;
  
  // 환자 날짜 설정 (요청에서 온 날짜 또는 오늘 날짜)
  const patientDateToUse = patient_date || getTodayDate();
  
  console.log('🆕 새 환자 추가 요청:', { patient_name, patient_id, department, assigned_doctor, doctor, priority, notes, gender_age, ward, patient_date: patientDateToUse });
  
  // 🔥 같은 날짜 내에서만 중복 확인 (다른 날짜는 허용)
  db.get(
    "SELECT id FROM patient_queue WHERE patient_id = ? AND patient_date = ?",
    [patient_id, patientDateToUse],
    (err, existingPatient) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (existingPatient) {
        console.log('⚠️ 같은 날짜에 중복된 환자 ID:', patient_id, '날짜:', patientDateToUse);
        res.status(400).json({ error: `${patientDateToUse} 날짜에 이미 존재하는 환자 ID입니다.` });
        return;
      }
      
      console.log('✅ 중복 체크 통과 - 환자ID:', patient_id, '날짜:', patientDateToUse);
      
      // 같은 방의 현재 최대 순서 조회 후 새 환자 추가
      db.get(
        "SELECT MAX(display_order) as max_order FROM patient_queue WHERE department = ?",
        [department],
        (err, result) => {
          if (err) {
            console.error('최대 순서 조회 실패:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          
          const nextOrder = (result?.max_order || 0) + 1;
          
          // 새 환자 추가
          const patientDateToUse = patient_date || getTodayDate(); // 날짜가 없으면 오늘 날짜 사용 (현지 시간 기준)
          db.run(
            "INSERT INTO patient_queue (patient_name, patient_id, department, assigned_doctor, doctor, priority, notes, gender_age, ward, display_order, added_at, patient_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [patient_name, patient_id, department, assigned_doctor, doctor, priority || 1, notes || '', gender_age || '', ward || '', nextOrder, Date.now(), patientDateToUse],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          const addedAtTime = Date.now();
          const newPatient = {
            id: this.lastID,
            patient_name,
            patient_id,
            department,
            assigned_doctor: assigned_doctor || null,
            doctor: doctor || null,
            notes: notes || '', // 비고 필드 추가
            gender_age: gender_age || '', // 성별/나이 필드 추가
            ward: ward || '', // 병동 필드 추가
            priority: priority || 1,
            status: 'waiting',
            wait_time: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            added_at: addedAtTime, // 데이터베이스와 일치하도록 added_at 사용
            patient_date: patientDateToUse // 환자 날짜 추가
          };
          
          console.log('✅ 새 환자 추가 완료:', newPatient);
          
          // 실시간으로 모든 클라이언트에게 새 환자 정보 전송
          io.emit('patient_added', newPatient);
          
          // 전체 환자 목록도 함께 전송하여 확실한 동기화
          db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
            if (!err) {
              console.log(`📤 환자 추가 후 전체 목록 재전송 (${allPatients.length}명)`);
              io.emit('patients_data', allPatients);
            }
          });
          
          updateHospitalStats();
          res.json(newPatient);
          }
        );
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
      // 시간대 문제 완전 해결: 둘 다 문자열로 직접 계산
      const startTimeStr = patient.procedure_start_time; // '2025-08-25 07:05:40'
      const currentTimeStr = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Seoul'}); // '2025-08-25 07:06:40'
      
      console.log(`🔍 환자 ${patient.id} 시술시간 계산 (한국시간 직접계산):`);
      console.log(`   시작시간: ${startTimeStr} (한국시간)`);
      console.log(`   현재시간: ${currentTimeStr} (한국시간)`);
      
      // Date 객체 사용하지 않고 직접 시간 계산
      const parseDateTime = (dateTimeStr) => {
        // '2025-08-25 07:10:06' -> [2025, 8, 25, 7, 10, 6]
        const [datePart, timePart] = dateTimeStr.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        
        // 월은 0부터 시작하므로 -1
        return new Date(year, month - 1, day, hour, minute, second);
      };
      
      const startTime = parseDateTime(startTimeStr);
      const currentTime = parseDateTime(currentTimeStr);
      
      const waitTimeMinutes = Math.floor((currentTime - startTime) / (1000 * 60));
      
      console.log(`   시작 Date: ${startTime.toISOString()} (로컬시간 기준)`);
      console.log(`   현재 Date: ${currentTime.toISOString()} (로컬시간 기준)`);
      console.log(`   시간 차이: ${(currentTime - startTime) / (1000 * 60)} 분`);
      console.log(`   계산된 시간: ${waitTimeMinutes}분`);
      
      // 정상적인 대기시간 업데이트 (비정상 검증 제거)
      console.log(`⏰ 환자 ${patient.id} 시술시간 업데이트: ${waitTimeMinutes}분`);
      
      db.run(
        "UPDATE patient_queue SET wait_time = ? WHERE id = ?",
        [waitTimeMinutes, patient.id],
        function(err) {
          if (err) {
            console.error('대기시간 업데이트 실패:', err);
          } else {
            console.log(`✅ 환자 ${patient.id} 시술시간 ${waitTimeMinutes}분으로 업데이트 완료`);
            // 업데이트된 환자 정보를 모든 클라이언트에게 브로드캐스트
            io.emit('patient_updated', {
              id: patient.id,
              wait_time: waitTimeMinutes
            });
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

// 시술중 환자들의 대기시간 업데이트 (테스트용: 10초마다)
console.log('⏰ 시술시간 업데이트 타이머 시작 (10초마다)');
setInterval(updateProcedureWaitTimes, 10000); // 10초마다 실행 (테스트용)

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
    
    // 데이터베이스에 스케줄 저장
    if (data.schedule) {
      console.log('💾 스케줄 데이터베이스 저장 시작');
      
      // 기존 스케줄 데이터 삭제 후 새로 삽입
      db.run("DELETE FROM doctor_schedule", (err) => {
        if (err) {
          console.error('❌ 기존 스케줄 삭제 실패:', err.message);
          return;
        }
        
        const stmt = db.prepare("INSERT INTO doctor_schedule (day_of_week, time_period, doctor_name, position_index) VALUES (?, ?, ?, ?)");
        
        try {
          Object.keys(data.schedule).forEach(day => {
            Object.keys(data.schedule[day]).forEach(time => {
              data.schedule[day][time].forEach((doctorName, index) => {
                if (doctorName && doctorName.trim()) {
                  stmt.run([day, time, doctorName.trim(), index]);
                  console.log(`✅ 스케줄 저장: ${day} ${time} ${doctorName.trim()}`);
                }
              });
            });
          });
          
          stmt.finalize();
          console.log('✅ 스케줄 데이터베이스 저장 완료');
          
        } catch (error) {
          console.error('❌ 스케줄 저장 중 오류:', error);
        }
      });
    }
    
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
      console.log(`👤 환자 이름 업데이트 요청 받음: 환자ID=${data.patientId}, 새이름="${data.newName}"`);
      
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
        
        console.log(`📋 기존 환자 정보: ${patient.patient_name}, 새이름="${data.newName}"`);
        
        // 데이터베이스 업데이트
        db.run(
          "UPDATE patient_queue SET patient_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [data.newName, data.patientId],
          function(err) {
            if (err) {
              console.error('❌ 환자 이름 데이터베이스 업데이트 실패:', err);
              return;
            }
            
            console.log(`✅ 환자 이름 데이터베이스 업데이트 성공: ${patient.patient_name} → "${data.newName}"`);
            console.log(`📊 영향받은 행 수: ${this.changes}`);
            
            // 모든 클라이언트에게 업데이트 전송
            io.emit('patient_name_updated', {
              patientId: data.patientId,
              newName: data.newName
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
    } else if (data.type === 'update_patient_number') {
      console.log(`🔢 환자 등록번호 업데이트 요청 받음: 환자ID=${data.patientId}, 새등록번호="${data.newNumber}"`);
      
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
        
        console.log(`📋 기존 환자 정보: ${patient.patient_name}, 기존 등록번호="${patient.patient_id}", 새등록번호="${data.newNumber}"`);
        
        // 데이터베이스 업데이트
        db.run(
          "UPDATE patient_queue SET patient_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [data.newNumber, data.patientId],
          function(err) {
            if (err) {
              console.error('❌ 환자 등록번호 데이터베이스 업데이트 실패:', err);
              return;
            }
            
            console.log(`✅ 환자 등록번호 데이터베이스 업데이트 성공: ${patient.patient_name} → "${data.newNumber}"`);
            console.log(`📊 영향받은 행 수: ${this.changes}`);
            
            // 모든 클라이언트에게 업데이트 전송
            io.emit('patient_number_updated', {
              patientId: data.patientId,
              newNumber: data.newNumber
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
        
        // 완료된 환자를 이동시킬 때는 상태를 'waiting'으로 변경
        const shouldResetStatus = patient.status === 'completed';
        const newStatus = shouldResetStatus ? 'waiting' : patient.status;
        
        if (shouldResetStatus) {
          console.log(`✨ 완료된 환자를 ${data.newRoom}으로 복귀: 상태를 'waiting'으로 변경`);
        }

        // 데이터베이스 업데이트
        db.run(
          "UPDATE patient_queue SET department = ?, status = ?, wait_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [data.newRoom, newStatus, shouldResetStatus ? 0 : patient.wait_time, data.patientId],
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
    } else if (data.type === 'update_patient_notes') {
      console.log(`📝 비고 업데이트 요청 받음: 환자ID=${data.patientId}, 새비고="${data.newNotes}"`);
      
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
        
        console.log(`📋 기존 환자 정보: ${patient.patient_name}, 기존 비고="${patient.notes || ''}"`);
        
        // 데이터베이스 업데이트
        db.run(
          "UPDATE patient_queue SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [data.newNotes, data.patientId],
          function(err) {
            if (err) {
              console.error('❌ 비고 데이터베이스 업데이트 실패:', err);
              return;
            }
            
            console.log(`✅ 비고 데이터베이스 업데이트 성공: ${patient.patient_name} → "${data.newNotes}"`);
            console.log(`📊 영향받은 행 수: ${this.changes}`);
            
            // 업데이트된 환자 정보 다시 조회
            db.get("SELECT * FROM patient_queue WHERE id = ?", [data.patientId], (err, updatedPatient) => {
              if (!err && updatedPatient) {
                console.log(`🔍 업데이트 확인: ${updatedPatient.patient_name}, 비고="${updatedPatient.notes || ''}"`);
              }
            });
            
            // 모든 클라이언트에게 비고 업데이트 전송
            io.emit('patient_notes_updated', {
              patientId: data.patientId,
              newNotes: data.newNotes
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
    } else if (data.type === 'update_patient_gender_age') {
      console.log(`👤 성별/나이 업데이트 요청 받음: 환자ID=${data.patientId}, 성별/나이="${data.newGenderAge}"`);
      
      db.run(
        "UPDATE patient_queue SET gender_age = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [data.newGenderAge, data.patientId],
        function(err) {
          if (err) {
            console.error('성별/나이 업데이트 실패:', err);
            return;
          }
          
          console.log(`✅ 환자 ${data.patientId}의 성별/나이 업데이트 완료`);
          
          io.emit('patient_gender_age_updated', {
            patientId: data.patientId,
            newGenderAge: data.newGenderAge
          });
          
          // 전체 환자 목록 재전송
          db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
            if (!err) {
              io.emit('patients_data', allPatients);
            }
          });
        }
      );
    } else if (data.type === 'reorder_patients') {
      console.log(`🔄 환자 순서 변경 요청 받음:`, data.patientOrders);
      
      // 트랜잭션으로 순서 업데이트
      const updatePromises = data.patientOrders.map((item, index) => {
        return new Promise((resolve, reject) => {
          db.run(
            "UPDATE patient_queue SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [index + 1, item.patientId],
            function(err) {
              if (err) {
                console.error(`환자 ${item.patientId} 순서 업데이트 실패:`, err);
                reject(err);
              } else {
                console.log(`✅ 환자 ${item.patientId} 순서를 ${index + 1}로 업데이트`);
                resolve();
              }
            }
          );
        });
      });
      
      Promise.all(updatePromises)
        .then(() => {
          console.log('✅ 모든 환자 순서 업데이트 완료');
          
          // 업데이트된 환자 목록 재전송
          db.all("SELECT * FROM patient_queue ORDER BY department, display_order", (err, allPatients) => {
            if (!err) {
              console.log(`📤 순서 변경 후 전체 환자 목록 재전송 (${allPatients.length}명)`);
              io.emit('patients_data', allPatients);
            }
          });
          
          io.emit('patients_reordered', {
            success: true,
            patientOrders: data.patientOrders
          });
        })
        .catch((error) => {
          console.error('❌ 환자 순서 업데이트 실패:', error);
          io.emit('patients_reordered', {
            success: false,
            error: error.message
          });
        });
    } else if (data.type === 'update_patient_ward') {
      console.log(`🏥 병동 업데이트 요청 받음: 환자ID=${data.patientId}, 병동="${data.newWard}"`);
      
      db.run(
        "UPDATE patient_queue SET ward = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [data.newWard, data.patientId],
        function(err) {
          if (err) {
            console.error('병동 업데이트 실패:', err);
            return;
          }
          
          console.log(`✅ 환자 ${data.patientId}의 병동 업데이트 완료`);
          
          io.emit('patient_ward_updated', {
            patientId: data.patientId,
            newWard: data.newWard
          });
          
          // 전체 환자 목록 재전송
          db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
            if (!err) {
              io.emit('patients_data', allPatients);
            }
          });
        }
      );
    } else if (data.type === 'update_patient_date') {
      console.log(`📅 환자 날짜 업데이트 요청 받음: 환자ID=${data.patientId}, 날짜="${data.newDate}"`);
      
      db.run(
        "UPDATE patient_queue SET patient_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [data.newDate, data.patientId],
        function(err) {
          if (err) {
            console.error('환자 날짜 업데이트 실패:', err);
            return;
          }
          
          console.log(`✅ 환자 ${data.patientId}의 날짜 업데이트 완료 (${data.newDate})`);
          
          io.emit('patient_date_updated', {
            patientId: data.patientId,
            newDate: data.newDate
          });
          
          // 전체 환자 목록 재전송
          db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
            if (!err) {
              io.emit('patients_data', allPatients);
            }
          });
        }
      );
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

// 로그인 API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  console.log('🔐 로그인 시도:', username)
  
  // 기본 계정 정보
  const accounts = {
    'cauhs': { password: 'cauhs19415', role: 'admin', name: '관리자' }
  }
  
  if (!username || !password) {
    console.log('❌ 로그인 실패: 사용자명 또는 비밀번호 누락')
    return res.status(400).json({ 
      success: false, 
      message: '사용자명과 비밀번호를 입력해주세요.' 
    })
  }
  
  const account = accounts[username]
  
  if (!account || account.password !== password) {
    console.log('❌ 로그인 실패: 잘못된 계정 정보')
    return res.status(401).json({ 
      success: false, 
      message: '사용자명 또는 비밀번호가 올바르지 않습니다.' 
    })
  }
  
  console.log('✅ 로그인 성공:', username, '역할:', account.role)
  
  // 간단한 토큰 생성 (실제 환경에서는 JWT 사용 권장)
  const token = Buffer.from(`${username}:${account.role}:${Date.now()}`).toString('base64')
  
  res.json({
    success: true,
    message: '로그인 성공',
    user: {
      username: username,
      role: account.role,
      name: account.name
    },
    token: token
  })
})

// 토큰 검증 API
app.post('/api/verify-token', (req, res) => {
  const { token } = req.body
  
  if (!token) {
    return res.status(400).json({ 
      success: false, 
      message: '토큰이 필요합니다.' 
    })
  }
  
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const [username, role, timestamp] = decoded.split(':')
    
    // 토큰 유효성 검사 (24시간)
    const tokenAge = Date.now() - parseInt(timestamp)
    const maxAge = 24 * 60 * 60 * 1000 // 24시간
    
    if (tokenAge > maxAge) {
      console.log('❌ 토큰 만료:', username)
      return res.status(401).json({ 
        success: false, 
        message: '토큰이 만료되었습니다.' 
      })
    }
    
    console.log('✅ 토큰 검증 성공:', username)
    
    const accounts = {
      'cauhs': { name: '관리자' }
    }
    
    res.json({
      success: true,
      user: {
        username: username,
        role: role,
        name: accounts[username]?.name || username
      }
    })
    
  } catch (error) {
    console.log('❌ 토큰 검증 실패:', error.message)
    res.status(401).json({ 
      success: false, 
      message: '유효하지 않은 토큰입니다.' 
    })
  }
})

// 서버 시작 시 모든 환자의 시술 시간 강제 초기화
function resetAllProcedureTimes() {
  console.log('🔄 서버 시작 - 모든 환자 시술시간 강제 초기화 중...');
  
  // 모든 환자의 시술시간을 완전히 초기화
  db.run(`
    UPDATE patient_queue 
    SET procedure_start_time = CASE 
      WHEN status = 'procedure' THEN CURRENT_TIMESTAMP 
      ELSE NULL 
    END, 
    wait_time = 0
  `, (err) => {
    if (err) {
      console.error('❌ 시술시간 초기화 실패:', err);
    } else {
      console.log('✅ 모든 환자의 시술시간 강제 초기화 완료');
      console.log('   - 시술중 환자: 현재 시간으로 설정');
      console.log('   - 기타 환자: 시술시간 제거');
      
      // 모든 클라이언트에게 초기화 알림
      setTimeout(() => {
        db.all("SELECT * FROM patient_queue ORDER BY created_at", (err, allPatients) => {
          if (!err) {
            console.log('📡 초기화된 환자 데이터 브로드캐스트');
            io.emit('patients_data', allPatients);
          }
        });
      }, 1000);
    }
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`📡 API 엔드포인트: http://localhost:${PORT}/api`);
  console.log(`🔐 로그인 기능이 활성화되었습니다`);
  console.log(`   - 관리자: cauhs / cauhs19415`);
  
  // 서버 시작 시 시술시간 초기화 실행
  setTimeout(resetAllProcedureTimes, 1000);
});

module.exports = { app, server, db };

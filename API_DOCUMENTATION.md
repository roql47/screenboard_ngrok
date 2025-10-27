# 심장뇌혈관 시술센터 현황판 API 문서

## 개요
이 API는 병원 시술센터의 환자 관리, 의사 상태 관리, 통계 및 스케줄 관리를 위한 RESTful API입니다.

**Base URL**: `http://localhost:3001` (로컬) 또는 `https://c3830363628f.ngrok.app` (배포)

## 인증

### POST `/api/login`
사용자 로그인

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "username": "string",
    "role": "admin|user",
    "name": "string"
  },
  "token": "jwt_token_string"
}
```

### POST `/api/verify-token`
JWT 토큰 검증

**Request Body:**
```json
{
  "token": "jwt_token_string"
}
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "username": "string",
    "role": "admin|user",
    "name": "string"
  }
}
```

## 환자 관리

### GET `/api/patients`
모든 환자 목록 조회

**Query Parameters:**
- `date` (optional): 특정 날짜의 환자만 조회 (YYYY-MM-DD 형식)

**Response:**
```json
[
  {
    "id": 1,
    "patient_name": "홍길동",
    "patient_id": "12345678",
    "department": "Angio 1R",
    "assigned_doctor": "PCI",
    "doctor": "김의사",
    "notes": "비고 사항",
    "gender_age": "M/65",
    "ward": "CCU",
    "priority": 1,
    "status": "waiting|procedure|completed",
    "wait_time": 30,
    "patient_date": "2024-01-15",
    "created_at": "2024-01-15T09:00:00.000Z",
    "updated_at": "2024-01-15T09:30:00.000Z"
  }
]
```

### GET `/api/patients/date/:date`
특정 날짜의 환자 목록 조회

**Parameters:**
- `date`: 날짜 (YYYY-MM-DD 형식)

**Response:** 위와 동일

### POST `/api/patients`
새 환자 추가

**Request Body:**
```json
{
  "patient_name": "홍길동",
  "patient_id": "12345678",
  "department": "Angio 1R",
  "assigned_doctor": "PCI",
  "doctor": "김의사",
  "notes": "비고 사항",
  "gender_age": "M/65",
  "ward": "CCU",
  "priority": 1,
  "patient_date": "2024-01-15"
}
```

**Response:**
```json
{
  "id": 1,
  "patient_name": "홍길동",
  "patient_id": "12345678",
  "department": "Angio 1R",
  "assigned_doctor": "PCI",
  "doctor": "김의사",
  "notes": "비고 사항",
  "gender_age": "M/65",
  "ward": "CCU",
  "priority": 1,
  "status": "waiting",
  "wait_time": 0,
  "patient_date": "2024-01-15",
  "created_at": "2024-01-15T09:00:00.000Z",
  "updated_at": "2024-01-15T09:00:00.000Z"
}
```

### POST `/api/patients/:id/status`
환자 상태 업데이트

**Parameters:**
- `id`: 환자 ID

**Request Body:**
```json
{
  "status": "waiting|procedure|completed",
  "assigned_doctor": "시술명 (선택사항)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "환자 상태가 업데이트되었습니다."
}
```

### DELETE `/api/patients/:id`
환자 삭제

**Parameters:**
- `id`: 환자 ID

**Response:**
```json
{
  "success": true,
  "message": "환자가 삭제되었습니다."
}
```

## 의사 관리

### GET `/api/doctors`
모든 의사 목록 조회

**Response:**
```json
[
  {
    "id": 1,
    "name": "김의사",
    "department": "Angio 1R",
    "status": "available|busy|unavailable",
    "current_patient": "환자명 (선택사항)",
    "updated_at": "2024-01-15T09:00:00.000Z"
  }
]
```

### POST `/api/doctors/:id/status`
의사 상태 업데이트

**Parameters:**
- `id`: 의사 ID

**Request Body:**
```json
{
  "status": "available|busy|unavailable",
  "current_patient": "환자명 (선택사항)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "의사 상태가 업데이트되었습니다."
}
```

## 통계

### GET `/api/stats`
병원 통계 조회

**Response:**
```json
{
  "total_patients": 25,
  "waiting_patients": 8,
  "in_treatment": 3,
  "completed_today": 14,
  "average_wait_time": 45.5
}
```

## 스케줄 관리

### GET `/api/schedule`
외래 진료 스케줄 조회

**Response:**
```json
{
  "월": {
    "오전": ["김영상", "이영상", "박민수"],
    "오후": ["박영상", "최영상", "정현우"]
  },
  "화": {
    "오전": ["이영상", "박영상", "강지연"],
    "오후": ["김영상", "정영상", "윤서준"]
  }
}
```

### POST `/api/schedule`
외래 진료 스케줄 업데이트

**Request Body:**
```json
{
  "schedule": {
    "월": {
      "오전": ["김영상", "이영상", "박민수"],
      "오후": ["박영상", "최영상", "정현우"]
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "스케줄이 업데이트되었습니다."
}
```

## 당직 관리

### GET `/api/duty`
현재 당직 정보 조회

**Response:**
```json
{
  "doctor": "김의사",
  "rn": "간호사A",
  "rt": "방사선사B",
  "date": "2024-01-15"
}
```

### GET `/api/duty/date/:date`
특정 날짜 당직 정보 조회

**Parameters:**
- `date`: 날짜 (YYYY-MM-DD 형식)

**Response:** 위와 동일

### POST `/api/duty`
당직 정보 업데이트

**Request Body:**
```json
{
  "dutyStaff": {
    "doctor": "김의사",
    "rn": "간호사A",
    "rt": "방사선사B"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "당직 정보가 업데이트되었습니다."
}
```

### POST `/api/duty/schedule`
특정 날짜 당직 정보 업데이트

**Request Body:**
```json
{
  "dutyStaff": {
    "doctor": "김의사",
    "rn": "간호사A",
    "rt": "방사선사B"
  },
  "date": "2024-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "당직 정보가 업데이트되었습니다."
}
```

## 관리자 기능

### GET `/api/admin/clients`
연결된 클라이언트 목록 조회

**Response:**
```json
{
  "clients": [
    {
      "id": "socket_id_1",
      "connectedAt": "2024-01-15T09:00:00.000Z",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "count": 1
}
```

### GET `/api/admin/server-status`
서버 상태 조회

**Response:**
```json
{
  "status": "running",
  "uptime": 3600,
  "memory": {
    "used": 50.5,
    "total": 100.0
  },
  "connections": 5
}
```

### GET `/api/admin/backup`
데이터베이스 백업 다운로드

**Response:** SQLite 데이터베이스 파일 다운로드

## WebSocket 이벤트

### 클라이언트 → 서버

#### `admin_action`
관리자 액션 전송
```json
{
  "type": "update_patient_procedure|update_patient_notes|update_patient_gender_age|update_patient_ward|update_patient_date|reorder_patients",
  "patientId": 1,
  "newValue": "새로운 값",
  "timestamp": "2024-01-15T09:00:00.000Z"
}
```

#### `client_activity`
클라이언트 활동 전송
```json
{
  "type": "page_load|user_action",
  "timestamp": "2024-01-15T09:00:00.000Z",
  "userAgent": "Mozilla/5.0..."
}
```

### 서버 → 클라이언트

#### `patients_data`
전체 환자 데이터 전송
```json
[
  {
    "id": 1,
    "patient_name": "홍길동",
    // ... 환자 정보
  }
]
```

#### `patient_added`
새 환자 추가 알림
```json
{
  "id": 1,
  "patient_name": "홍길동",
  // ... 환자 정보
}
```

#### `patient_updated`
환자 정보 업데이트 알림
```json
{
  "id": 1,
  "patient_name": "홍길동",
  // ... 업데이트된 환자 정보
}
```

#### `patient_deleted`
환자 삭제 알림
```json
{
  "id": 1
}
```

#### `patient_name_updated`
환자 이름 업데이트 알림
```json
{
  "patientId": 1,
  "newName": "홍길동"
}
```

#### `patient_procedure_updated`
환자 시술명 업데이트 알림
```json
{
  "patientId": 1,
  "newProcedure": "PCI"
}
```

#### `patient_notes_updated`
환자 비고 업데이트 알림
```json
{
  "patientId": 1,
  "newNotes": "비고 사항"
}
```

#### `patient_room_moved`
환자 방 이동 알림
```json
{
  "patientId": 1,
  "newRoom": "Angio 2R"
}
```

#### `doctors_data`
의사 데이터 전송
```json
[
  {
    "id": 1,
    "name": "김의사",
    // ... 의사 정보
  }
]
```

#### `stats_updated`
통계 업데이트 알림
```json
{
  "total_patients": 25,
  "waiting_patients": 8,
  // ... 통계 정보
}
```

#### `schedule_updated`
스케줄 업데이트 알림
```json
{
  "월": {
    "오전": ["김영상", "이영상", "박민수"],
    // ... 스케줄 정보
  }
}
```

#### `duty_updated`
당직 정보 업데이트 알림
```json
{
  "doctor": "김의사",
  "rn": "간호사A",
  "rt": "방사선사B"
}
```

## 에러 응답

모든 API는 오류 발생 시 다음과 같은 형식으로 응답합니다:

```json
{
  "error": "오류 메시지",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T09:00:00.000Z"
}
```

### 일반적인 HTTP 상태 코드
- `200`: 성공
- `400`: 잘못된 요청
- `401`: 인증 필요
- `403`: 권한 없음
- `404`: 리소스 없음
- `500`: 서버 내부 오류

## 데이터베이스 스키마

### patients 테이블
```sql
CREATE TABLE patient_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_name TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  department TEXT NOT NULL,
  assigned_doctor TEXT,
  doctor TEXT,
  notes TEXT,
  gender_age TEXT,
  ward TEXT,
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'waiting',
  wait_time INTEGER DEFAULT 0,
  patient_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### doctors 테이블
```sql
CREATE TABLE doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  current_patient TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### schedule 테이블
```sql
CREATE TABLE schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week TEXT NOT NULL,
  time_period TEXT NOT NULL,
  doctors TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### duty_staff 테이블
```sql
CREATE TABLE duty_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duty_date TEXT NOT NULL,
  doctor TEXT,
  rn TEXT,
  rt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 사용 예시

### JavaScript (Fetch API)
```javascript
// 환자 목록 조회
const patients = await fetch('/api/patients')
  .then(res => res.json());

// 새 환자 추가
const newPatient = await fetch('/api/patients', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    patient_name: '홍길동',
    patient_id: '12345678',
    department: 'Angio 1R',
    assigned_doctor: 'PCI',
    patient_date: '2024-01-15'
  })
}).then(res => res.json());

// WebSocket 연결
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('patient_added', (patient) => {
  console.log('새 환자 추가:', patient);
});
```

---

**문서 버전**: 1.0  
**최종 업데이트**: 2024년 1월  
**문의**: 개발팀

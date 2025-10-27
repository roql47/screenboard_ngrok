# 🏥 Hospital Board - 병원 관리 시스템

실시간 환자 관리 및 병원 운영을 위한 웹 기반 관리 시스템입니다.

## 📋 주요 기능

- ✅ **실시간 환자 대기열 관리**: WebSocket을 통한 실시간 데이터 동기화
- 👨‍⚕️ **당직 의료진 관리**: 날짜별 당직 의료진 스케줄 관리
- 📅 **외래 진료 스케줄**: 요일/시간대별 진료 일정 관리
- 📊 **통계 대시보드**: 환자 현황 및 통계 실시간 모니터링
- 🔐 **로그인 시스템**: 관리자 인증 및 권한 관리
- 📱 **반응형 디자인**: 데스크톱, 태블릿, 모바일 지원
- 📂 **엑셀 내보내기**: 환자 데이터 엑셀 파일 다운로드

## 🛠 기술 스택

### 프론트엔드
- **React 18**: UI 라이브러리
- **Vite**: 빌드 도구
- **Tailwind CSS**: 스타일링
- **Socket.IO Client**: 실시간 통신
- **Chart.js**: 데이터 시각화
- **React DnD**: 드래그 앤 드롭
- **XLSX**: 엑셀 내보내기

### 백엔드
- **Node.js**: 런타임 환경
- **Express**: 웹 프레임워크
- **Socket.IO**: 실시간 양방향 통신
- **SQLite3**: 데이터베이스
- **CORS**: Cross-Origin Resource Sharing

### 배포
- **AWS Lightsail**: 클라우드 호스팅
- **Nginx**: 웹 서버 및 리버스 프록시
- **PM2**: Node.js 프로세스 관리
- **Let's Encrypt**: SSL/TLS 인증서

## 📁 프로젝트 구조

```
hospital-board/
├── src/                          # 프론트엔드 소스
│   ├── components/              # React 컴포넌트
│   │   ├── CurrentTime.jsx     # 현재 시간 표시
│   │   ├── DoctorStatus.jsx    # 의사 상태 관리
│   │   ├── HospitalBoard.jsx   # 메인 대시보드
│   │   ├── Login.jsx            # 로그인 페이지
│   │   ├── PatientQueue.jsx    # 환자 대기열
│   │   ├── PatientSummary.jsx  # 환자 요약
│   │   └── StatisticsModal.jsx # 통계 모달
│   ├── utils/
│   │   └── socket.js           # Socket.IO 클라이언트
│   ├── App.jsx                 # 메인 App 컴포넌트
│   ├── App.css                 # 스타일
│   └── main.jsx                # 엔트리 포인트
│
├── backend/                     # 백엔드 소스
│   ├── server.js               # Express 서버
│   ├── hospital.db             # SQLite 데이터베이스
│   └── package.json            # 백엔드 의존성
│
├── deployment/                  # 배포 관련 파일
│   ├── ecosystem.config.js     # PM2 설정
│   ├── nginx-config.conf       # Nginx 설정
│   ├── setup.sh                # 서버 초기 설정
│   ├── deploy.sh               # 배포 스크립트
│   ├── backup-db.sh            # 백업 스크립트
│   └── README.md               # 배포 가이드
│
├── AWS_LIGHTSAIL_DEPLOYMENT.md # 상세 배포 문서
├── package.json                 # 프론트엔드 의존성
├── vite.config.js              # Vite 설정
└── tailwind.config.js          # Tailwind 설정
```

## 🚀 로컬 개발 환경 설정

### 사전 요구사항
- Node.js 18+ (권장: v20 LTS)
- npm 또는 yarn

### 설치 및 실행

1. **저장소 클론**
```cmd
git clone https://github.com/사용자명/hospital-board.git
cd hospital-board
```

2. **프론트엔드 설정**
```cmd
npm install
```

3. **백엔드 설정**
```cmd
cd backend
npm install
```

4. **개발 서버 실행**

터미널 1 (백엔드):
```cmd
cd backend
node server.js
```

터미널 2 (프론트엔드):
```cmd
npm run dev
```

5. **브라우저 접속**
```
http://localhost:5173
```

### 기본 로그인 정보
- **사용자명**: `cauhs`
- **비밀번호**: `cauhs19415`

## 📦 프로덕션 배포

상세한 배포 가이드는 [AWS_LIGHTSAIL_DEPLOYMENT.md](./AWS_LIGHTSAIL_DEPLOYMENT.md)를 참고하세요.

### 빠른 시작

1. **AWS Lightsail 인스턴스 생성**
   - Ubuntu 22.04 LTS
   - $5/월 플랜 권장

2. **서버 초기 설정**
```bash
cd deployment
chmod +x setup.sh
./setup.sh
```

3. **프로젝트 배포**
```bash
# 의존성 설치
cd ~/hospital-board
npm install
cd backend && npm install

# 프론트엔드 빌드
cd ~/hospital-board
npm run build

# PM2로 백엔드 실행
cd backend
pm2 start ecosystem.config.js
pm2 save
```

4. **Nginx 설정**
```bash
sudo cp deployment/nginx-config.conf /etc/nginx/sites-available/hospital-board
sudo ln -s /etc/nginx/sites-available/hospital-board /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔧 유지보수

### 로그 확인
```bash
# 백엔드 로그
pm2 logs hospital-backend

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 재배포
```bash
cd ~/hospital-board
git pull
./deployment/deploy.sh
```

### 백업
```bash
# 수동 백업
./deployment/backup-db.sh

# Cron으로 자동 백업 (매일 새벽 3시)
crontab -e
# 추가: 0 3 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/logs/backup.log 2>&1
```

## 📊 데이터베이스 구조

### 주요 테이블
- `doctors`: 의사 정보 및 상태
- `patient_queue`: 환자 대기열
- `doctor_schedules`: 날짜별 당직 정보
- `doctor_schedule`: 외래 진료 스케줄
- `duty_staff`: 당직 의료진
- `hospital_stats`: 병원 통계

## 🔐 보안

- HTTPS/SSL 인증서 (Let's Encrypt)
- 로그인 인증 시스템
- CORS 정책 적용
- 환경 변수로 민감 정보 관리
- SQLite 데이터베이스 파일 권한 관리

## 🐛 문제 해결

### 502 Bad Gateway
```bash
pm2 status
pm2 restart hospital-backend
```

### WebSocket 연결 실패
- Nginx 설정에서 `/socket.io/` 경로 확인
- 방화벽 규칙 확인 (포트 80, 443)
- 브라우저 콘솔 에러 확인

### 데이터베이스 오류
```bash
cd ~/hospital-board/backend
sqlite3 hospital.db
.tables
.schema patient_queue
```

## 📞 지원 및 문의

- **이슈 리포트**: GitHub Issues
- **문서**: [AWS Lightsail 배포 가이드](./AWS_LIGHTSAIL_DEPLOYMENT.md)
- **API 문서**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 🙏 감사의 말

이 프로젝트는 병원 환자 관리를 효율화하기 위해 개발되었습니다.

---

**버전**: 1.0.0  
**최종 업데이트**: 2025-10-27

# AWS Lightsail 배포 가이드

## 📋 목차
1. [사전 준비](#사전-준비)
2. [Lightsail 인스턴스 생성](#lightsail-인스턴스-생성)
3. [서버 초기 설정](#서버-초기-설정)
4. [프로젝트 배포](#프로젝트-배포)
5. [Nginx 설정](#nginx-설정)
6. [도메인 연결](#도메인-연결)
7. [SSL 인증서 설정](#ssl-인증서-설정)
8. [유지보수](#유지보수)

---

## 🎯 사전 준비

### 필요한 것들
- AWS 계정
- 카페24 도메인 (구매 예정)
- SSH 클라이언트 (Windows: PuTTY 또는 PowerShell)
- Git (프로젝트 업로드용)

### 프로젝트 정보
- **프론트엔드**: React + Vite (포트 5173 → 빌드 후 정적 파일)
- **백엔드**: Node.js + Express + Socket.IO (포트 3001)
- **데이터베이스**: SQLite (파일 기반, 별도 설치 불필요)
- **실시간 통신**: WebSocket

---

## 🚀 Lightsail 인스턴스 생성

### 1단계: AWS Lightsail 콘솔 접속
1. [AWS Lightsail 콘솔](https://lightsail.aws.amazon.com/) 접속
2. "인스턴스 생성" 클릭

### 2단계: 인스턴스 설정
1. **인스턴스 위치**: 아시아 태평양 (서울) 선택
2. **플랫폼**: Linux/Unix
3. **블루프린트**: 
   - "운영 체제 전용" 선택
   - **Ubuntu 22.04 LTS** 선택 (권장)

### 3단계: 플랜 선택
**권장 플랜**: $5/월
- 1 GB RAM
- 1 vCPU
- 40 GB SSD
- 2 TB 트래픽

**최소 플랜**: $3.50/월
- 512 MB RAM
- 1 vCPU
- 20 GB SSD
- 1 TB 트래픽

> 💡 **권장**: 병원 관리 시스템은 실시간 데이터 처리가 중요하므로 $5 플랜 권장

### 4단계: 인스턴스 이름 설정
- 예: `hospital-board-server`

### 5단계: 인스턴스 생성
- "인스턴스 생성" 클릭
- 약 1~2분 대기

---

## 🔌 고정 IP 할당

### 1단계: 고정 IP 생성
1. Lightsail 콘솔 → "네트워킹" 탭
2. "고정 IP 생성" 클릭
3. 생성한 인스턴스에 연결
4. 고정 IP 이름 입력 (예: `hospital-board-ip`)
5. "생성" 클릭

### 2단계: 방화벽 설정
1. 인스턴스 상세 페이지 → "네트워킹" 탭
2. 방화벽 규칙에 다음 포트 추가:

| 애플리케이션 | 프로토콜 | 포트 범위 | 설명 |
|-------------|---------|----------|------|
| SSH | TCP | 22 | SSH 접속 |
| HTTP | TCP | 80 | 웹 서버 |
| HTTPS | TCP | 443 | SSL 보안 연결 |
| Custom | TCP | 3001 | 백엔드 API (임시) |

---

## 💻 서버 초기 설정

### 1단계: SSH 접속
#### Windows (CMD/PowerShell)
```cmd
# Lightsail 콘솔에서 기본 키 다운로드 (예: LightsailDefaultKey-ap-northeast-2.pem)
ssh -i "경로\LightsailDefaultKey.pem" ubuntu@고정IP주소
```

#### Lightsail 브라우저 SSH
- 인스턴스 상세 페이지 → "연결" 탭 → "SSH를 사용하여 연결" 클릭

### 2단계: 시스템 업데이트
```bash
sudo apt update && sudo apt upgrade -y
```

### 3단계: Node.js 설치 (v20 LTS)
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js 설치
sudo apt install -y nodejs

# 버전 확인
node -v  # v20.x.x
npm -v   # 10.x.x
```

### 4단계: 필수 도구 설치
```bash
# Git, Nginx, PM2 설치
sudo apt install -y git nginx

# PM2 (프로세스 관리자) 전역 설치
sudo npm install -g pm2

# SQLite3 (데이터베이스 관리용)
sudo apt install -y sqlite3
```

---

## 📦 프로젝트 배포

### 방법 1: Git으로 배포 (권장)

#### 1단계: GitHub에 프로젝트 업로드
로컬 컴퓨터에서:
```cmd
cd C:\Users\roql4\Desktop\screenboard-master
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/사용자명/hospital-board.git
git push -u origin main
```

#### 2단계: 서버에서 클론
서버에서:
```bash
# 홈 디렉토리로 이동
cd ~

# 프로젝트 클론
git clone https://github.com/사용자명/hospital-board.git

# 프로젝트 디렉토리로 이동
cd hospital-board
```

### 방법 2: SCP로 직접 업로드

로컬 컴퓨터에서 (CMD):
```cmd
# 프로젝트 압축 (7-Zip 또는 내장 압축 사용)
tar -czf hospital-board.tar.gz screenboard-master

# 서버로 업로드
scp -i "경로\LightsailDefaultKey.pem" hospital-board.tar.gz ubuntu@고정IP:/home/ubuntu/

# 서버 접속 후 압축 해제
ssh -i "경로\LightsailDefaultKey.pem" ubuntu@고정IP
tar -xzf hospital-board.tar.gz
mv screenboard-master hospital-board
cd hospital-board
```

### 3단계: 의존성 설치

```bash
# 백엔드 의존성 설치
cd ~/hospital-board/backend
npm install

# 프론트엔드 의존성 설치
cd ~/hospital-board
npm install
```

### 4단계: 프론트엔드 빌드
```bash
cd ~/hospital-board
npm run build

# 빌드 결과 확인
ls -la dist/
```

### 5단계: 환경 변수 설정
```bash
# 백엔드 환경 변수 파일 생성
cd ~/hospital-board/backend
nano .env
```

`.env` 파일 내용:
```env
NODE_ENV=production
PORT=3001
```

저장: `Ctrl + O` → `Enter` → `Ctrl + X`

---

## 🌐 Nginx 설정

### 1단계: Nginx 설정 파일 생성
```bash
sudo nano /etc/nginx/sites-available/hospital-board
```

다음 내용 입력 (도메인 없는 버전):
```nginx
server {
    listen 80;
    server_name 고정IP주소;
    
    # 프론트엔드 정적 파일 서빙
    root /home/ubuntu/hospital-board/dist;
    index index.html;
    
    # Gzip 압축 활성화
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # 프론트엔드 라우팅 처리 (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API 요청 프록시
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Socket.IO WebSocket 프록시 (중요!)
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket 타임아웃 설정
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # 정적 파일 캐싱
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

저장: `Ctrl + O` → `Enter` → `Ctrl + X`

### 2단계: 심볼릭 링크 생성
```bash
sudo ln -s /etc/nginx/sites-available/hospital-board /etc/nginx/sites-enabled/
```

### 3단계: 기본 설정 비활성화
```bash
sudo rm /etc/nginx/sites-enabled/default
```

### 4단계: Nginx 설정 테스트
```bash
sudo nginx -t
```

성공 메시지 확인:
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 5단계: Nginx 재시작
```bash
sudo systemctl restart nginx
sudo systemctl status nginx
```

---

## 🔄 백엔드 서버 실행 (PM2)

### 1단계: PM2 설정 파일 생성
```bash
cd ~/hospital-board/backend
nano ecosystem.config.js
```

다음 내용 입력:
```javascript
module.exports = {
  apps: [{
    name: 'hospital-backend',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/home/ubuntu/logs/hospital-backend-error.log',
    out_file: '/home/ubuntu/logs/hospital-backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
}
```

### 2단계: 로그 디렉토리 생성
```bash
mkdir -p ~/logs
```

### 3단계: PM2로 백엔드 실행
```bash
cd ~/hospital-board/backend
pm2 start ecosystem.config.js
```

### 4단계: PM2 자동 시작 설정
```bash
# 부팅 시 자동 시작 설정
pm2 startup

# 출력된 명령어 실행 (sudo로 시작하는 명령어)
# 예: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 현재 프로세스 목록 저장
pm2 save
```

### 5단계: 백엔드 상태 확인
```bash
pm2 status
pm2 logs hospital-backend
```

---

## 🌍 도메인 연결 (카페24)

### 1단계: 카페24에서 도메인 구매
1. [카페24 도메인](https://domain.cafe24.com/) 접속
2. 원하는 도메인 검색 및 구매

### 2단계: DNS 레코드 설정
1. 카페24 도메인 관리 페이지 접속
2. "DNS 관리" 또는 "네임서버 설정" 클릭
3. A 레코드 추가:

| 호스트명 | 타입 | 값 | TTL |
|---------|------|-----|-----|
| @ | A | Lightsail_고정IP | 3600 |
| www | A | Lightsail_고정IP | 3600 |

예시:
- 호스트명: `@` (루트 도메인)
- 타입: `A`
- 값: `123.45.67.89` (Lightsail 고정 IP)

### 3단계: Nginx 설정 업데이트
```bash
sudo nano /etc/nginx/sites-available/hospital-board
```

`server_name` 부분 수정:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    # ... 나머지 설정
}
```

### 4단계: Nginx 재시작
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 5단계: 도메인 확인
- DNS 전파 대기 (5분 ~ 48시간, 보통 10분 내)
- 브라우저에서 `http://yourdomain.com` 접속 테스트

---

## 🔒 SSL 인증서 설정 (Let's Encrypt)

### 1단계: Certbot 설치
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2단계: SSL 인증서 발급
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

프롬프트 응답:
1. 이메일 주소 입력 (만료 알림용)
2. 약관 동의: `Y`
3. 뉴스레터: `N` (선택)
4. HTTP → HTTPS 리다이렉트: `2` (권장)

### 3단계: 자동 갱신 테스트
```bash
sudo certbot renew --dry-run
```

### 4단계: 최종 확인
- `https://yourdomain.com` 접속
- 브라우저 주소창에 자물쇠 아이콘 확인

---

## 🔧 프론트엔드 API URL 수정

### 배포 전 수정 필요
`src/utils/socket.js` 파일 수정:
```javascript
const SOCKET_URL = import.meta.env.PROD 
  ? 'https://yourdomain.com'  // 프로덕션: 실제 도메인
  : 'http://localhost:3001';   // 개발: 로컬

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true
});
```

### 재빌드 및 배포
```bash
# 로컬에서 재빌드
npm run build

# 서버에 업로드 (Git 사용 시)
git add .
git commit -m "Update production API URL"
git push

# 서버에서
cd ~/hospital-board
git pull
npm run build
```

---

## 📊 유지보수 및 모니터링

### PM2 명령어
```bash
# 프로세스 상태 확인
pm2 status

# 로그 확인 (실시간)
pm2 logs hospital-backend

# 로그 확인 (최근 200줄)
pm2 logs hospital-backend --lines 200

# 프로세스 재시작
pm2 restart hospital-backend

# 프로세스 중지
pm2 stop hospital-backend

# 프로세스 삭제
pm2 delete hospital-backend

# 메모리/CPU 모니터링
pm2 monit
```

### Nginx 명령어
```bash
# 설정 테스트
sudo nginx -t

# 재시작
sudo systemctl restart nginx

# 상태 확인
sudo systemctl status nginx

# 로그 확인
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 데이터베이스 백업
```bash
# SQLite 데이터베이스 백업
cd ~/hospital-board/backend
sqlite3 hospital.db ".backup /home/ubuntu/backups/hospital_$(date +%Y%m%d_%H%M%S).db"

# 자동 백업 스크립트 생성
mkdir -p ~/backups
nano ~/backup-db.sh
```

`backup-db.sh` 내용:
```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DB_PATH="/home/ubuntu/hospital-board/backend/hospital.db"
DATE=$(date +%Y%m%d_%H%M%S)

# 백업 실행
sqlite3 $DB_PATH ".backup $BACKUP_DIR/hospital_$DATE.db"

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "hospital_*.db" -mtime +7 -delete

echo "Backup completed: hospital_$DATE.db"
```

실행 권한 부여:
```bash
chmod +x ~/backup-db.sh
```

### Cron으로 자동 백업 설정
```bash
# Cron 편집
crontab -e

# 매일 새벽 3시에 백업 실행 추가
0 3 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/logs/backup.log 2>&1
```

---

## 🔍 문제 해결

### 502 Bad Gateway 오류
```bash
# 백엔드 서버 확인
pm2 status
pm2 logs hospital-backend

# 포트 확인
sudo netstat -tulpn | grep 3001

# 백엔드 재시작
pm2 restart hospital-backend
```

### WebSocket 연결 실패
```bash
# Nginx 설정 확인
sudo nginx -t

# Nginx 에러 로그 확인
sudo tail -f /var/log/nginx/error.log

# 방화벽 확인 (Lightsail 콘솔에서)
```

### 데이터베이스 오류
```bash
# 데이터베이스 파일 권한 확인
cd ~/hospital-board/backend
ls -la hospital.db

# 권한 수정 (필요시)
chmod 644 hospital.db
```

### 프론트엔드 빌드 오류
```bash
# Node.js 메모리 증가
export NODE_OPTIONS="--max_old_space_size=2048"
npm run build
```

---

## 📝 배포 체크리스트

### 배포 전
- [ ] AWS Lightsail 인스턴스 생성
- [ ] 고정 IP 할당
- [ ] 방화벽 규칙 설정
- [ ] 도메인 구매 (카페24)
- [ ] DNS A 레코드 설정

### 서버 설정
- [ ] SSH 접속 확인
- [ ] 시스템 업데이트
- [ ] Node.js 설치
- [ ] Nginx, PM2, Git 설치
- [ ] 프로젝트 업로드

### 애플리케이션 설정
- [ ] 백엔드 의존성 설치
- [ ] 프론트엔드 의존성 설치
- [ ] 프론트엔드 빌드
- [ ] Nginx 설정
- [ ] PM2 설정

### 배포 후
- [ ] HTTP 접속 확인
- [ ] API 동작 확인
- [ ] WebSocket 연결 확인
- [ ] SSL 인증서 발급
- [ ] HTTPS 접속 확인
- [ ] 자동 백업 설정
- [ ] PM2 자동 시작 설정

---

## 💰 예상 비용

### AWS Lightsail
- **$5/월 플랜** (권장): 약 6,500원/월
- **$3.50/월 플랜** (최소): 약 4,500원/월

### 도메인 (카페24)
- **.com 도메인**: 약 15,000원/년
- **.co.kr 도메인**: 약 20,000원/년

### SSL 인증서
- **Let's Encrypt**: 무료 ✨

### 총 예상 비용
- **초기**: 도메인 + 첫 달 서버 = 약 20,000원
- **월간**: 약 5,000~7,000원
- **연간**: 약 80,000~100,000원

---

## 📞 추가 지원

### 유용한 링크
- [AWS Lightsail 문서](https://lightsail.aws.amazon.com/ls/docs)
- [Nginx 공식 문서](https://nginx.org/en/docs/)
- [PM2 공식 문서](https://pm2.keymetrics.io/docs/)
- [Let's Encrypt 문서](https://letsencrypt.org/docs/)

### 로그 위치
- **Nginx Access**: `/var/log/nginx/access.log`
- **Nginx Error**: `/var/log/nginx/error.log`
- **백엔드 로그**: `~/logs/hospital-backend-out.log`
- **백엔드 에러**: `~/logs/hospital-backend-error.log`

---

**작성일**: 2025-10-27  
**버전**: 1.0.0


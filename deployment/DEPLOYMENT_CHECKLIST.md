# 배포 체크리스트

## 📋 배포 전 준비사항

### 1. AWS Lightsail 계정 준비
- [ ] AWS 계정 생성 및 로그인
- [ ] 결제 수단 등록
- [ ] 서울 리전 선택 가능 확인

### 2. 도메인 준비
- [ ] 카페24 계정 생성
- [ ] 도메인 선택 및 구매
- [ ] DNS 관리 페이지 접근 확인

### 3. 로컬 환경 준비
- [ ] Git 설치 확인
- [ ] SSH 클라이언트 준비 (Windows: PowerShell 또는 PuTTY)
- [ ] 프로젝트 최종 테스트 완료

---

## 🚀 1단계: Lightsail 인스턴스 생성

### 인스턴스 생성
- [ ] [AWS Lightsail 콘솔](https://lightsail.aws.amazon.com/) 접속
- [ ] "인스턴스 생성" 클릭
- [ ] 위치: 아시아 태평양 (서울) 선택
- [ ] 플랫폼: Linux/Unix
- [ ] 블루프린트: Ubuntu 22.04 LTS
- [ ] 플랜: $5/월 (권장) 또는 $3.50/월
- [ ] 인스턴스 이름: `hospital-board-server`
- [ ] "인스턴스 생성" 클릭

### 고정 IP 할당
- [ ] 네트워킹 탭 → "고정 IP 생성"
- [ ] 생성한 인스턴스에 연결
- [ ] 고정 IP 이름 입력
- [ ] 고정 IP 주소 기록: `___________________`

### 방화벽 규칙
- [ ] SSH (TCP 22)
- [ ] HTTP (TCP 80)
- [ ] HTTPS (TCP 443)
- [ ] Custom TCP 3001 (임시, 테스트용)

---

## 💻 2단계: 서버 초기 설정

### SSH 접속
- [ ] Lightsail에서 SSH 키 다운로드
- [ ] SSH 접속 성공 확인
```bash
ssh -i "LightsailDefaultKey.pem" ubuntu@고정IP
```

### 초기 설정 스크립트 실행
```bash
# 프로젝트 클론 (또는 업로드)
cd ~
git clone https://github.com/사용자명/hospital-board.git
cd hospital-board

# 초기 설정 실행
cd deployment
chmod +x setup.sh
./setup.sh
```

체크:
- [ ] 시스템 업데이트 완료
- [ ] Node.js v20 설치 확인
- [ ] Nginx 설치 확인
- [ ] PM2 설치 확인
- [ ] Git 설치 확인

---

## 📦 3단계: 애플리케이션 배포

### 의존성 설치
```bash
cd ~/hospital-board

# 백엔드 의존성
cd backend
npm install --production

# 프론트엔드 의존성
cd ..
npm install
```

체크:
- [ ] 백엔드 의존성 설치 완료 (node_modules)
- [ ] 프론트엔드 의존성 설치 완료 (node_modules)

### 프론트엔드 빌드
```bash
cd ~/hospital-board
npm run build
```

체크:
- [ ] 빌드 성공 (dist/ 폴더 생성)
- [ ] dist/ 폴더 내용 확인: `ls -la dist/`

### 환경 변수 설정
```bash
cd ~/hospital-board/backend
cp ../deployment/env.example .env
nano .env
```

`.env` 내용:
```env
NODE_ENV=production
PORT=3001
```

체크:
- [ ] .env 파일 생성 완료

---

## 🌐 4단계: Nginx 설정

### Nginx 설정 파일 복사 및 수정
```bash
sudo cp ~/hospital-board/deployment/nginx-config.conf /etc/nginx/sites-available/hospital-board

# 설정 파일 편집 (server_name 수정)
sudo nano /etc/nginx/sites-available/hospital-board
```

**수정 필요:**
- `server_name` 부분을 고정 IP 주소로 변경
- 예: `server_name 123.45.67.89;`

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/hospital-board /etc/nginx/sites-enabled/

# 기본 설정 제거
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl status nginx
```

체크:
- [ ] Nginx 설정 파일 복사 완료
- [ ] server_name을 고정 IP로 수정
- [ ] nginx -t 성공
- [ ] Nginx 재시작 성공

---

## 🔄 5단계: 백엔드 서버 실행

### PM2 설정 및 실행
```bash
cd ~/hospital-board/backend
cp ../deployment/ecosystem.config.js .

# PM2로 백엔드 실행
pm2 start ecosystem.config.js

# PM2 자동 시작 설정
pm2 startup
# 출력된 명령어 실행 (sudo로 시작)

pm2 save
```

체크:
- [ ] PM2 설정 파일 복사 완료
- [ ] 백엔드 실행 성공: `pm2 status`
- [ ] 로그 확인: `pm2 logs hospital-backend --lines 20`
- [ ] PM2 자동 시작 설정 완료

---

## 🧪 6단계: 테스트

### HTTP 접속 테스트
- [ ] 브라우저에서 `http://고정IP` 접속
- [ ] 로그인 페이지 표시 확인
- [ ] 로그인 테스트 (cauhs / cauhs19415)
- [ ] 병원 관리 화면 정상 표시 확인

### API 테스트
```bash
# 서버에서
curl http://localhost:3001/api/doctors
```
- [ ] API 응답 정상

### WebSocket 테스트
- [ ] 브라우저 콘솔에서 WebSocket 연결 확인
- [ ] 실시간 데이터 업데이트 테스트

### 로그 확인
```bash
# 백엔드 로그
pm2 logs hospital-backend

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

체크:
- [ ] 모든 API 정상 동작
- [ ] WebSocket 연결 성공
- [ ] 에러 로그 없음

---

## 🌍 7단계: 도메인 연결

### 카페24 DNS 설정
1. 카페24 도메인 관리 페이지 접속
2. DNS 관리 또는 네임서버 설정
3. A 레코드 추가:

| 호스트명 | 타입 | 값 | TTL |
|---------|------|-----|-----|
| @ | A | Lightsail_고정IP | 3600 |
| www | A | Lightsail_고정IP | 3600 |

체크:
- [ ] A 레코드 추가 완료
- [ ] 도메인: `_____________________`
- [ ] 고정 IP: `_____________________`

### Nginx server_name 업데이트
```bash
sudo nano /etc/nginx/sites-available/hospital-board
```

**변경:**
```nginx
server_name yourdomain.com www.yourdomain.com;
```

```bash
sudo nginx -t
sudo systemctl restart nginx
```

체크:
- [ ] server_name을 도메인으로 변경
- [ ] Nginx 재시작 완료

### DNS 전파 대기 및 확인
```bash
# DNS 전파 확인
nslookup yourdomain.com
```

체크:
- [ ] DNS 전파 완료 (5분~48시간)
- [ ] `http://yourdomain.com` 접속 확인

---

## 🔒 8단계: SSL 인증서 설정

### Certbot 설치 및 인증서 발급
```bash
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

프롬프트 응답:
1. 이메일 주소 입력
2. 약관 동의: Y
3. 뉴스레터: N
4. HTTP → HTTPS 리다이렉트: 2 (권장)

체크:
- [ ] 인증서 발급 성공
- [ ] Nginx 자동 재시작
- [ ] `https://yourdomain.com` 접속 확인
- [ ] 자물쇠 아이콘 표시 확인

### 자동 갱신 테스트
```bash
sudo certbot renew --dry-run
```

체크:
- [ ] 자동 갱신 테스트 성공

---

## 🔧 9단계: 자동화 설정

### 백업 스크립트 설정
```bash
cp ~/hospital-board/deployment/backup-db.sh ~/
chmod +x ~/backup-db.sh

# Cron 설정
crontab -e
```

Cron에 추가:
```
0 3 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/logs/backup.log 2>&1
```

체크:
- [ ] 백업 스크립트 복사 완료
- [ ] Cron 설정 완료
- [ ] 수동 백업 테스트: `~/backup-db.sh`

### 배포 스크립트 설정
```bash
cp ~/hospital-board/deployment/deploy.sh ~/
chmod +x ~/deploy.sh
```

체크:
- [ ] 배포 스크립트 복사 완료
- [ ] 실행 권한 부여

---

## ✅ 10단계: 최종 확인

### 기능 테스트
- [ ] 로그인/로그아웃
- [ ] 환자 추가
- [ ] 환자 상태 변경
- [ ] 환자 삭제
- [ ] 당직 정보 수정
- [ ] 외래 진료 스케줄 수정
- [ ] 실시간 데이터 동기화 (여러 브라우저에서 테스트)

### 성능 확인
```bash
# PM2 모니터링
pm2 monit

# 서버 리소스 확인
free -h
df -h
```

체크:
- [ ] 메모리 사용량 정상
- [ ] 디스크 용량 충분
- [ ] CPU 사용량 정상

### 보안 확인
- [ ] SSH 키 로그인만 허용
- [ ] 방화벽 규칙 최소화
- [ ] HTTPS 강제 리다이렉트
- [ ] 데이터베이스 파일 권한 확인

---

## 📝 배포 완료 정보

**배포 완료 시간**: `___________________`

**서버 정보**:
- 고정 IP: `___________________`
- 도메인: `___________________`
- SSL: ✅ / ❌
- PM2 자동 시작: ✅ / ❌
- 자동 백업: ✅ / ❌

**접속 정보**:
- HTTP: `http://yourdomain.com` (HTTPS로 리다이렉트)
- HTTPS: `https://yourdomain.com`
- 로그인: cauhs / cauhs19415

**관리 명령어**:
```bash
# 서버 접속
ssh -i "LightsailDefaultKey.pem" ubuntu@고정IP

# 로그 확인
pm2 logs hospital-backend
sudo tail -f /var/log/nginx/access.log

# 재배포
cd ~
./deploy.sh

# 백엔드 재시작
pm2 restart hospital-backend

# Nginx 재시작
sudo systemctl restart nginx
```

---

## 🆘 문제 해결

### 502 Bad Gateway
1. 백엔드 서버 확인: `pm2 status`
2. 로그 확인: `pm2 logs hospital-backend`
3. 재시작: `pm2 restart hospital-backend`

### WebSocket 연결 실패
1. Nginx 설정 확인
2. 방화벽 확인
3. 브라우저 콘솔 에러 확인

### SSL 인증서 오류
1. 인증서 상태 확인: `sudo certbot certificates`
2. 수동 갱신: `sudo certbot renew`

---

**배포 가이드 참고**: `AWS_LIGHTSAIL_DEPLOYMENT.md`


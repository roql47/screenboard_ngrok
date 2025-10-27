# ⚡ 빠른 시작 가이드

AWS Lightsail에 Hospital Board를 10분 만에 배포하는 가이드입니다.

## 📋 준비물

- AWS 계정
- SSH 클라이언트
- 10분의 시간 ⏱️

## 🚀 1단계: Lightsail 인스턴스 생성 (3분)

1. [AWS Lightsail](https://lightsail.aws.amazon.com/)에 로그인
2. "인스턴스 생성" 클릭
3. 설정:
   - **위치**: 서울
   - **OS**: Ubuntu 22.04 LTS
   - **플랜**: $5/월
   - **이름**: `hospital-board-server`
4. "인스턴스 생성" 클릭
5. "네트워킹" → "고정 IP 생성" → 인스턴스에 연결
6. 방화벽에 포트 추가:
   - TCP 22 (SSH)
   - TCP 80 (HTTP)
   - TCP 443 (HTTPS)

## 💻 2단계: 서버 접속 (1분)

Lightsail 콘솔에서 "SSH를 사용하여 연결" 클릭

또는 로컬에서:
```bash
ssh -i LightsailDefaultKey.pem ubuntu@고정IP
```

## 📦 3단계: 자동 설치 (5분)

서버에 접속한 후 다음 명령어를 **순서대로** 실행:

```bash
# 1. 프로젝트 클론
cd ~
git clone https://github.com/사용자명/hospital-board.git
cd hospital-board

# 2. 자동 설치 스크립트 실행
cd deployment
chmod +x setup.sh
./setup.sh

# 3. 의존성 설치 및 빌드
cd ~/hospital-board
npm install
cd backend && npm install
cd ..
npm run build

# 4. 백엔드 실행
cd backend
pm2 start ../deployment/ecosystem.config.js
pm2 startup
# 출력된 명령어 실행 (sudo로 시작하는 명령어)
pm2 save

# 5. Nginx 설정
고정_IP=$(curl -s ifconfig.me)
sudo cp ../deployment/nginx-config.conf /etc/nginx/sites-available/hospital-board
sudo sed -i "s/고정IP주소/$고정_IP/g" /etc/nginx/sites-available/hospital-board
sudo ln -s /etc/nginx/sites-available/hospital-board /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## ✅ 4단계: 접속 테스트 (1분)

브라우저에서 접속:
```
http://고정IP주소
```

**로그인 정보**:
- 사용자명: `cauhs`
- 비밀번호: `cauhs19415`

## 🌍 도메인 연결 (옵션)

### 카페24에서 구매한 도메인 연결

1. **카페24 DNS 설정**:
   - A 레코드: `@` → Lightsail 고정 IP
   - A 레코드: `www` → Lightsail 고정 IP

2. **Nginx 업데이트**:
```bash
sudo nano /etc/nginx/sites-available/hospital-board
```

`server_name` 수정:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

```bash
sudo nginx -t
sudo systemctl restart nginx
```

3. **SSL 인증서 발급**:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 🎉 완료!

이제 다음 주소에서 병원 관리 시스템에 접속할 수 있습니다:
- HTTP: `http://yourdomain.com` (자동 HTTPS 리다이렉트)
- HTTPS: `https://yourdomain.com`

## 📚 다음 단계

- [전체 배포 가이드](../AWS_LIGHTSAIL_DEPLOYMENT.md) 읽기
- [배포 체크리스트](./DEPLOYMENT_CHECKLIST.md) 확인
- 자동 백업 설정 (선택사항)

## 🔧 자주 사용하는 명령어

```bash
# 백엔드 상태 확인
pm2 status

# 로그 확인
pm2 logs hospital-backend

# 백엔드 재시작
pm2 restart hospital-backend

# Nginx 재시작
sudo systemctl restart nginx

# 재배포
cd ~/hospital-board
git pull
npm run build
pm2 restart hospital-backend
```

## 🆘 문제 발생 시

### 502 Bad Gateway
```bash
pm2 restart hospital-backend
```

### 페이지가 열리지 않음
```bash
# Nginx 상태 확인
sudo systemctl status nginx

# 방화벽 확인 (Lightsail 콘솔)
```

### WebSocket 연결 실패
```bash
# Nginx 설정 확인
sudo nginx -t

# Nginx 로그 확인
sudo tail -f /var/log/nginx/error.log
```

---

**전체 가이드**: [AWS_LIGHTSAIL_DEPLOYMENT.md](../AWS_LIGHTSAIL_DEPLOYMENT.md)


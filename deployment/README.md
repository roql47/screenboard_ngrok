# 배포 파일 설명

이 디렉토리에는 AWS Lightsail 배포에 필요한 모든 설정 파일과 스크립트가 포함되어 있습니다.

## 📁 파일 목록

### 문서
- **AWS_LIGHTSAIL_DEPLOYMENT.md**: 전체 배포 가이드 (루트에 위치)

### 설정 파일
- **ecosystem.config.js**: PM2 프로세스 관리 설정
- **nginx-config.conf**: Nginx 웹 서버 설정
- **.env.example**: 환경 변수 예시

### 스크립트
- **setup.sh**: 서버 초기 설정 스크립트 (한 번만 실행)
- **deploy.sh**: 빠른 배포 스크립트
- **backup-db.sh**: 데이터베이스 자동 백업 스크립트

## 🚀 빠른 시작

### 1. 서버 초기 설정 (최초 1회)
```bash
cd ~/hospital-board/deployment
chmod +x setup.sh
./setup.sh
```

### 2. 백엔드 PM2 설정
```bash
cp ecosystem.config.js ~/hospital-board/backend/
cd ~/hospital-board/backend
pm2 start ecosystem.config.js
pm2 save
```

### 3. Nginx 설정
```bash
sudo cp nginx-config.conf /etc/nginx/sites-available/hospital-board
sudo ln -s /etc/nginx/sites-available/hospital-board /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 환경 변수 설정
```bash
cp .env.example ~/hospital-board/backend/.env
nano ~/hospital-board/backend/.env
```

### 5. 백업 스크립트 설정
```bash
cp backup-db.sh ~/
chmod +x ~/backup-db.sh

# Cron 설정 (매일 새벽 3시 백업)
crontab -e
# 다음 라인 추가:
# 0 3 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/logs/backup.log 2>&1
```

### 6. 배포 스크립트 설정
```bash
cp deploy.sh ~/
chmod +x ~/deploy.sh

# 이후 배포 시:
cd ~
./deploy.sh
```

## 📝 사용 예시

### 코드 업데이트 배포
```bash
# Git push 후 서버에서:
cd ~/hospital-board
git pull
./deploy.sh
```

### 수동 배포
```bash
# 프론트엔드 빌드
cd ~/hospital-board
npm run build

# 백엔드 재시작
pm2 restart hospital-backend
```

### 로그 확인
```bash
# PM2 로그
pm2 logs hospital-backend

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔧 트러블슈팅

### PM2가 자동 시작되지 않을 때
```bash
pm2 startup
# 출력된 명령어 실행
pm2 save
```

### Nginx 502 에러
```bash
# 백엔드 서버 확인
pm2 status
pm2 logs hospital-backend

# 포트 확인
sudo netstat -tulpn | grep 3001
```

### 메모리 부족
```bash
# Swap 사용량 확인
free -h

# PM2 메모리 제한 조정
pm2 restart hospital-backend --max-memory-restart 1G
```

## 📚 추가 자료

전체 배포 가이드는 루트의 `AWS_LIGHTSAIL_DEPLOYMENT.md` 파일을 참고하세요.


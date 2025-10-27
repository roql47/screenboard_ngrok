#!/bin/bash
#
# AWS Lightsail 초기 설정 스크립트
# 새 서버에서 한 번만 실행
#

set -e

echo "🔧 AWS Lightsail 서버 초기 설정 시작..."

# 1. 시스템 업데이트
echo "📥 시스템 업데이트 중..."
sudo apt update && sudo apt upgrade -y

# 2. Node.js 설치 (v20 LTS)
echo "📦 Node.js 설치 중..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. 필수 도구 설치
echo "🛠️ 필수 도구 설치 중..."
sudo apt install -y git nginx sqlite3 build-essential

# 4. PM2 전역 설치
echo "⚙️ PM2 설치 중..."
sudo npm install -g pm2

# 5. 로그 디렉토리 생성
echo "📁 디렉토리 생성 중..."
mkdir -p ~/logs
mkdir -p ~/backups

# 6. 방화벽 설정 (UFW)
echo "🔒 방화벽 설정 중..."
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw --force enable

# 7. Swap 파일 생성 (메모리 부족 방지)
echo "💾 Swap 파일 생성 중..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# 8. 버전 확인
echo ""
echo "✅ 설치 완료! 버전 확인:"
echo "   Node.js: $(node -v)"
echo "   NPM: $(npm -v)"
echo "   PM2: $(pm2 -v)"
echo "   Nginx: $(nginx -v 2>&1 | grep -oP 'nginx/\K[0-9.]+')"
echo ""
echo "🎉 서버 설정이 완료되었습니다!"
echo ""
echo "📝 다음 단계:"
echo "   1. 프로젝트 클론: git clone <repository-url>"
echo "   2. 배포 가이드 참고: cat AWS_LIGHTSAIL_DEPLOYMENT.md"


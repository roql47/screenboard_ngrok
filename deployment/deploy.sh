#!/bin/bash
#
# 빠른 배포 스크립트
# 사용법: ./deploy.sh
#

set -e  # 에러 발생 시 즉시 중단

echo "🚀 Hospital Board 배포 시작..."

# 프로젝트 디렉토리
PROJECT_DIR="/home/ubuntu/hospital-board"

# 1. Git Pull (최신 코드 가져오기)
echo "📥 Git에서 최신 코드 가져오는 중..."
cd $PROJECT_DIR
git pull origin main

# 2. 백엔드 의존성 업데이트
echo "📦 백엔드 의존성 업데이트 중..."
cd $PROJECT_DIR/backend
npm install --production

# 3. 프론트엔드 의존성 업데이트
echo "📦 프론트엔드 의존성 업데이트 중..."
cd $PROJECT_DIR
npm install

# 4. 프론트엔드 빌드
echo "🔨 프론트엔드 빌드 중..."
npm run build

# 5. 백엔드 재시작
echo "🔄 백엔드 서버 재시작 중..."
pm2 restart hospital-backend

# 6. 배포 완료
echo "✅ 배포 완료!"
echo ""
echo "📊 서버 상태:"
pm2 status

echo ""
echo "📝 최근 로그 (5줄):"
pm2 logs hospital-backend --lines 5 --nostream

echo ""
echo "🌐 배포된 버전 확인:"
echo "   - HTTP: http://$(curl -s ifconfig.me)"
echo ""
echo "💡 추가 명령어:"
echo "   pm2 logs hospital-backend  # 로그 확인"
echo "   pm2 monit                  # 실시간 모니터링"


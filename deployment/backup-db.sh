#!/bin/bash
#
# SQLite 데이터베이스 자동 백업 스크립트
# Cron으로 매일 자동 실행 권장
#

BACKUP_DIR="/home/ubuntu/backups"
DB_PATH="/home/ubuntu/hospital-board/backend/hospital.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/hospital_$DATE.db"

# 백업 디렉토리 생성 (없으면)
mkdir -p $BACKUP_DIR

# 백업 실행
echo "[$(date)] Starting database backup..."
if sqlite3 $DB_PATH ".backup $BACKUP_FILE"; then
    echo "[$(date)] Backup completed: $BACKUP_FILE"
    
    # 백업 파일 압축
    gzip $BACKUP_FILE
    echo "[$(date)] Backup compressed: ${BACKUP_FILE}.gz"
    
    # 7일 이상 된 백업 삭제
    find $BACKUP_DIR -name "hospital_*.db.gz" -mtime +7 -delete
    echo "[$(date)] Old backups cleaned up (>7 days)"
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

# 백업 통계
BACKUP_COUNT=$(ls -1 $BACKUP_DIR/hospital_*.db.gz 2>/dev/null | wc -l)
echo "[$(date)] Total backups: $BACKUP_COUNT"


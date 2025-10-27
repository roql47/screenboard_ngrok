module.exports = {
  apps: [{
    name: 'hospital-backend',
    script: './server.js',
    cwd: '/home/ubuntu/hospital-board/backend',
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
    max_memory_restart: '500M',
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
  }]
}


// ============================================================
// NEUROTEK AI — PM2 Ecosystem Config
// ============================================================
// Usage:
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save && pm2 startup
// ============================================================

module.exports = {
  apps: [
    {
      name: 'neurotek-api',
      script: 'dist/index.js',
      interpreter: 'node',

      // Cluster mode for multi-core utilisation
      instances: 'max',
      exec_mode: 'cluster',

      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080,
      },

      // Restart policy
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: true,

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/neurotek/error.log',
      out_file: '/var/log/neurotek/out.log',
      merge_logs: true,
      log_type: 'json',

      // Memory limit — restart if exceeds 1 GB
      max_memory_restart: '1G',

      // Watch (production: off)
      watch: false,
      ignore_watch: ['node_modules', 'dist', '*.log'],

      // Source maps for better error stacks
      source_map_support: true,
    },
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: process.env.DEPLOY_HOST ?? 'server.neurotek.ai',
      ref: 'origin/main',
      repo: 'git@github.com:mixpiloteai-oss/mixpiloteai.git',
      path: '/var/www/neurotek',
      'pre-deploy-local': '',
      'post-deploy':
        'cd backend && npm ci --omit=dev && npm run build && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': '',
    },
  },
};

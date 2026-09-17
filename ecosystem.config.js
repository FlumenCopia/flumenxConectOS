module.exports = {
  apps: [
    {
      name: 'conectos-backend',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 5040,
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      merge_logs: true,
    },
    {
      name: 'conectos-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3040',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3040,
      },
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      merge_logs: true,
    },
  ],
};

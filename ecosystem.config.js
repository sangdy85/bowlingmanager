module.exports = {
  apps: [
    {
      name: 'bowling-manager',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};

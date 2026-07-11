module.exports = {
  apps: [
    {
      name: "rcs-api",
      script: "apps/api/dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: "4000"
      }
    },
    {
      name: "rcs-web",
      script: "npm",
      args: "run start -w apps/web",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};

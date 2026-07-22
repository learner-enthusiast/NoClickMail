/** PM2 process definitions — used by production deploy (see .github/workflows/deploy.yml). */
module.exports = {
  apps: [
    {
      name: "api",
      cwd: "./apps/api",
      script: "pnpm",
      args: "start",
      interpreter: "none",
    },
    {
      name: "web",
      cwd: "./apps/web",
      script: "pnpm",
      args: "start",
      interpreter: "none",
    },
    {
      name: "course-web",
      cwd: "./apps/course-web",
      script: "pnpm",
      args: "start",
      interpreter: "none",
    },
  ],
};

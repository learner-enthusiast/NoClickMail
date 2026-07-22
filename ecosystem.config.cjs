const path = require("node:path");

/** Repo root — ecosystem file lives at monorepo root. */
const root = __dirname;

/**
 * PM2 process definitions (production deploy — see .github/workflows/deploy.yml).
 *
 * Uses bash -lc so pnpm/corepack/nvm are on PATH for the deploy user.
 * Relative cwd alone + script:"pnpm" + interpreter:"none" fails on some hosts
 * with: /usr/bin/bash: start: No such file or directory
 */
module.exports = {
  apps: [
    {
      name: "api",
      cwd: path.join(root, "apps/api"),
      script: "/usr/bin/bash",
      args: ["-lc", "pnpm start"],
      env: { NODE_ENV: "production" },
    },
    {
      name: "web",
      cwd: path.join(root, "apps/web"),
      script: "/usr/bin/bash",
      args: ["-lc", "pnpm start"],
      env: { NODE_ENV: "production" },
    },
    {
      name: "course-web",
      cwd: path.join(root, "apps/course-web"),
      script: "/usr/bin/bash",
      args: ["-lc", "pnpm start"],
      env: { NODE_ENV: "production" },
    },
  ],
};

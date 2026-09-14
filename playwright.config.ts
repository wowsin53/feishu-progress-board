import { defineConfig } from '@playwright/test'
// Start npm run dev in another terminal before running browser tests.
// Keeping the preview user-owned also avoids Windows process-tree teardown issues.
export default defineConfig({testDir:'tests/browser',timeout:60000,fullyParallel:false,use:{baseURL:'http://127.0.0.1:5173',channel:'msedge',screenshot:'only-on-failure'}})

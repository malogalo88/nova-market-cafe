import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export default function globalSetup() {
  const root = process.cwd()
  const dbPath = path.join(root, 'prisma', 'test.db')
  for (const f of [dbPath, dbPath + '-journal']) {
    if (fs.existsSync(f)) fs.rmSync(f)
  }
  execSync('npx prisma db push --skip-generate', {
    cwd: root,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit'
  })
}

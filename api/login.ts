import { handleLogin } from '../server/api.js'
import { deps } from '../server/deps.js'

export function POST(req: Request) {
  return handleLogin(req, deps())
}

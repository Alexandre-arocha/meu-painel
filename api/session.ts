import { handleSession } from '../server/api.js'
import { deps } from '../server/deps.js'

export function GET(req: Request) {
  return handleSession(req, deps())
}

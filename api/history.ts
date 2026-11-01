import { handleHistory } from '../server/api.js'
import { deps } from '../server/deps.js'

export function GET(req: Request) {
  return handleHistory(req, deps())
}

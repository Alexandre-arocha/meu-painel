import { handleFeed } from '../../server/api.js'
import { deps } from '../../server/deps.js'

export function GET(req: Request) {
  return handleFeed(req, deps())
}

import { handleBrapi } from '../../server/api.js'
import { deps } from '../../server/deps.js'

export function GET(req: Request) {
  const endpoint = new URL(req.url).pathname.split('/').pop() ?? ''
  return handleBrapi(req, endpoint, deps())
}

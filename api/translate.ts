import { handleTranslate } from '../server/api.js'
import { deps } from '../server/deps.js'

export function POST(req: Request) {
  return handleTranslate(req, deps())
}

import { handleData } from '../server/api.js'
import { deps } from '../server/deps.js'

export function GET(req: Request) {
  return handleData(req, deps())
}

export function PUT(req: Request) {
  return handleData(req, deps())
}

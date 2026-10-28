import { handleLogout } from '../server/api.js'

export function POST() {
  return handleLogout()
}

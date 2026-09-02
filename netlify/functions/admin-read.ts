import type { Config } from '@netlify/functions'
import { dispatchAdminRequest } from './_lib/admin-router'

export default dispatchAdminRequest

export const config: Config = {
  path: '/api/admin/read/*',
  rateLimit: {
    action: 'rate_limit',
    windowLimit: 180,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
}

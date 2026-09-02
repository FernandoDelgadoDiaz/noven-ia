import type { Config } from '@netlify/functions'
import { dispatchAdminRequest } from './_lib/admin-router'

export default dispatchAdminRequest

export const config: Config = {
  path: '/api/admin/write/*',
  rateLimit: {
    action: 'rate_limit',
    windowLimit: 20,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
}

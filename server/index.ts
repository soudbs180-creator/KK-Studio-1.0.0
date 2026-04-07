let express: any
let app: any
try {
  // 动态加载 express，避免在环境中没有安装 express 的情况下失败
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  express = require('express')
  app = express()
  // 尝试安装 JSON 解析中间件
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bodyParser = require('body-parser')
    app.use(bodyParser.json())
  } catch {
    // 允许缺少 body-parser 时退回 express 内置 JSON 解析
    app.use(express.json())
  }
} catch (error) {
  throw new Error(
    `Legacy server cannot start because express is unavailable: ${error instanceof Error ? error.message : String(error)}`
  )
}
import { mountBillingRoutes } from './billing_routes.ts'
import { mountTurnstileRoutes } from './turnstile_routes.ts'
import { mountAuthRoutes } from './auth_routes.ts'

mountBillingRoutes(app)
mountTurnstileRoutes(app)
mountAuthRoutes(app)

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
app.listen(PORT, () => {
  console.log(`Billing service listening on port ${PORT}`)
})

import express from 'express'
import { mountBillingRoutes } from './billing_routes.ts'
import { mountTurnstileRoutes } from './turnstile_routes.ts'
import { mountAuthRoutes } from './auth_routes.ts'

const app = express()
app.use(express.json())

mountBillingRoutes(app)
mountTurnstileRoutes(app)
mountAuthRoutes(app)

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
app.listen(PORT, () => {
  console.log(`Billing service listening on port ${PORT}`)
})

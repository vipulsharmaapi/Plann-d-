import { createApp } from './server/app.js'

// Hostinger provides PORT and build/runtime variables. Node's optional dotenv
// support keeps local preview identical without adding a secret to the source.
try {
  process.loadEnvFile()
} catch {
  /* Hostinger may inject variables directly. */
}
const port = Number(process.env.PORT || 3000)
const server = createApp().listen(port, '0.0.0.0', () =>
  console.log(`Plann’d listening on ${port}`),
)
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => process.exit(0)))

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // A production build bakes VITE_API_URL into the bundle. A local .env that
  // points at localhost would ship a site that can't reach the API, so refuse.
  const { VITE_API_URL = '' } = loadEnv(mode, process.cwd(), '')
  if (mode === 'production' && /\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(VITE_API_URL)) {
    throw new Error(
      `VITE_API_URL is ${VITE_API_URL} for a production build. Put the production URL ` +
      '(or nothing, which means https://api.gradiate.app/) in .env.production.local, ' +
      'or build with --mode development.'
    )
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})

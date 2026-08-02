import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'vite-plugin-javascript-obfuscator'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Ofuscacion del bundle: solo en build de produccion.
    // No afecta a `npm run dev` ni a las Netlify Functions (esas las bundlea
    // Netlify aparte desde netlify/functions, fuera del pipeline de Vite).
    obfuscator({
      apply: 'build',
      // Solo codigo propio. node_modules queda fuera: es publico igualmente
      // y ofuscarlo dispara el tiempo de build y el riesgo de romper libs.
      include: [/src\/.*\.(jsx?|tsx?)$/],
      exclude: [/node_modules/, /netlify\//],
      options: {
        target: 'browser',
        compact: true,
        // CRITICO: los specifiers de `import('../pages/X')` deben quedar como
        // literales o Rollup no puede analizarlos y se pierde el code-splitting
        // de las rutas lazy (quedarian como imports en runtime que dan 404).
        reservedStrings: ['^\\.{1,2}/'],
        // Flujo de control: alto impacto. 0.5 mantiene el costo en runtime acotado.
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.5,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.2,
        identifierNamesGenerator: 'hexadecimal',
        numbersToExpressions: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 8,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 2,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 4,
        stringArrayWrappersType: 'function',
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
        // Desactivados a proposito:
        // - selfDefending / debugProtection dependen del formato del codigo y
        //   Vite minifica DESPUES de esta transformacion, lo que los rompe.
        // - renameGlobals romperia los bindings ESM entre modulos.
        selfDefending: false,
        debugProtection: false,
        renameGlobals: false,
        sourceMap: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

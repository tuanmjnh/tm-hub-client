import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')
mkdirSync(dist, { recursive: true })

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const distPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  type: pkg.type,
  main: './index.cjs',
  module: './index.js',
  types: './index.d.ts',
  exports: {
    '.': {
      types: './index.d.ts',
      import: './index.js',
      require: './index.cjs'
    },
    './package.json': './package.json'
  },
  files: ['*'],
  keywords: pkg.keywords,
  author: pkg.author,
  license: pkg.license,
  publishConfig: pkg.publishConfig
}

writeFileSync(join(dist, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n')
copyFileSync(join(root, 'README.md'), join(dist, 'README.md'))

console.log('✓ dist/package.json prepared for publish')

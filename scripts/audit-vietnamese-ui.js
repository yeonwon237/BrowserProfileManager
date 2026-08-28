const fs = require('fs')
const path = require('path')
const espree = require('espree')

const rendererRoot = path.join(__dirname, '..', 'src', 'renderer')
const dictionarySource = fs.readFileSync(path.join(rendererRoot, 'i18n', 'vi.js'), 'utf8')
const files = []

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) scan(target)
    else if (/\.(js|jsx)$/.test(entry.name) && !target.endsWith(path.join('i18n', 'vi.js'))) files.push(target)
  }
}

function isLikelyTechnicalValue(value) {
  return /^(\.|\/|#|https?:|[a-z]+\/[a-z]|[a-z][a-z0-9_-]*\.[a-z0-9]+|[a-z0-9_-]+:[a-z0-9_-]+)$/i.test(value)
}

function walk(node, parent, output) {
  if (!node || typeof node !== 'object') return
  if (node.type === 'JSXText') {
    const value = node.value.replace(/\s+/g, ' ').trim()
    if (/[A-Za-z]{2}/.test(value)) output.add(value)
  }
  if (node.type === 'Literal' && typeof node.value === 'string' && /[A-Za-z]{2}/.test(node.value)) {
    const isVisibleAttribute = parent?.type === 'JSXAttribute' && ['placeholder', 'title', 'aria-label'].includes(parent.name?.name)
    const isUserMessage = parent?.type === 'CallExpression' && ['setError', 'setNotice', 'showError', 'confirm', 'alert'].includes(parent.callee?.name)
    if ((isVisibleAttribute || isUserMessage) && !isLikelyTechnicalValue(node.value)) output.add(node.value)
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue
    if (Array.isArray(value)) value.forEach((child) => walk(child, node, output))
    else walk(value, node, output)
  }
}

scan(rendererRoot)
const candidates = new Set()
for (const file of files) {
  const ast = espree.parse(fs.readFileSync(file, 'utf8'), {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  })
  walk(ast, null, candidates)
}

const missing = [...candidates].filter((value) => {
  const singleQuoted = `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
  const doubleQuoted = JSON.stringify(value)
  return !dictionarySource.includes(singleQuoted) && !dictionarySource.includes(doubleQuoted)
}).sort((a, b) => a.localeCompare(b))

if (missing.length) {
  console.error(`Vietnamese UI dictionary is missing ${missing.length} candidate string(s):`)
  missing.forEach((value) => console.error(value))
  process.exitCode = 1
} else {
  console.log('✓ Vietnamese UI dictionary covers all static renderer strings')
}

/**
 * Minimal browser compatibility layer.
 *
 * Fingerprint signals are owned by runtimeIdentity.js. This module deliberately
 * does not wrap Canvas, WebGL, Audio, plugins, MIME types, permissions or
 * Function.prototype.toString. Native Chromium behavior is preferred.
 */

function getStealthInitScript() {
  return `(() => {
    // Mode: native-first browser isolation and stealth initialization layer.
    // Preserves native browser capabilities without adding detectable global properties.
    // Designed to maintain strict standard conformance and zero detectable surface signatures.
    const _root = typeof globalThis !== 'undefined' ? globalThis : window
    if (!_root) return
  })()`
}

function shouldApplyToEngine(engine) {
  return String(engine || '').toLowerCase() === 'chromium'
}

async function installForContext(context, engine) {
  if (!shouldApplyToEngine(engine)) return { applied: false, engine, mode: 'native' }
  if (!context || typeof context.addInitScript !== 'function') throw new Error('Browser context does not support init scripts')
  await context.addInitScript(getStealthInitScript())
  return { applied: true, engine, mode: 'native-first' }
}

module.exports = { getStealthInitScript, shouldApplyToEngine, installForContext }

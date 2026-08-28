if (!process.env.CSC_LINK) {
  console.error('Signed release blocked: CSC_LINK is required (certificate file, base64 data, or secure URL).')
  process.exit(1)
}

console.log('Code-signing credential detected; continuing with the signed release pipeline.')

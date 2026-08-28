const crypto = require('crypto')

const SAMPLE_MARKETPLACE_PLUGINS = [
  {
    id: 'official-serp-scraper',
    name: 'Google SERP Extractor',
    description: 'Extracts organic search ranking and titles for given search keywords.',
    version: '1.2.0',
    publisher: 'YNlogin Official',
    isOfficial: true,
    permissions: ['browser.page', 'browser.navigation'],
    category: 'Scraping',
    rating: 4.9,
    downloads: 1420,
    checksum: 'a8b4f2c91d8e7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b',
  },
  {
    id: 'official-social-poster',
    name: 'Social Auto-Poster',
    description: 'Publishes scheduled posts to Twitter/X and LinkedIn profiles.',
    version: '2.0.1',
    publisher: 'YNlogin Official',
    isOfficial: true,
    permissions: ['browser.page', 'browser.navigation', 'browser.screenshot'],
    category: 'Social Media',
    rating: 4.8,
    downloads: 2850,
    checksum: 'c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
  },
  {
    id: 'community-amazon-tracker',
    name: 'Amazon Price Tracker',
    description: 'Monitors product buy-box prices and alerts on price drops.',
    version: '1.0.0',
    publisher: 'Community Dev (Unverified)',
    isOfficial: false,
    permissions: ['browser.page', 'browser.navigation', 'network'],
    category: 'E-Commerce',
    rating: 4.3,
    downloads: 420,
    checksum: 'e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8',
  },
]

class PluginMarketplace {
  constructor() {
    this.catalog = [...SAMPLE_MARKETPLACE_PLUGINS]
  }

  getCatalog(options = {}) {
    let list = [...this.catalog]
    if (options.category) {
      list = list.filter((p) => p.category === options.category)
    }
    if (options.officialOnly) {
      list = list.filter((p) => p.isOfficial)
    }
    if (options.search) {
      const q = options.search.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    return list
  }

  getPluginDetails(id) {
    const p = this.catalog.find((item) => item.id === id)
    if (!p) return null
    return {
      ...p,
      trustWarning: !p.isOfficial ? 'Third-Party Plugin: Verify code review before enabling permissions' : null,
    }
  }

  verifyPluginChecksum(fileBuffer, expectedChecksum) {
    if (!fileBuffer || !expectedChecksum) return false
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
    return hash.toLowerCase() === String(expectedChecksum).toLowerCase()
  }
}

const pluginMarketplace = new PluginMarketplace()

module.exports = {
  SAMPLE_MARKETPLACE_PLUGINS,
  PluginMarketplace,
  pluginMarketplace,
}

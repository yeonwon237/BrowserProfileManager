const assert = require('assert')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { _electron: electron } = require('playwright')

async function run() {
  const appData = path.join(os.tmpdir(), `ynlogin-electron-e2e-${Date.now()}`)
  const electronApp = await electron.launch({
    args: ['.', '--disable-gpu'],
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, APPDATA: appData, NODE_ENV: 'test', YNLOGIN_E2E_DIST: '1' },
    timeout: 30_000,
  })
  try {
    const page = await electronApp.firstWindow({ timeout: 20_000 })
    page.on('pageerror', (error) => console.error('[renderer page error]', error))
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('YNlogin', { exact: false }).first().waitFor({ timeout: 15_000 })
    const bridge = await page.evaluate(async () => ({
      isolated: typeof window.require === 'undefined',
      versions: await window.electronAPI.getAppVersions(),
      profiles: await window.electronAPI.getProfiles({}),
    }))
    assert.strictEqual(bridge.isolated, true, 'renderer must keep Node integration disabled')
    assert.strictEqual(bridge.versions.app, '1.2.0')
    assert(Array.isArray(bridge.profiles))

    // Every primary area must be reachable in the packaged renderer without
    // tripping the application error boundary.
    const primaryRoutes = [
      '/dashboard',
      '/profiles',
      '/automation',
      '/proxies',
      '/data-tools',
      '/logs',
      '/settings',
    ]
    for (const route of primaryRoutes) {
      await page.locator(`a[href="#${route}"]`).click()
      await page.waitForURL((url) => url.hash === `#${route}`, { timeout: 10_000 })
      await page.getByRole('main').waitFor({ state: 'visible', timeout: 10_000 })
      assert.strictEqual(await page.locator('body').getAttribute('data-error-boundary'), null, `${route} must render without an error boundary`)
    }

    // Regression: Dashboard quick-create must use ProfileFormModal's current
    // onSubmit contract (the legacy onSave prop caused "c is not a function"
    // in minified production bundles).
    await page.locator('a[href="#/dashboard"]').click()
    await page.getByRole('button', { name: /New Profile|Hồ sơ mới/i }).first().click()
    await page.getByPlaceholder(/Profile 001|Hồ sơ 001/i).fill('E2E Dashboard Profile')
    await page.getByRole('button', { name: /Create Profile|Tạo Profile/i }).click()
    await page.getByText(/Create New Profile|Tạo New Profile/i).waitFor({ state: 'hidden', timeout: 10_000 })
    const dashboardCreatedProfiles = await page.evaluate(() => window.electronAPI.getProfiles({}))
    assert(dashboardCreatedProfiles.some((profile) => profile.name === 'E2E Dashboard Profile'))

    // Regression: create a profile through the actual production-rendered form.
    // This covers the renderer -> preload -> IPC -> database path, including
    // the default environment validation used by a brand-new profile.
    await page.locator('a[href="#/profiles"]').click()
    await page.getByRole('button', { name: /New Profile|Hồ sơ mới/i }).first().click()
    await page.getByPlaceholder(/Profile 001|Hồ sơ 001/i).fill('E2E Create Profile')
    await page.getByRole('button', { name: /Create Profile|Tạo Profile/i }).click()
    await page.getByText('E2E Create Profile', { exact: true }).waitFor({ timeout: 10_000 })
    const createdProfiles = await page.evaluate(() => window.electronAPI.getProfiles({}))
    assert(createdProfiles.some((profile) => profile.name === 'E2E Create Profile'))

    await page.getByRole('button', { name: 'Tạo hàng loạt' }).click()
    await page.getByRole('heading', { name: 'Tạo hàng loạt hồ sơ' }).waitFor()
    await page.getByRole('button', { name: 'Ngẫu nhiên' }).waitFor()
    await page.getByRole('button', { name: 'Danh sách riêng' }).waitFor()
    await page.getByRole('button', { name: 'Tự cấu hình' }).waitFor()
    await page.getByRole('button', { name: 'Hủy' }).click()

    const moreButton = page.getByTitle(/More actions|Thêm thao tác/).first()
    await moreButton.click()
    const menuItem = page.getByRole('button', { name: /Open profile|Mở hồ sơ/ }).last()
    await menuItem.waitFor()
    const menuBox = await menuItem.locator('..').boundingBox()
    const viewportHeight = await page.evaluate(() => window.innerHeight)
    assert(menuBox && menuBox.y >= 0 && menuBox.y + menuBox.height <= viewportHeight, 'profile menu must stay inside the viewport')
    await page.locator('.fixed.inset-0.z-40').click({ position: { x: 5, y: 5 } })

    await page.locator('a[href="#/extensions"]').click()
    await page.getByRole('main').getByRole('heading', { name: /Extension Manager|Quản lý tiện ích/ }).waitFor()
    await page.getByRole('button', { name: /Import .crx|Nhập tệp .crx/ }).waitFor()
    await page.locator('a[href="#/synchronizer"]').click()
    await page.getByRole('main').getByRole('heading', { name: /Synchronizer|Đồng bộ thao tác/i }).waitFor()
    await page.locator('a[href="#/team-sync"]').click()
    await page.getByRole('main').getByRole('heading', { name: /Team Sync|Đồng bộ nhóm/ }).waitFor()
    const syncStatus = await page.evaluate(() => window.electronAPI.getTeamSyncStatus('default'))
    assert.strictEqual(syncStatus.configured, false)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(syncStatus, 'secret'), false, 'sync status must never expose encryption secrets')
    assert.strictEqual(await page.locator('body').getAttribute('data-error-boundary'), null)
  } finally {
    await electronApp.close()
    fs.rmSync(appData, { recursive: true, force: true })
  }
  console.log('✓ Electron main/renderer/preload isolation and new feature navigation verified end-to-end')
}

run().catch((error) => { console.error(error); process.exit(1) })

const assert = require('assert')
const { getDb, closeDb } = require('../src/main/database')
const notifManager = require('../src/main/notifications/manager')

async function runTests() {
  console.log('=== STARTING BƯỚC 35: NOTIFICATION CENTER TESTS ===\n')

  const db = await getDb()
  db.run('DELETE FROM notifications')

  console.log('[Test 1] Notification creation, severities & secret redaction...')
  const n1 = await notifManager.addNotification({
    type: 'browser_crash',
    title: 'Profile "Trader 01" Crashed',
    message: 'Browser process terminated unexpectedly (exit code 1).',
    severity: 'error',
    metadata: {
      profile_id: 'prof-123',
      session_cookie: 'leaked_cookie_secret',
      auth_token: 'secret_token_xyz',
      password: 'mypassword',
    },
  })

  assert(n1.id, 'Notification ID must be generated')
  assert.strictEqual(n1.severity, 'error')
  assert.strictEqual(n1.metadata.profile_id, 'prof-123')
  assert.strictEqual(n1.metadata.session_cookie, undefined, 'Cookies must be stripped from notification metadata')
  assert.strictEqual(n1.metadata.auth_token, undefined, 'Auth token must be stripped from notification metadata')
  assert.strictEqual(n1.metadata.password, undefined, 'Password must be stripped from notification metadata')

  const n2 = await notifManager.addNotification({
    type: 'backup_completed',
    title: 'Backup Successful',
    message: 'Database archived; Authorization: Bearer should-never-leak token=hidden-value',
    severity: 'info',
  })
  assert.strictEqual(n2.severity, 'info')
  assert(!n2.message.includes('should-never-leak') && !n2.message.includes('hidden-value'), 'notification text must redact secrets')
  console.log('✓ Notifications recorded with correct severities and sensitive secrets stripped')

  console.log('\n[Test 2] Querying notifications and unread count...')
  let queryRes = await notifManager.getNotifications({ limit: 10 })
  assert.strictEqual(queryRes.notifications.length, 2)
  assert.strictEqual(queryRes.unreadCount, 2)

  // Mark 1 as read
  await notifManager.markAsRead(n1.id)
  queryRes = await notifManager.getNotifications({ limit: 10 })
  assert.strictEqual(queryRes.unreadCount, 1)

  // Mark all as read
  await notifManager.markAllAsRead()
  queryRes = await notifManager.getNotifications({ limit: 10 })
  assert.strictEqual(queryRes.unreadCount, 0)
  console.log('✓ Unread count tracking, individual mark-read and mark-all-read working correctly')

  console.log('\n[Test 3] Notification Rule Filtering (Opt-out toggles)...')
  // Turn OFF automation failure alerts
  notifManager.updateNotificationSettings({ notifyOnAutomationFailure: false })

  const suppressed = await notifManager.addNotification({
    type: 'automation_failed',
    title: 'Suppressed Auto Fail',
    message: 'This should not be saved',
  })
  assert.strictEqual(suppressed, null, 'Suppressed notification must return null and not save')

  // Turn ON automation failure alerts
  notifManager.updateNotificationSettings({ notifyOnAutomationFailure: true })
  const allowed = await notifManager.addNotification({
    type: 'automation_failed',
    title: 'Allowed Auto Fail',
    message: 'This should now be saved',
  })
  assert(allowed && allowed.id, 'Allowed notification must be saved')
  console.log('✓ User notification rule filters properly suppress and allow alerts')

  console.log('\n[Test 4] Clear all notifications...')
  await notifManager.clearAllNotifications()
  const cleared = await notifManager.getNotifications()
  assert.strictEqual(cleared.notifications.length, 0)
  assert.strictEqual(cleared.unreadCount, 0)
  console.log('✓ Clear all notifications emptied local table cleanly')

  closeDb()
  console.log('\n======================================================')
  console.log('🎉 ALL BƯỚC 35 NOTIFICATION CENTER TESTS PASSED!')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})

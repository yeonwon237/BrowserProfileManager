const { getAllProfiles, getProfileById } = require('../database/profiles')
const { getProxyById } = require('../database/proxies')
const { validateEnvironment } = require('./environmentValidator')
const { validateConsistency } = require('./consistencyValidator')
const { ensureIdentity, validateIdentity } = require('./profileIdentity')

function risk(code, severity, points, message, remedy) {
  return { code, severity, points, message, remedy }
}

async function evaluateProfileSafety(profileOrId) {
  const profile = typeof profileOrId === 'string' ? await getProfileById(profileOrId) : profileOrId
  if (!profile) throw new Error('Không tìm thấy hồ sơ')
  const risks = []
  const environment = profile.environment || { mode: 'default' }
  const envResult = validateEnvironment(environment)
  if (!envResult.valid) risks.push(risk('ENVIRONMENT_INVALID', 'critical', 40, 'Cấu hình môi trường không hợp lệ.', 'Mở phần môi trường và sửa các trường được cảnh báo.'))

  const identity = ensureIdentity(profile.id, environment, profile.browser_type).identity
  const identityResult = validateIdentity(identity)
  if (!identityResult.valid) risks.push(risk('IDENTITY_INVALID', 'critical', 40, `Định danh hồ sơ không hợp lệ: ${identityResult.issues.join(', ')}`, 'Lưu lại hồ sơ để tái tạo định danh an toàn.'))

  let proxy = null
  if (profile.proxy_id) {
    proxy = await getProxyById(profile.proxy_id)
    if (!proxy) risks.push(risk('PROXY_MISSING', 'critical', 45, 'Hồ sơ đang tham chiếu một proxy không tồn tại.', 'Gán proxy hợp lệ trước khi mở hồ sơ.'))
    else {
      const allProfiles = await getAllProfiles({})
      const usage = allProfiles.filter((item) => item.proxy_id === profile.proxy_id).length
      const limit = Math.max(1, Number(proxy.max_profiles) || 5)
      if (usage > limit) risks.push(risk('PROXY_OVERUSED', 'warning', 18, `Proxy đang được gán cho ${usage} hồ sơ, vượt giới hạn ${limit}.`, 'Giảm số hồ sơ dùng chung hoặc tăng số lượng proxy.'))
      const consistency = validateConsistency(profile, proxy)
      if (!consistency.consistent) risks.push(risk('GEO_MISMATCH', 'warning', 20, consistency.warnings.map((item) => item.message).join(' '), 'Dùng chức năng tự khớp môi trường theo vị trí proxy.'))
    }
  } else {
    risks.push(risk('DIRECT_CONNECTION', 'info', 5, 'Hồ sơ đang dùng kết nối trực tiếp.', 'Chỉ gán proxy khi quy trình vận hành của bạn thực sự yêu cầu.'))
  }

  if (!environment.locale) risks.push(risk('LOCALE_DEFAULT', 'info', 4, 'Hồ sơ đang dùng ngôn ngữ mặc định của hệ thống.', 'Đặt ngôn ngữ vùng cố định nếu cần tính ổn định giữa các máy.'))
  if (!environment.timezone) risks.push(risk('TIMEZONE_DEFAULT', 'info', 4, 'Hồ sơ đang dùng múi giờ mặc định của hệ thống.', 'Đặt múi giờ cố định hoặc bật tự khớp theo proxy.'))

  const score = Math.max(0, 100 - risks.reduce((sum, item) => sum + item.points, 0))
  const blocked = risks.some((item) => item.severity === 'critical')
  const level = blocked || score < 60 ? 'red' : score < 85 || risks.some((item) => item.severity === 'warning') ? 'yellow' : 'green'
  return {
    profileId: profile.id, score, level, blocked, risks,
    summary: level === 'green' ? 'Sẵn sàng vận hành' : level === 'yellow' ? 'Cần xem lại trước khi mở' : 'Không an toàn để mở',
    evaluatedAt: new Date().toISOString(),
  }
}

async function evaluateBatch(profileIds = []) {
  const results = []
  for (const id of profileIds) {
    try { results.push(await evaluateProfileSafety(id)) } catch (error) { results.push({ profileId: id, score: 0, level: 'red', blocked: true, error: error.message }) }
  }
  return results
}

module.exports = { evaluateProfileSafety, evaluateBatch }

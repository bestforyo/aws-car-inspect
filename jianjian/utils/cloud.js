// 鉴见车辆检测 · 云服务初始化（单一 client 实例，全端复用）
// publicConfig 由 WorkBuddy 云服务环境提供，可安全随前端发布；不含任何密钥。
const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram')
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics')

const publicConfig = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_lP2SAs1GOInZrKBVA68bB6_dvVXwlQc786ZuFCsA880goSt7ys4FqCf',
  workBuddyOAuthClientId: 'cb_jq6QyEPkOkJXPcpz0JxS_wbapp_lP2SAs1GOInZrKBVA68bB6',
}

const cloud = createMiniProgramWorkBuddyCloud({
  endpoint: publicConfig.endpoint,
  publishableKey: publicConfig.publishableKey,
  workBuddyOAuthClientId: publicConfig.workBuddyOAuthClientId,
  wx: createDiagnosticWx(wx),
})

module.exports = { cloud, publicConfig }

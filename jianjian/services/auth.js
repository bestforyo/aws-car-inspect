// 认证与租户上下文服务（基于 WorkBuddy Cloud Auth）
// 登录方式：微信小程序登录（wx.login + signInWithWechat）。正式登录需小程序绑定与登录开关已启用。
var cloud = require('../utils/cloud').cloud;
var U = require('../utils/util');

var _session = null;      // 当前会话
var _profile = null;      // user_profiles 记录
var _membership = null;   // 当前租户成员记录

function getSession() { return _session; }
function getProfile() { return _profile; }
function getMembership() { return _membership; }
function isLoggedIn() { return !!_session; }
function tenantId() { return _profile && _profile.current_tenant_id; }
function role() { return _membership && _membership.role; }
function isOrgAdmin() { return role() === 'org_admin'; }
function isInspector() { return role() === 'inspector'; }

// 微信登录
function loginByWechat() {
  return new Promise(function (resolve) {
    wx.login({
      success: function (res) {
        if (!res.code) { resolve({ ok: false, msg: '无法获取登录凭证' }); return; }
        var appid = '';
        try { appid = wx.getAccountInfoSync().miniProgram.appId; } catch (e) { appid = 'touristappid'; }
        cloud.auth.signInWithWechat(res.code, appid).then(function (r) {
          if (r.error) { resolve({ ok: false, msg: r.error.message || '登录失败' }); return; }
          _session = r.data;
          return loadContext().then(function () { resolve({ ok: true }); });
        }).catch(function (e) {
          resolve({ ok: false, msg: (e && e.message) || '登录失败' });
        });
      },
      fail: function (e) { resolve({ ok: false, msg: (e && e.errMsg) || '微信登录失败' }); }
    });
  });
}

// 会话恢复（App.onLaunch/onShow 调用）
function restore() {
  return cloud.auth.getSession().then(function (r) {
    if (r.error || !r.data) { _session = null; return { ok: false }; }
    _session = r.data;
    return loadContext().then(function () { return { ok: true }; });
  }).catch(function () { _session = null; return { ok: false }; });
}

// 加载用户档案与当前租户成员身份
function loadContext() {
  if (!_session || !_session.user) return Promise.resolve();
  var uid = _session.user.id;
  return cloud.database.from('user_profiles').select('*').eq('uid', uid).maybeSingle().then(function (r) {
    _profile = r.data || null;
    if (!_profile) {
      return cloud.database.from('user_profiles').insert({
        uid: uid,
        display_name: _session.user.name || '检测师',
        system_role: 'user'
      }).select().single().then(function (c) {
        _profile = c.data || null;
        return loadMembership();
      });
    }
    return loadMembership();
  });
}

function loadMembership() {
  var tid = tenantId();
  if (!tid || !_session) { _membership = null; return Promise.resolve(); }
  return cloud.database.from('tenant_members')
    .select('*').eq('tenant_id', tid).eq('uid', _session.user.id).maybeSingle()
    .then(function (r) { _membership = r.data || null; });
}

// 平台超管判定（供 Web 端与小程序共用逻辑）
function isPlatformAdmin() { return !!(_profile && _profile.system_role === 'platform_admin'); }

// 创建机构（首个成员自动成为机构管理员）
function createTenant(name, code) {
  if (!_session) return Promise.resolve({ ok: false, msg: '请先登录' });
  var tid = U.uid('tenant');
  return cloud.database.from('tenants').insert({
    id: tid, name: name, code: code, status: 'active'
  }).select().single().then(function (r) {
    if (r.error) return { ok: false, msg: r.error.message || '创建失败' };
    return cloud.database.from('tenant_members').insert({
      id: U.uid('mem'), tenant_id: tid, uid: _session.user.id,
      role: 'org_admin', display_name: _profile && _profile.display_name || '机构管理员'
    }).select().single().then(function (m) {
      if (m.error) return { ok: false, msg: m.error.message || '成员创建失败' };
      return cloud.database.from('user_profiles').update({ current_tenant_id: tid })
        .eq('uid', _session.user.id).select().single().then(function (p) {
          _profile = p.data || _profile;
          return loadMembership().then(function () { return { ok: true, tenantId: tid }; });
        });
    });
  });
}

// 使用邀请码/机构码加入机构（作为检测师）
function joinTenant(code) {
  if (!_session) return Promise.resolve({ ok: false, msg: '请先登录' });
  return cloud.database.from('tenants').select('*').eq('code', code).maybeSingle().then(function (r) {
    if (r.error || !r.data) return { ok: false, msg: '机构码不存在' };
    var tid = r.data.id;
    return cloud.database.from('tenant_members').insert({
      id: U.uid('mem'), tenant_id: tid, uid: _session.user.id,
      role: 'inspector', display_name: _profile && _profile.display_name || '检测师'
    }).select().single().then(function (m) {
      if (m.error) return { ok: false, msg: m.error.message || '加入失败' };
      return cloud.database.from('user_profiles').update({ current_tenant_id: tid })
        .eq('uid', _session.user.id).select().single().then(function (p) {
          _profile = p.data || _profile;
          return loadMembership().then(function () { return { ok: true, tenantId: tid }; });
        });
    });
  });
}

function switchTenant(tid) {
  if (!_session) return Promise.resolve({ ok: false, msg: '请先登录' });
  return cloud.database.from('tenant_members').select('*').eq('tenant_id', tid)
    .eq('uid', _session.user.id).maybeSingle().then(function (r) {
      if (!r.data) return { ok: false, msg: '你不属于该机构' };
      return cloud.database.from('user_profiles').update({ current_tenant_id: tid })
        .eq('uid', _session.user.id).select().single().then(function (p) {
          _profile = p.data || _profile;
          return loadMembership().then(function () { return { ok: true }; });
        });
    });
}

function logout() {
  _session = null; _profile = null; _membership = null;
  return cloud.auth.signOut();
}

module.exports = {
  cloud: cloud, getSession: getSession, getProfile: getProfile, getMembership: getMembership,
  isLoggedIn: isLoggedIn, tenantId: tenantId, role: role, isOrgAdmin: isOrgAdmin,
  isInspector: isInspector, isPlatformAdmin: isPlatformAdmin,
  loginByWechat: loginByWechat, restore: restore, createTenant: createTenant,
  joinTenant: joinTenant, switchTenant: switchTenant, logout: logout, loadContext: loadContext
};

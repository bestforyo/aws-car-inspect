var A = require('../../services/auth');
var D = require('../../services/data');
var U = require('../../utils/util');

Page({
  data: { isAdmin: false, name: '', code: '', disclaimer: '', logoUrl: '', statusText: '—', planId: '', expireText: '—', saving: false },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    if (!A.isOrgAdmin()) { this.setData({ isAdmin: false }); return; }
    this.setData({ isAdmin: true });
    var self = this;
    D.getTenant().then(function (r) {
      if (!r.data) return;
      var t = r.data;
      self.setData({
        name: t.name, code: t.code, disclaimer: t.disclaimer || '', logoUrl: t.logo_url || '',
        statusText: t.status === 'active' ? '正常' : t.status,
        planId: t.plan_id || '', expireText: U.fmtTime(t.expires_at)
      });
    });
  },
  onField: function (e) { var k = e.currentTarget.dataset.k, p = {}; p[k] = e.detail.value; this.setData(p); },
  chooseLogo: function () {
    var self = this;
    wx.chooseImage({ count: 1, sizeType: ['compressed'], success: function (res) {
      // 演示使用本地临时路径；正式应上传云存储后保存 objectPath
      self.setData({ logoUrl: res.tempFilePaths[0] });
      U.toast('Logo 已选择（演示本地暂存）');
    }});
  },
  save: function () {
    var self = this;
    if (!this.data.name.trim()) { U.toast('请填写机构名称'); return; }
    this.setData({ saving: true });
    D.updateTenant(A.tenantId(), { name: this.data.name.trim(), disclaimer: this.data.disclaimer, logo_url: this.data.logoUrl }).then(function (r) {
      self.setData({ saving: false });
      U.toast(r.error ? '保存失败' : '已保存');
    });
  }
});

var A = require('../../services/auth');
var D = require('../../services/data');
var U = require('../../utils/util');

Page({
  data: { isAdmin: false, reports: [] },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ isAdmin: A.isOrgAdmin() });
    if (A.isOrgAdmin()) this.load();
  },
  load: function () {
    var self = this;
    D.listReports().then(function (r) {
      var reports = r.data || [];
      var enriched = reports.map(function (rp) {
        return {
          id: rp.id, report_no: rp.report_no, plate: (rp.snapshot_json || {}).plate || '',
          timeText: U.fmtTime(rp.published_at, true), orderNo: rp.order_id, shares: []
        };
      });
      self.setData({ reports: enriched });
      // 加载每个报告的分享
      enriched.forEach(function (rp, idx) {
        D.listShares(rp.id).then(function (sr) {
          var shares = (sr.data || []).map(function (s) {
            return { id: s.id, token_hash: s.token_hash, status: s.status, expireText: U.fmtTime(s.expires_at) };
          });
          var key = 'reports[' + idx + '].shares';
          var patch = {}; patch[key] = shares;
          self.setData(patch);
        });
      });
    });
  },
  viewReport: function (e) { wx.navigateTo({ url: '/pages/report/report?reportId=' + e.currentTarget.dataset.id + '&share=1' }); },
  createShare: function (e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    D.createShare(id, { maskVin: true, maskPlate: false }, 30).then(function (r) {
      if (r.error) { U.toast('创建失败'); return; }
      var reports = self.data.reports.map(function (rp) {
        return rp.id === id ? Object.assign({}, rp, { newToken: r.token }) : rp;
      });
      self.setData({ reports: reports });
    });
  },
  revoke: function (e) {
    var self = this;
    U.confirm('撤销后该链接立即失效，确认？', '撤销分享').then(function (ok) {
      if (!ok) return;
      D.revokeShare(e.currentTarget.dataset.id).then(function (r) {
        U.toast(r.error ? '撤销失败' : '已撤销');
        if (!r.error) self.load();
      });
    });
  },
  copy: function (e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.token, success: function () { U.toast('已复制'); } });
  }
});

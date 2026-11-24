var A = require('../../services/auth');
var D = require('../../services/data');
var R = require('../../services/rules');
var U = require('../../utils/util');
var LIB = require('../../utils/templates-lib');

Page({
  data: {
    reportId: '', report: {}, order: {}, snapshot: {}, publishTime: '—', vehicleLabel: '乘用车',
    sections: [], alerts: [], photoItems: [], canShare: false
  },
  onLoad: function (o) { this.setData({ reportId: o.reportId || '', canShare: o.share === '1' }); },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.load();
  },
  load: function () {
    var self = this;
    D.listReports().then(function (r) {
      var report = self.data.reportId
        ? (r.data || []).filter(function (x) { return x.id === self.data.reportId; })[0]
        : (r.data || [])[0];
      if (!report) { U.toast('报告不存在'); return; }
      self.setData({ report: report, snapshot: report.snapshot_json || {}, publishTime: U.fmtTime(report.published_at, true) });
      return D.getOrder(report.order_id).then(function (or) {
        if (!or.data) return;
        var o = or.data;
        self.setData({ order: o, vehicleLabel: o.vehicle_kind === 'MOTORCYCLE' ? '摩托车' : '乘用车' });
        return D.getRevision(o.id, o.revision_no || 1).then(function (rr) {
          var saved = (rr.data && rr.data.answers_json) || {};
          var alerts = (rr.data && rr.data.alerts_json) || [];
          var tpl = LIB[o.template_id] || LIB['car-standard'];
          var sections = [], photoItems = [];
          tpl.modules.forEach(function (m) {
            var items = m.items.filter(function (it) { return saved[it.n] && saved[it.n].result && saved[it.n].result !== '待检查'; }).map(function (it) {
              var ans = saved[it.n];
              return { n: it.n, answer: ans, color: R.resultColor(Object.assign({}, it, { answer: ans })) };
            });
            if (items.length) sections.push({ name: m.name, items: items });
            m.items.forEach(function (it) {
              if (saved[it.n] && saved[it.n].photos && saved[it.n].photos.length) {
                photoItems.push({ n: it.n, answer: saved[it.n] });
              }
            });
          });
          self.setData({ sections: sections, alerts: alerts, photoItems: photoItems });
        });
      });
    });
  },
  preview: function (e) { wx.previewImage({ current: e.currentTarget.dataset.url, urls: [e.currentTarget.dataset.url] }); },
  goShareManage: function () { wx.navigateTo({ url: '/pages/admin-reports/admin-reports' }); }
});

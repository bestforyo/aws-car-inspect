var A = require('../../services/auth');
var D = require('../../services/data');
var R = require('../../services/rules');
var U = require('../../utils/util');
var LIB = require('../../utils/templates-lib');

Page({
  data: {
    orderId: '', order: {}, statusLabel: '', statusCls: 'tag-muted', submitTime: '—',
    canReview: false, selfReviewWarn: false, sections: [], alerts: [], returnComment: '',
    showReturnModal: false, returnInput: '', shareToken: '', reportId: ''
  },
  onLoad: function (o) { this.setData({ orderId: o.orderId || '' }); },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.load();
  },
  load: function () {
    var self = this;
    D.getOrder(this.data.orderId).then(function (r) {
      if (!r.data) { U.toast('订单不存在'); return; }
      var o = r.data, st = U.statusOf(o.status);
      var canReview = A.isOrgAdmin() && o.status === 'REVIEW_PENDING';
      var selfWarn = canReview && o.inspector_uid === A.getSession().user.id;
      self.setData({
        order: o, statusLabel: st.label, statusCls: st.cls,
        canReview: canReview, selfReviewWarn: selfWarn
      });
      // 检测版本
      return D.getRevision(o.id, o.revision_no || 1).then(function (rr) {
        var saved = (rr.data && rr.data.answers_json) || {};
        var alerts = (rr.data && rr.data.alerts_json) || [];
        var tpl = LIB[o.template_id] || LIB['car-standard'];
        var sections = tpl.modules.map(function (m) {
          return {
            name: m.name,
            items: m.items.filter(function (it) { return saved[it.n] && saved[it.n].result && saved[it.n].result !== '待检查'; }).map(function (it) {
              var ans = saved[it.n];
              return { n: it.n, answer: ans, color: R.resultColor(Object.assign({}, it, { answer: ans })) };
            })
          };
        }).filter(function (s) { return s.items.length > 0; });
        self.setData({ sections: sections, alerts: alerts, submitTime: U.fmtTime(rr.data && rr.data.submitted_at, true) });
      });
    }).then(function () {
      // 退回意见
      return D.listReviews(self.data.orderId).then(function (rr) {
        var latest = (rr.data || [])[0];
        if (latest && latest.decision === 'returned') self.setData({ returnComment: latest.comment });
      });
    }).then(function () {
      // 报告
      if (self.data.order.status === 'PUBLISHED') {
        return D.getReportByOrder(self.data.orderId).then(function (rr) {
          if (rr.data) self.setData({ reportId: rr.data.id });
        });
      }
    });
  },
  preview: function (e) { wx.previewImage({ current: e.currentTarget.dataset.url, urls: [e.currentTarget.dataset.url] }); },
  approve: function () {
    var self = this;
    if (this.data.selfReviewWarn) {
      U.confirm('你本人提交的检测版本不应由你审核。仍要继续通过吗？', '自审提醒').then(function (ok) { if (ok) self.doApprove(); });
      return;
    }
    this.doApprove();
  },
  doApprove: function () {
    var self = this;
    U.confirm('审核通过后生成正式报告并锁定，确认通过？', '审核通过').then(function (ok) {
      if (!ok) return;
      wx.showLoading({ title: '处理中' });
      var rev = self.data.order.revision_no || 1;
      D.getRevision(self.data.orderId, rev).then(function (rr) {
        if (!rr.data) { wx.hideLoading(); U.toast('未找到检测版本'); return; }
        return D.approve(self.data.orderId, rr.data.id).then(function (res) {
          wx.hideLoading();
          if (res.error) { U.toast(res.error.message || '操作失败'); return; }
          U.toast('已通过并发布');
          self.setData({ reportId: res.data && res.data.id });
          self.load();
        });
      });
    });
  },
  showReturn: function () { this.setData({ showReturnModal: true, returnInput: '' }); },
  closeReturn: function () { this.setData({ showReturnModal: false }); },
  noop: function () {},
  onReturnInput: function (e) { this.setData({ returnInput: e.detail.value }); },
  doReturn: function () {
    var self = this;
    var comment = this.data.returnInput.trim();
    if (!comment) { U.toast('退回必须填写修改意见'); return; }
    var rev = this.data.order.revision_no || 1;
    D.getRevision(this.data.orderId, rev).then(function (rr) {
      return D.returnForFix(self.data.orderId, rr.data.id, comment, []);
    }).then(function (r) {
      if (r.error) { U.toast(r.error.message || '退回失败'); return; }
      self.setData({ showReturnModal: false });
      U.toast('已退回');
      self.load();
    });
  },
  createShare: function () {
    var self = this;
    if (!this.data.reportId) { U.toast('未找到正式报告'); return; }
    U.confirm('创建 30 天有效的只读分享链接，确认？', '分享报告').then(function (ok) {
      if (!ok) return;
      D.createShare(self.data.reportId, { maskVin: true, maskPlate: false }, 30).then(function (r) {
        if (r.error) { U.toast(r.error.message || '创建失败'); return; }
        self.setData({ shareToken: r.token });
      });
    });
  },
  copyShare: function () {
    wx.setClipboardData({ data: this.data.shareToken, success: function () { U.toast('令牌已复制'); } });
  }
});

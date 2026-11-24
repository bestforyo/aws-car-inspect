var A = require('../../services/auth');
var D = require('../../services/data');
var U = require('../../utils/util');

Page({
  data: { isAdmin: false, tab: 'pending', list: [], pendingList: [] },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ isAdmin: A.isOrgAdmin() });
    this.load();
  },
  setTab: function (e) { this.setData({ tab: e.currentTarget.dataset.t }, this.load); },
  load: function () {
    var self = this;
    if (this.data.isAdmin) {
      D.listReviewQueue().then(function (r) {
        var list = (r.data || []).map(function (o) {
          var st = U.statusOf(o.status);
          return Object.assign({}, o, {
            statusLabel: st.label, statusCls: st.cls,
            vehicleLabel: o.vehicle_kind === 'MOTORCYCLE' ? '摩托车' : '乘用车',
            timeText: U.fmtTime(o.updated_at, true)
          });
        });
        self.setData({ pendingList: list, list: self.data.tab === 'pending' ? list : [] });
      });
    } else {
      D.listOrders({}).then(function (r) {
        var list = (r.data || []).filter(function (o) {
          return ['REVIEW_PENDING', 'NEEDS_MODIFICATION', 'PUBLISHED'].indexOf(o.status) >= 0;
        }).map(function (o) {
          var st = U.statusOf(o.status);
          return Object.assign({}, o, {
            statusLabel: st.label, statusCls: st.cls,
            vehicleLabel: o.vehicle_kind === 'MOTORCYCLE' ? '摩托车' : '乘用车',
            timeText: U.fmtTime(o.updated_at, true)
          });
        });
        self.setData({ list: list });
        // 补充最新退回意见
        list.forEach(function (o, idx) {
          if (o.status === 'NEEDS_MODIFICATION') {
            D.listReviews(o.id).then(function (rr) {
              var latest = (rr.data || [])[0];
              if (latest && latest.comment) {
                var key = 'list[' + idx + '].returnComment';
                var patch = {}; patch[key] = latest.comment;
                self.setData(patch);
              }
            });
          }
        });
      });
    }
  },
  open: function (e) {
    wx.navigateTo({ url: '/pages/review-detail/review-detail?orderId=' + e.currentTarget.dataset.id });
  }
});

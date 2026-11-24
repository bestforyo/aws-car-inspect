var A = require('../../services/auth');
var D = require('../../services/data');
var U = require('../../utils/util');

var FILTERS = [
  { label: '全部', status: '' }, { label: '待检测', status: 'PENDING_INSPECTION' },
  { label: '检测中', status: 'INSPECTING' }, { label: '待审核', status: 'REVIEW_PENDING' },
  { label: '待修改', status: 'NEEDS_MODIFICATION' }, { label: '已完成', status: 'PUBLISHED' }
];

Page({
  data: { filters: ['全部', '待检测', '检测中', '待审核', '待修改', '已完成'], filter: '全部', list: [], loading: true },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.load();
  },
  setFilter: function (e) { this.setData({ filter: e.currentTarget.dataset.f }, this.load); },
  load: function () {
    var self = this;
    var f = FILTERS.filter(function (x) { return x.label === self.data.filter; })[0];
    D.listOrders(f.status ? { status: f.status } : {}).then(function (r) {
      var list = (r.data || []).map(function (o) {
        var st = U.statusOf(o.status);
        return Object.assign({}, o, {
          statusLabel: st.label, statusCls: st.cls,
          vehicleLabel: o.vehicle_kind === 'MOTORCYCLE' ? '摩托车' : '乘用车',
          timeText: U.fmtTime(o.created_at, true)
        });
      });
      self.setData({ list: list, loading: false });
    });
  },
  open: function (e) {
    var ds = e.currentTarget.dataset;
    if (ds.status === 'REVIEW_PENDING' || ds.status === 'PUBLISHED') {
      wx.navigateTo({ url: '/pages/review-detail/review-detail?orderId=' + ds.id });
    } else {
      wx.navigateTo({ url: '/pages/inspection/inspection?orderId=' + ds.id });
    }
  }
});

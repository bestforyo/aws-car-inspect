var A = require('../../services/auth');
var D = require('../../services/data');
var U = require('../../utils/util');

Page({
  data: {
    roleLabel: '检测师', orgName: '', lookupValue: '', lookupMsg: '',
    todayCount: 0, pendingCount: 0, reviewCount: 0, doneCount: 0, recentOrders: []
  },
  onShow: function () {
    var self = this;
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ roleLabel: A.isOrgAdmin() ? '机构管理员' : '检测师' });
    D.getTenant().then(function (r) { if (r.data) self.setData({ orgName: r.data.name }); });
    this.loadStats();
  },
  loadStats: function () {
    var self = this;
    D.listOrders({}).then(function (r) {
      var list = (r.data || []).map(function (o) {
        var st = U.statusOf(o.status);
        return {
          id: o.id, order_no: o.order_no, package_name: o.package_name, plate: o.plate,
          vehicle_kind: o.vehicle_kind, statusLabel: st.label, statusCls: st.cls,
          timeText: U.fmtTime(o.created_at)
        };
      });
      var today = U.fmtTime(Date.now());
      self.setData({
        pendingCount: list.filter(function (o) { return ['待检测', '检测中'].indexOf(o.statusLabel) >= 0; }).length,
        reviewCount: list.filter(function (o) { return o.statusLabel === '待审核'; }).length,
        doneCount: list.filter(function (o) { return o.statusLabel === '已完成'; }).length,
        todayCount: list.filter(function (o) { return o.timeText.indexOf(today) === 0; }).length,
        recentOrders: list.slice(0, 4)
      });
    });
  },
  onPassenger: function () { wx.navigateTo({ url: '/pages/order-create/order-create?kind=PASSENGER_CAR' }); },
  onMotorcycle: function () { wx.navigateTo({ url: '/pages/order-create/order-create?kind=MOTORCYCLE' }); },
  onLookupInput: function (e) { this.setData({ lookupValue: e.detail.value }); },
  onLookup: function () {
    if (!this.data.lookupValue.trim()) { this.setData({ lookupMsg: '请输入车架号或车牌' }); return; }
    this.setData({ lookupMsg: '车辆信息查询接口未配置，演示环境不返回真实结果。正式接入需服务端适配器与供应商授权。' });
  },
  goOrders: function () { wx.switchTab({ url: '/pages/orders/orders' }); },
  openOrder: function (e) {
    wx.navigateTo({ url: '/pages/inspection/inspection?orderId=' + e.currentTarget.dataset.id });
  }
});

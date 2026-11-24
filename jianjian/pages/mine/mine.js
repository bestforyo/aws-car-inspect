var A = require('../../services/auth');
var D = require('../../services/data');
var U = require('../../utils/util');

Page({
  data: { displayName: '检测师', avatarLetter: '检', roleLabel: '检测师', orgName: '', orgCode: '', isAdmin: false },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    var s = A.getSession();
    var name = (A.getProfile() && A.getProfile().display_name) || (s && s.user && s.user.name) || '检测师';
    this.setData({
      displayName: name, avatarLetter: name.slice(0, 1),
      roleLabel: A.isOrgAdmin() ? '机构管理员' : '检测师', isAdmin: A.isOrgAdmin()
    });
    var self = this;
    D.getTenant().then(function (r) {
      if (r.data) self.setData({ orgName: r.data.name, orgCode: r.data.code });
    });
  },
  goOrders: function () { wx.switchTab({ url: '/pages/orders/orders' }); },
  goReview: function () { wx.switchTab({ url: '/pages/review/review' }); },
  goReports: function () {
    var self = this;
    D.listReports().then(function (r) {
      if (!r.data || r.data.length === 0) { U.toast('暂无历史报告'); return; }
      wx.navigateTo({ url: '/pages/report/report?reportId=' + r.data[0].id });
    });
  },
  goAdmin: function (e) {
    var p = e.currentTarget.dataset.p;
    wx.navigateTo({ url: '/pages/' + p + '/' + p });
  },
  help: function () {
    wx.showModal({
      title: '帮助与说明',
      content: '1. 检测项目为示范清单，正式标准须经机构专业人员审核后启用。\n2. 闯关规则：关键决定项非正常需尺寸判定；重点泡水项三项水渍泥沙触发泡水提示；火烧三选项触发火烧提示。\n3. 提交后版本锁定，退回需填写意见并创建修订版。\n4. 报告分享使用高熵令牌，可过期与撤销。',
      showCancel: false
    });
  },
  logout: function () {
    var self = this;
    U.confirm('确认退出登录？', '退出').then(function (ok) {
      if (!ok) return;
      A.logout().then(function () { wx.reLaunch({ url: '/pages/login/login' }); });
    });
  }
});

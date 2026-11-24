var A = require('../../services/auth');
var U = require('../../utils/util');

Page({
  data: {
    loggedIn: false, displayName: '', loading: false, errorMsg: '',
    tab: 'create', orgName: '', orgCode: '', joinCode: ''
  },
  onShow: function () {
    this.setData({
      loggedIn: A.isLoggedIn(),
      displayName: (A.getProfile() && A.getProfile().display_name) || (A.getSession() && A.getSession().user && A.getSession().user.name) || '检测师'
    });
  },
  onWechatLogin: function () {
    var self = this;
    this.setData({ loading: true, errorMsg: '' });
    A.loginByWechat().then(function (r) {
      self.setData({ loading: false, loggedIn: r.ok, errorMsg: r.ok ? '' : r.msg });
      if (r.ok) {
        wx.showToast({ title: '登录成功', icon: 'success' });
      }
    });
  },
  switchTab: function (e) { this.setData({ tab: e.currentTarget.dataset.tab, errorMsg: '' }); },
  onOrgName: function (e) { this.setData({ orgName: e.detail.value }); },
  onOrgCode: function (e) { this.setData({ orgCode: e.detail.value }); },
  onJoinCode: function (e) { this.setData({ joinCode: e.detail.value }); },
  onCreateOrg: function () {
    var self = this;
    if (!this.data.orgName.trim() || !this.data.orgCode.trim()) { this.setData({ errorMsg: '请填写机构名称和编码' }); return; }
    this.setData({ loading: true, errorMsg: '' });
    A.createTenant(this.data.orgName.trim(), this.data.orgCode.trim()).then(function (r) {
      self.setData({ loading: false, errorMsg: r.ok ? '' : r.msg });
      if (r.ok) { U.toast('机构已创建'); wx.reLaunch({ url: '/pages/index/index' }); }
    });
  },
  onJoinOrg: function () {
    var self = this;
    if (!this.data.joinCode.trim()) { this.setData({ errorMsg: '请输入机构编码' }); return; }
    this.setData({ loading: true, errorMsg: '' });
    A.joinTenant(this.data.joinCode.trim()).then(function (r) {
      self.setData({ loading: false, errorMsg: r.ok ? '' : r.msg });
      if (r.ok) { U.toast('已加入机构'); wx.reLaunch({ url: '/pages/index/index' }); }
    });
  }
});

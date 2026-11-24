var A = require('../../services/auth');
var D = require('../../services/data');
var U = require('../../utils/util');

Page({
  data: { isAdmin: false, members: [], orgCode: '' },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ isAdmin: A.isOrgAdmin() });
    if (!A.isOrgAdmin()) return;
    var self = this;
    D.getTenant().then(function (r) { if (r.data) self.setData({ orgCode: r.data.code }); });
    this.load();
  },
  load: function () {
    var self = this;
    D.listMembers().then(function (r) { self.setData({ members: r.data || [] }); });
  },
  setRole: function (e) {
    var self = this;
    var ds = e.currentTarget.dataset;
    if (ds.r === 'org_admin') {
      U.confirm('将成员设为机构管理员后，其可审核报告、管理模板与成员。确认？', '角色变更').then(function (ok) { if (ok) self.doSetRole(ds.id, ds.r); });
    } else this.doSetRole(ds.id, ds.r);
  },
  doSetRole: function (id, role) {
    var self = this;
    D.updateMember(id, { role: role }).then(function (r) {
      U.toast(r.error ? '修改失败' : '角色已更新');
      if (!r.error) self.load();
    });
  }
});

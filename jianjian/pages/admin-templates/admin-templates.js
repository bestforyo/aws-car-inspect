var A = require('../../services/auth');
var LIB = require('../../utils/templates-lib');

Page({
  data: { isAdmin: false, kinds: ['乘用车', '摩托车'], kind: '乘用车', list: [] },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ isAdmin: A.isOrgAdmin() });
    if (A.isOrgAdmin()) this.load();
  },
  setKind: function (e) { this.setData({ kind: e.currentTarget.dataset.k }, this.load); },
  load: function () {
    var kind = this.data.kind;
    var list = Object.keys(LIB).map(function (k) {
      var t = LIB[k];
      return {
        id: k, name: t.name + (t.standardType === '国标' || t.standardType === '团标' ? '（' + t.standardType + '）' : ''),
        description: t.description, itemCount: t.itemCount,
        standardType: t.standardType, sections: (t.modules || []).map(function (m) { return m.name; }),
        status: 'published'
      };
    }).filter(function (t) {
      var isMoto = t.id.indexOf('moto') === 0;
      return kind === '乘用车' ? !isMoto : isMoto;
    });
    this.setData({ list: list });
  }
});

// 鉴见车辆检测 · App 入口
var A = require('./services/auth');

App({
  globalData: {
    appName: '鉴见 · 车辆检测'
  },
  onLaunch: function () {
    // 会话恢复（失败时进入登录页，由各页面门禁处理）
    A.restore();
  },
  onShow: function () {
    // 从后台切回时刷新会话与租户上下文
    if (!A.isLoggedIn()) A.restore();
  }
});

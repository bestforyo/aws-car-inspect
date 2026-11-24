// 通用工具函数
function uid(prefix) {
  var s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var r = '';
  for (var i = 0; i < 20; i++) r += s[Math.floor(Math.random() * s.length)];
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + r;
}

function orderNo() {
  var d = new Date();
  var p = function (n) { return n < 10 ? '0' + n : '' + n; };
  return 'JJ' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + uid('').slice(-8).toUpperCase();
}

function fmtTime(ts, withTime) {
  if (!ts) return '—';
  var d = new Date(ts);
  var p = function (n) { return n < 10 ? '0' + n : '' + n; };
  var s = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  if (withTime) s += ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  return s;
}

function hashText(str) {
  // 简易 FNV-1a 32位哈希（用于内容指纹展示；生产应由服务端 SHA-256）
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

var STATUS = {
  PENDING_INSPECTION: { label: '待检测', cls: 'tag-muted' },
  INSPECTING: { label: '检测中', cls: 'tag-warning' },
  REVIEW_PENDING: { label: '待审核', cls: 'tag-warning' },
  NEEDS_MODIFICATION: { label: '待修改', cls: 'tag-return' },
  PUBLISHED: { label: '已完成', cls: 'tag-success' },
  CANCELLED: { label: '已取消', cls: 'tag-muted' }
};

function statusOf(code) { return STATUS[code] || { label: code || '未知', cls: 'tag-muted' }; }

function toast(title, icon) {
  wx.showToast({ title: title, icon: icon || 'none', duration: 2000 });
}

function confirm(content, title) {
  return new Promise(function (resolve) {
    wx.showModal({
      title: title || '确认操作',
      content: content,
      success: function (r) { resolve(!!r.confirm); },
      fail: function () { resolve(false); }
    });
  });
}

module.exports = { uid: uid, orderNo: orderNo, fmtTime: fmtTime, hashText: hashText, STATUS: STATUS, statusOf: statusOf, toast: toast, confirm: confirm };

var A = require('../../services/auth');
var D = require('../../services/data');
var R = require('../../services/rules');
var U = require('../../utils/util');
var LIB = require('../../utils/templates-lib');

var THRESHOLDS = ['大于30cm×30cm', '小于30cm×30cm'];

Page({
  data: {
    orderId: '', tplId: '', order: {}, statusLabel: '待检测', statusCls: 'tag-muted',
    templateModules: [], totalItems: 0, activeSectionIdx: 0,
    currentSection: { name: '', items: [] }, thresholdOptions: THRESHOLDS,
    answers: {}, doneCount: 0, sectionDone: 0, alerts: [], locked: false
  },
  onLoad: function (opt) { this.setData({ orderId: opt.orderId || '', tplId: opt.tpl || '' }); },
  onShow: function () {
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.loadOrder();
  },
  loadOrder: function () {
    var self = this;
    D.getOrder(this.data.orderId).then(function (r) {
      if (!r.data) { U.toast('订单不存在'); return; }
      var o = r.data, st = U.statusOf(o.status);
      var locked = ['REVIEW_PENDING', 'PUBLISHED'].indexOf(o.status) >= 0;
      var tplId = self.data.tplId || o.template_id || 'car-standard';
      var tpl = LIB[tplId] || LIB['car-standard'];
      var modules = tpl.modules.map(function (m) {
        return { name: m.name, items: m.items.map(function (it) { return Object.assign({}, it); }) };
      });
      var total = modules.reduce(function (a, m) { return a + m.items.length; }, 0);
      self.setData({ order: o, statusLabel: st.label, statusCls: st.cls, locked: locked, templateModules: modules, totalItems: total });
      return D.getRevision(o.id, o.revision_no || 1).then(function (rr) {
        var saved = (rr.data && rr.data.answers_json) || {};
        var answers = {};
        modules.forEach(function (m) {
          m.items.forEach(function (it) {
            answers[it.n] = saved[it.n] || { result: '待检查', photos: [], note: '', threshold: '' };
          });
        });
        self.setData({ answers: answers, activeSectionIdx: 0 });
        self.refreshSection();
      });
    });
  },
  // 用 answers 字典重建当前章节的可渲染 items（含 answer/color/needNote 等派生字段）
  refreshSection: function () {
    var self = this;
    var idx = this.data.activeSectionIdx;
    var tplSec = this.data.templateModules[idx] || { name: '', items: [] };
    var doneInSec = 0, totalDone = 0;

    this.data.templateModules.forEach(function (m) {
      m.items.forEach(function (it) {
        if (R.itemComplete(it, self.data.answers[it.n] || {}).complete) totalDone++;
      });
    });
    var renderItems = tplSec.items.map(function (it) {
      var ans = self.data.answers[it.n] || { result: '待检查', photos: [], note: '', threshold: '' };
      var withAns = Object.assign({}, it, { answer: ans });
      var complete = R.itemComplete(it, ans).complete;
      if (complete) doneInSec++;
      var needNote = false, noteLabel = '';
      var res = ans.result || '';
      if (res === '自定义') { needNote = true; noteLabel = '车况说明（自定义必填）'; }
      else if (it.w && res === '水渍泥沙') { needNote = true; noteLabel = '水渍泥沙情况说明（必填）'; }
      else if (it.cn && it.cn.indexOf(res) >= 0) { needNote = true; noteLabel = (it.cl || '说明') + '（必填）'; }
      return Object.assign({}, it, {
        answer: ans, color: R.resultColor(withAns), abnormal: R.isAbnormal(withAns),
        needNote: needNote, noteLabel: noteLabel
      });
    });
    self.setData({
      currentSection: { name: tplSec.name, items: renderItems },
      sectionDone: doneInSec, doneCount: totalDone
    });
  },
  // 将某项的 answer 写回字典 + 当前渲染项
  patchAnswer: function (i, fields, cb) {
    var item = this.data.currentSection.items[i];
    var name = item.n;
    var patch = {};
    Object.keys(fields).forEach(function (k) { patch['answers.' + name + '.' + k] = fields[k]; });
    var answerPatch = Object.assign({}, this.data.answers[name], fields);
    var secPatch = {};
    Object.keys(fields).forEach(function (k) { secPatch['currentSection.items[' + i + '].answer.' + k] = fields[k]; });
    var self = this;
    this.setData(Object.assign(patch, secPatch), function () {
      self.refreshSection();
      if (cb) cb();
    });
  },
  switchSection: function (e) { this.setData({ activeSectionIdx: Number(e.currentTarget.dataset.idx) }, this.refreshSection); },
  chooseResult: function (e) {
    if (this.data.locked) return;
    var i = Number(e.currentTarget.dataset.idx), opt = e.currentTarget.dataset.opt;
    var item = this.data.currentSection.items[i];
    var fields = { result: opt };
    if (!(opt === '自定义' || opt === '水渍泥沙' || (item.cn && item.cn.indexOf(opt) >= 0))) fields.note = '';
    if (opt === '正常' || item.d !== '关键决定项') fields.threshold = '';
    var self = this;
    this.patchAnswer(i, fields, function () { self.updateAlerts(); self.autoSave(); });
  },
  chooseThreshold: function (e) {
    if (this.data.locked) return;
    var i = Number(e.currentTarget.dataset.idx), th = e.currentTarget.dataset.th;
    var self = this;
    this.patchAnswer(i, { threshold: th }, function () { self.updateAlerts(); self.autoSave(); });
  },
  onNote: function (e) {
    var i = Number(e.currentTarget.dataset.idx);
    this.patchAnswer(i, { note: e.detail.value }, this.autoSave.bind(this));
  },
  addPhoto: function (e) {
    if (this.data.locked) return;
    var i = Number(e.currentTarget.dataset.idx), self = this;
    wx.chooseImage({
      count: 3, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: function (res) {
        var item = self.data.currentSection.items[i];
        var photos = (item.answer.photos || []).concat(res.tempFilePaths);
        self.patchAnswer(i, { photos: photos }, function () { U.toast('照片已添加（演示本地暂存）'); });
      }
    });
  },
  removePhoto: function (e) {
    var i = Number(e.currentTarget.dataset.idx), pi = Number(e.currentTarget.dataset.pi);
    var photos = this.data.currentSection.items[i].answer.photos.slice();
    photos.splice(pi, 1);
    this.patchAnswer(i, { photos: photos });
  },
  previewPhoto: function (e) {
    var i = Number(e.currentTarget.dataset.idx), pi = Number(e.currentTarget.dataset.pi);
    var urls = this.data.currentSection.items[i].answer.photos || [];
    wx.previewImage({ current: urls[pi], urls: urls });
  },
  updateAlerts: function () {
    var self = this, all = [];
    this.data.templateModules.forEach(function (m) {
      m.items.forEach(function (it) { all.push(Object.assign({}, it, { answer: self.data.answers[it.n] || {} })); });
    });
    this.setData({ alerts: R.computeAlerts(all) });
  },
  autoSave: function () {
    try { wx.setStorageSync('draft_' + this.data.orderId, this.data.answers); } catch (e) {}
  },
  buildSections: function () {
    var self = this;
    return this.data.templateModules.map(function (m) {
      return { name: m.name, items: m.items.map(function (it) {
        return Object.assign({}, it, { answer: self.data.answers[it.n] || { result: '待检查', photos: [] } });
      }) };
    });
  },
  saveDraft: function () {
    var self = this;
    if (this.data.locked) return;
    var sections = this.buildSections();
    wx.showLoading({ title: '保存中' });
    D.saveDraft(this.data.orderId, this.data.order.revision_no || 1, {
      answers: this.data.answers,
      alerts: R.computeAlerts(sections.reduce(function (a, s) { return a.concat(s.items); }, [])),
      hash: U.hashText(JSON.stringify(this.data.answers))
    }).then(function (r) {
      wx.hideLoading();
      U.toast(r.error ? ('保存失败：' + (r.error.message || '未知')) : '草稿已保存');
    });
  },
  submit: function () {
    var self = this;
    if (this.data.locked) return;
    var sections = this.buildSections();
    if (!R.modulesReady(sections)) { U.toast('模板仍有模块未配置，无法提交'); return; }
    var v = R.validateSubmission(sections);
    if (!v.ok) {
      var first = v.errors[0];
      wx.showModal({ title: '无法提交', content: '「' + first.name + '」：' + first.reason + '。共 ' + v.errors.length + ' 项待完善，请先定位首项。', showCancel: false });
      return;
    }
    U.confirm('提交后将锁定该版本进入待审核，确认提交？', '提交审核').then(function (ok) {
      if (!ok) return;
      wx.showLoading({ title: '提交中' });
      D.submitRevision(self.data.orderId, self.data.order.revision_no || 1, {
        answers: self.data.answers, alerts: v.alerts, hash: U.hashText(JSON.stringify(self.data.answers))
      }).then(function (r) {
        wx.hideLoading();
        if (r.error) { U.toast(r.error.message || '提交失败'); return; }
        U.toast('已提交审核');
        wx.navigateBack();
      });
    });
  }
});

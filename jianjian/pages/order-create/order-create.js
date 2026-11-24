var A = require('../../services/auth');
var D = require('../../services/data');
var U = require('../../utils/util');
var LIB = require('../../utils/templates-lib');

var PASSENGER_PKGS = [
  { key: 'three', name: '三非排查', desc: '漆面 / 重大事故 / 泡水 / 火烧 四类排查', modules: 4 },
  { key: 'four', name: '四非排查', desc: '三非排查 + 车辆里程数读取', modules: 5 },
  { key: 'whole', name: '整车检测', desc: '十模块完整车况检测', modules: 10 },
  { key: 'new', name: '新车检测', desc: '七模块新车交付与功能检测', modules: 7 },
  { key: 'energy', name: '新能源检测', desc: '高压安全 / 动力电池 / 充电系统', modules: 5, disabled: true }
];
var MOTO_PKGS = [
  { key: 'moto-standard', name: '摩托车二手车检测', desc: '摩托车二手车鉴定评估技术规范', count: 8 },
  { key: 'moto-group', name: '整车检测（团标检）', desc: '机构团体标准检测清单', count: 8 }
];

// 套餐 key + 标准 → 模板 id
function templateId(kind, standard, pkgKey) {
  if (kind === 'MOTORCYCLE') return pkgKey === 'moto-group' ? 'moto-group' : 'moto-standard';
  var prefix = standard === 'NATIONAL' ? 'car-' : 'car-';
  var suffix = { three: 'three', four: 'four', whole: '', new: '-new', energy: '-energy' }[pkgKey];
  if (pkgKey === 'whole') return standard === 'NATIONAL' ? 'car-standard' : 'car-group';
  if (pkgKey === 'new') return standard === 'NATIONAL' ? 'car-new' : 'car-new-group';
  if (pkgKey === 'energy') return standard === 'NATIONAL' ? 'car-energy' : 'car-energy-group';
  if (pkgKey === 'three') return standard === 'NATIONAL' ? 'car-three' : 'car-three-group';
  if (pkgKey === 'four') return standard === 'NATIONAL' ? 'car-four' : 'car-four-group';
  return 'car-standard';
}

Page({
  data: {
    step: 1, kind: 'PASSENGER_CAR', standard: 'NATIONAL',
    plate: '', vin: '', brandModel: '',
    packages: PASSENGER_PKGS, motoPackages: MOTO_PKGS
  },
  onLoad: function (opt) {
    if (opt.kind) this.setData({ kind: opt.kind });
    this.refreshCounts();
  },
  refreshCounts: function () {
    var self = this;
    var pkgs = PASSENGER_PKGS.map(function (p) {
      var tpl = LIB[templateId('PASSENGER_CAR', self.data.standard, p.key)];
      return Object.assign({}, p, { count: tpl ? tpl.itemCount : 0 });
    });
    self.setData({ packages: pkgs });
  },
  onField: function (e) {
    var k = e.currentTarget.dataset.k;
    var patch = {}; patch[k] = e.detail.value;
    this.setData(patch);
  },
  setKind: function (e) {
    this.setData({ kind: e.currentTarget.dataset.k });
  },
  nextStep: function () {
    if (this.data.step === 1) {
      this.setData({ step: this.data.kind === 'PASSENGER_CAR' ? 2 : 3 });
    }
  },
  prevStep: function () {
    this.setData({ step: this.data.kind === 'PASSENGER_CAR' ? this.data.step - 1 : 1 });
  },
  chooseStandard: function (e) {
    this.setData({ standard: e.currentTarget.dataset.s, step: 3 });
    this.refreshCounts();
  },
  choosePackage: function (e) {
    var ds = e.currentTarget.dataset;
    if (ds.disabled === true || ds.disabled === 'true') { U.toast('正在建设中，敬请期待'); return; }
    this.createOrder(ds.key);
  },
  createOrder: function (pkgKey) {
    var self = this;
    if (!A.isLoggedIn()) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    if (!A.tenantId()) { U.toast('请先加入机构'); return; }
    var tid = templateId(this.data.kind, this.data.standard, pkgKey);
    var tpl = LIB[tid];
    if (!tpl) { U.toast('模板未配置，请联系机构管理员'); return; }
    var payload = {
      vehicle_kind: this.data.kind,
      standard: this.data.standard,
      package_key: pkgKey,
      package_name: (this.data.standard === 'NATIONAL' ? '国标·' : this.data.kind === 'MOTORCYCLE' ? '' : '团标·') + tpl.name,
      plate: this.data.plate, vin: this.data.vin, brand_model: this.data.brandModel,
      template_id: tid
    };
    wx.showLoading({ title: '正在创建订单' });
    D.createOrder(payload).then(function (r) {
      wx.hideLoading();
      if (r.error) { U.toast(r.error.message || '创建失败'); return; }
      U.toast('订单已创建');
      wx.redirectTo({ url: '/pages/inspection/inspection?orderId=' + r.data.id + '&tpl=' + tid });
    });
  }
});

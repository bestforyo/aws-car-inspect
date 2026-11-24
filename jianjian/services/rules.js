// 检测业务规则引擎（与规格书 sepc.md 第7.2/22节一致）
// 决定项分类、阈值判定、泡水/火烧提示、必填说明、提交校验

var WATER_KEY_ITEMS = ['左前地毯', '主驾座椅骨架及滑轨', '行李箱底板', '副驾座椅骨架及滑轨', '右前地毯'];
var FIRE_TRIGGERS = ['烧蚀', '熏黑碳化', '炙烤融化'];
var NORMAL = '正常';

// 单项完成判定：返回 { complete, reason }
// ans 可直接作为第二参数传入（页面答案字典与模板项分离的场景）
function itemComplete(item, answerOverride) {
  var ans = answerOverride || item.answer || {};
  var result = ans.result || '';
  if (!result || result === '待检查') return { complete: false, reason: '未检查' };

  // 关键决定项：非正常结果必须做尺寸判定
  if (item.d && item.d === '关键决定项' && result !== NORMAL) {
    if (!ans.threshold) return { complete: false, reason: '缺少尺寸判定' };
  }
  // 自定义结果必填说明
  if (result === '自定义' && !(ans.note && ans.note.trim())) {
    return { complete: false, reason: '缺少车况说明' };
  }
  // 车况功能性检测：自定义/差异款型必填
  if (item.cn && item.cn.indexOf(result) >= 0) {
    var label = item.cl || '说明';
    if (!(ans.note && ans.note.trim())) return { complete: false, reason: '缺少' + label };
  }
  // 泡水重点项：水渍泥沙必填情况说明
  if (item.w && result === '水渍泥沙' && !(ans.note && ans.note.trim())) {
    return { complete: false, reason: '缺少情况说明' };
  }
  // 自定义说明字段（发动机机爪胶等）
  if (item.cp && answerNeedsCustomNote(item, result) && !(ans.note && ans.note.trim())) {
    return { complete: false, reason: '缺少车况说明' };
  }
  return { complete: true, reason: '' };
}

function answerNeedsCustomNote(item, result) {
  return result === '自定义';
}

// 异常项判定（用于提交时要求照片、报告标色）
function isAbnormal(item) {
  var r = (item.answer || {}).result || '';
  if (!r || r === '待检查' || r === NORMAL) return false;
  // 部分"未配备/无此服务/未选初始"属于中性结果，不算异常
  if (['未配备', '此项检测无此服务', '敞篷正常'].indexOf(r) >= 0) return false;
  return true;
}

// 结果颜色：正常绿 / 关键项大于阈值红 / 关键项小于阈值黄 / 其他按异常
function resultColor(item) {
  var ans = item.answer || {};
  var r = ans.result || '';
  if (!r || r === '待检查') return 'pending';
  if (r === NORMAL) return 'green';
  if (item.d === '关键决定项' && ans.threshold === '大于30cm×30cm') return 'red';
  if (item.d === '关键决定项' && ans.threshold === '小于30cm×30cm') return 'yellow';
  if (FIRE_TRIGGERS.indexOf(r) >= 0 || r === '水渍泥沙') return 'red';
  return 'yellow';
}

// 计算 alerts：事故车（关键项大于阈值计数）、泡水（五项中>=3项水渍泥沙）、火烧（三选项任一）
function computeAlerts(items) {
  var bigCount = 0;
  var waterCount = 0;
  var fire = false;
  var fireItems = [];
  items.forEach(function (it) {
    var ans = it.answer || {};
    if (it.d === '关键决定项' && ans.result !== NORMAL && ans.result !== '待检查' && ans.threshold === '大于30cm×30cm') bigCount++;
    if (WATER_KEY_ITEMS.indexOf(it.n) >= 0 && ans.result === '水渍泥沙') waterCount++;
    if (FIRE_TRIGGERS.indexOf(ans.result) >= 0) { fire = true; fireItems.push(it.n); }
  });
  var alerts = [];
  if (bigCount > 0) alerts.push({ type: 'accident', title: '事故车提示', text: '关键决定项中有 ' + bigCount + ' 项损伤大于 30cm×30cm。' });
  if (waterCount >= 3) alerts.push({ type: 'water', title: '泡水车提示', text: '重点泡水项中有 ' + waterCount + ' 项发现水渍泥沙。' });
  if (fire) alerts.push({ type: 'fire', title: '火烧车提示', text: '发现烧蚀/熏黑碳化/炙烤融化特征：' + fireItems.slice(0, 3).join('、') + (fireItems.length > 3 ? ' 等' : '') + '。' });
  return alerts;
}

// 提交校验：返回 { ok, errors: [{section, index, name, reason}], alerts }
function validateSubmission(sections) {
  var errors = [];
  var all = [];
  sections.forEach(function (sec) {
    sec.items.forEach(function (it, idx) {
      var res = itemComplete(it);
      all.push(it);
      if (!res.complete) errors.push({ section: sec.name, index: idx + 1, name: it.n, reason: res.reason });
      // 异常项至少一张照片
      if (isAbnormal(it) && (!it.answer || !it.answer.photos || it.answer.photos.length === 0)) {
        errors.push({ section: sec.name, index: idx + 1, name: it.n, reason: '异常项需附现场照片' });
      }
    });
  });
  return { ok: errors.length === 0, errors: errors, alerts: computeAlerts(all) };
}

// 模块是否全部配置（模板含空模块时禁止提交）
function modulesReady(sections) {
  return sections.every(function (s) { return s.items && s.items.length > 0; });
}

module.exports = {
  itemComplete: itemComplete, isAbnormal: isAbnormal, resultColor: resultColor,
  computeAlerts: computeAlerts, validateSubmission: validateSubmission,
  modulesReady: modulesReady, WATER_KEY_ITEMS: WATER_KEY_ITEMS, FIRE_TRIGGERS: FIRE_TRIGGERS
};

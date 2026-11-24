// 数据访问服务（全部经云 SDK，携带会话；tenant_id 由服务端 RLS 强制）
var A = require('./auth');
var U = require('../utils/util');
var cloud = A.cloud;
var db = cloud.database;

function unwrap(r) { return { data: r.data, error: r.error }; }

// 审计日志（追加式）
function audit(action, resourceType, resourceId, metadata) {
  var p = A.getProfile();
  var s = A.getSession();
  return db.from('audit_events').insert({
    id: U.uid('evt'), tenant_id: A.tenantId() || null,
    actor_uid: (s && s.user && s.user.id) || 'anonymous',
    action: action, resource_type: resourceType || '', resource_id: resourceId || '',
    metadata_json: metadata || {}
  });
}

// 订单
function createOrder(payload) {
  var order = {
    id: U.uid('ord'), tenant_id: A.tenantId(), order_no: U.orderNo(),
    vehicle_kind: payload.vehicle_kind, standard: payload.standard || '',
    package_key: payload.package_key, package_name: payload.package_name,
    plate: payload.plate || '', vin: payload.vin || '', brand_model: payload.brand_model || '',
    template_id: payload.template_id || '', inspector_uid: A.getSession().user.id,
    status: 'PENDING_INSPECTION', revision_no: 1
  };
  return db.from('orders').insert(order).select().single().then(function (r) {
    if (!r.error) audit('order.created', 'order', order.id, { package: order.package_key });
    return { data: r.data, error: r.error };
  });
}

function listOrders(filter) {
  filter = filter || {};
  var q = db.from('orders').select('*').order('created_at', { ascending: false });
  if (filter.status) q = q.eq('status', filter.status);
  return q.then(unwrap);
}

function getOrder(id) { return db.from('orders').select('*').eq('id', id).maybeSingle().then(unwrap); }

function updateOrder(id, patch) {
  return db.from('orders').update(patch).eq('id', id).select().single().then(unwrap);
}

// 检测版本
function getRevision(orderId, revNo) {
  return db.from('inspection_revisions').select('*')
    .eq('order_id', orderId).eq('revision_no', revNo || 1).maybeSingle().then(unwrap);
}

function saveDraft(orderId, revNo, payload) {
  return getRevision(orderId, revNo).then(function (r) {
    var patch = {
      tenant_id: A.tenantId(), order_id: orderId, revision_no: revNo,
      status: 'draft', answers_json: payload.answers || {},
      alerts_json: payload.alerts || [], updated_at: new Date().toISOString()
    };
    if (r.data) {
      return db.from('inspection_revisions').update(patch).eq('id', r.data.id).select().single().then(unwrap);
    }
    patch.id = U.uid('rev'); patch.content_hash = payload.hash || '';
    return db.from('inspection_revisions').insert(patch).select().single().then(unwrap);
  });
}

function submitRevision(orderId, revNo, payload) {
  return getRevision(orderId, revNo).then(function (r) {
    var patch = {
      tenant_id: A.tenantId(), order_id: orderId, revision_no: revNo,
      status: 'review_pending', answers_json: payload.answers || {},
      alerts_json: payload.alerts || [], content_hash: payload.hash || '',
      submitted_by: A.getSession().user.id, submitted_at: new Date().toISOString()
    };
    if (r.data) return db.from('inspection_revisions').update(patch).eq('id', r.data.id).select().single().then(unwrap);
    patch.id = U.uid('rev');
    return db.from('inspection_revisions').insert(patch).select().single().then(unwrap);
  }).then(function (r) {
    if (!r.error) {
      audit('inspection.submitted', 'order', orderId, { revision: revNo });
      return updateOrder(orderId, { status: 'REVIEW_PENDING' }).then(function () { return r; });
    }
    return r;
  });
}

// 审核队列 / 记录
function listReviewQueue() {
  return db.from('orders').select('*').eq('status', 'REVIEW_PENDING')
    .order('updated_at', { ascending: true }).then(unwrap);
}

// 构建不可变报告快照：签发时冻结订单信息、机构品牌、检测结论与结果明细
function buildSnapshot(order, revision, tenant) {
  var LIB = require('../utils/templates-lib');
  var R = require('./rules');
  var answers = (revision.answers_json) || {};
  var alerts = (revision.alerts_json) || [];
  var tpl = LIB[order.template_id] || LIB['car-standard'];
  var sections = [], photos = [], conclusionParts = [];
  (tpl ? tpl.modules : []).forEach(function (m) {
    var rows = [];
    m.items.forEach(function (it) {
      var ans = answers[it.n];
      if (!ans || !ans.result || ans.result === '待检查') return;
      rows.push({
        n: it.n, result: ans.result,
        threshold: ans.threshold || '',
        note: ans.note || '',
        color: R.resultColor(Object.assign({}, it, { answer: ans }))
      });
      if (ans.photos && ans.photos.length) {
        photos.push({ n: it.n, result: ans.result, urls: ans.photos });
      }
    });
    if (rows.length) sections.push({ name: m.name, items: rows });
  });
  alerts.forEach(function (a) { if (a && a.title) conclusionParts.push(a.title); });
  return {
    version: '1.0',
    plate: order.plate || '',
    brand_model: order.brand_model || '',
    vehicle_kind: order.vehicle_kind,
    package_name: order.package_name || '',
    standard: order.standard || '',
    template_id: order.template_id || '',
    revision_id: revision.id,
    content_hash: revision.content_hash || '',
    org_name: tenant ? tenant.name : '',
    org_logo: tenant ? (tenant.logo_url || '') : '',
    conclusion: conclusionParts.length ? conclusionParts.join(' / ') : '未触发事故车、泡水车、火烧车提示',
    alerts: alerts,
    sections: sections,
    photos: photos
  };
}

function approve(orderId, revisionId, revisionNo, revisionData) {
  var reportNo = 'RPT-' + U.orderNo();
  var reportId = U.uid('rpt');
  var reviewId = U.uid('revw');
  return Promise.all([getOrder(orderId), getTenant()]).then(function (rs) {
    if (rs[0].error || !rs[0].data) return { data: null, error: { message: '订单不存在' } };
    var snapshotted = revisionData || getRevision(orderId, revisionNo || 1);
    return Promise.resolve(snapshotted).then(function (rr) {
      var revision = (rr && rr.data) || {};
      var snapshot = buildSnapshot(rs[0].data, revision, rs[1].data);
      return db.rpc('publish_report_atomic', {
        p_order_id: orderId, p_revision_id: revisionId, p_snapshot: snapshot,
        p_report_id: reportId, p_report_no: reportNo, p_review_id: reviewId
      }).then(function (r) {
        return { data: r.data ? { id: r.data, report_no: reportNo, snapshot_json: snapshot } : null, error: r.error };
      });
    });
  });
}

function returnForFix(orderId, revisionId, comment, targetItemKeys) {
  if (!comment || !comment.trim()) return Promise.resolve({ error: { message: '退回必须填写修改意见' } });
  return db.from('review_records').insert({
    id: U.uid('revw'), tenant_id: A.tenantId(), order_id: orderId, revision_id: revisionId,
    decision: 'returned', comment: comment.trim(), target_items_json: targetItemKeys || [],
    reviewer_uid: A.getSession().user.id
  }).select().single().then(function (r) {
    if (r.error) return { data: null, error: r.error };
    return updateOrder(orderId, { status: 'NEEDS_MODIFICATION' }).then(function () {
      audit('review.returned', 'order', orderId, { comment: comment.slice(0, 60) });
      return { data: r.data, error: null };
    });
  });
}

function listReviews(orderId) {
  return db.from('review_records').select('*').eq('order_id', orderId)
    .order('created_at', { ascending: false }).then(unwrap);
}

// 报告
function getReportByOrder(orderId) {
  return db.from('reports').select('*').eq('order_id', orderId)
    .order('published_at', { ascending: false }).limit(1).maybeSingle().then(unwrap);
}

function listReports() {
  return db.from('reports').select('*').order('published_at', { ascending: false }).then(unwrap);
}

function publishSnapshot(reportId, snapshot) {
  return db.from('reports').update({ snapshot_json: snapshot }).eq('id', reportId).select().single().then(unwrap);
}

// 分享：令牌由服务端 CSPRNG 生成（256bit），数据库只存 SHA-256 哈希，前端仅拿到一次明文
function makeToken() {
  // 仅用于占位展示；真实令牌一律来自 issue_report_share 服务端函数
  return '';
}

function createShare(reportId, scope, days) {
  return db.rpc('issue_report_share', {
    p_report_id: reportId, p_scope: scope || {}, p_days: days || 30
  }).then(function (r) {
    if (r.error || (r.data && r.data.error)) {
      return { data: null, token: null, error: r.error || { message: r.data.error } };
    }
    return { data: r.data, token: r.data.token, error: null };
  });
}

function listShares(reportId) {
  return db.from('report_shares').select('*').eq('report_id', reportId)
    .order('created_at', { ascending: false }).then(unwrap);
}

function revokeShare(shareId) {
  return db.from('report_shares').update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', shareId).select().single().then(function (r) {
      if (!r.error) audit('report_share.revoked', 'share', shareId, {});
      return { data: r.data, error: r.error };
    });
}

// 机构 / 成员 / 模板（管理员）
function getTenant() { return db.from('tenants').select('*').eq('id', A.tenantId()).maybeSingle().then(unwrap); }
function updateTenant(id, patch) { return db.from('tenants').update(patch).eq('id', id).select().single().then(unwrap); }
function listMembers() { return db.from('tenant_members').select('*').eq('tenant_id', A.tenantId()).order('created_at', { ascending: false }).then(unwrap); }
function updateMember(id, patch) { return db.from('tenant_members').update(patch).eq('id', id).select().single().then(unwrap); }
function listTemplates() { return db.from('templates').select('*').eq('tenant_id', A.tenantId()).then(unwrap); }
function listAudit(limit) { return db.from('audit_events').select('*').order('created_at', { ascending: false }).limit(limit || 50).then(unwrap); }

module.exports = {
  audit: audit, createOrder: createOrder, listOrders: listOrders, getOrder: getOrder, updateOrder: updateOrder,
  getRevision: getRevision, saveDraft: saveDraft, submitRevision: submitRevision,
  listReviewQueue: listReviewQueue, approve: approve, returnForFix: returnForFix, listReviews: listReviews,
  getReportByOrder: getReportByOrder, listReports: listReports, publishSnapshot: publishSnapshot,
  createShare: createShare, listShares: listShares, revokeShare: revokeShare, makeToken: makeToken,
  getTenant: getTenant, updateTenant: updateTenant, listMembers: listMembers, updateMember: updateMember,
  listTemplates: listTemplates, listAudit: listAudit
};

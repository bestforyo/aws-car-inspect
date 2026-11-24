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

function approve(orderId, revisionId) {
  var reportNo = 'RPT-' + U.orderNo();
  var report = {
    id: U.uid('rpt'), tenant_id: A.tenantId(), order_id: orderId,
    report_no: reportNo, revision_id: revisionId, status: 'published',
    snapshot_json: {}, published_by: A.getSession().user.id, published_at: new Date().toISOString()
  };
  return db.from('reports').insert(report).select().single().then(function (r) {
    if (r.error) return { data: null, error: r.error };
    return db.from('review_records').insert({
      id: U.uid('revw'), tenant_id: A.tenantId(), order_id: orderId, revision_id: revisionId,
      decision: 'approved', reviewer_uid: A.getSession().user.id, target_items_json: []
    }).select().single().then(function () {
      return updateOrder(orderId, { status: 'PUBLISHED' }).then(function () {
        audit('review.approved', 'order', orderId, { report: reportNo });
        return { data: r.data, error: null };
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

// 分享（高熵令牌，只存哈希）
function makeToken() {
  var a = U.uid('').replace(/[^a-zA-Z0-9]/g, '');
  var b = U.uid('').replace(/[^a-zA-Z0-9]/g, '');
  return a + b; // >128bit 熵（40+40 位字母数字）
}

function createShare(reportId, scope, days) {
  var token = makeToken();
  var hash = U.hashText(token) + U.hashText(token.split('').reverse().join(''));
  var expires = new Date(Date.now() + (days || 30) * 86400000).toISOString();
  return db.from('report_shares').insert({
    id: U.uid('share'), tenant_id: A.tenantId(), report_id: reportId, token_hash: hash,
    status: 'active', expires_at: expires, scope_json: scope || {},
    created_by: A.getSession().user.id
  }).select().single().then(function (r) {
    if (!r.error) audit('report_share.created', 'report', reportId, {});
    return { data: r.data, token: token, error: r.error };
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

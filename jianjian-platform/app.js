/* 鉴见 · 平台运营后台（仅平台超级管理员）— 视觉严格复刻原型工作台 */
(function () {
  // 预览演示模式（?preview=1）：只读示例数据，仅用于查看界面；不接入真实权限。
  var previewMode = new URLSearchParams(location.search).get('preview') === '1';
  var sample = {
    tenants: [
      { id: 'tenant_hd001', name: '华东机动车检测中心', code: 'HDJC001', status: 'active', plan_id: 'premium', expires_at: '2027-06-30T00:00:00Z', created_at: '2026-03-12T08:20:00Z' },
      { id: 'tenant_nf002', name: '南方车辆鉴定服务部', code: 'NFJD002', status: 'active', plan_id: 'standard', expires_at: '2027-01-15T00:00:00Z', created_at: '2026-05-08T02:10:00Z' },
      { id: 'tenant_xb003', name: '西部交通事故鉴定所', code: 'XBJG003', status: 'suspended', plan_id: 'basic', expires_at: '2026-12-01T00:00:00Z', created_at: '2026-01-22T11:05:00Z' }
    ],
    orders: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28],
    reports: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
    tenant_members: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    user_profiles: [
      { uid: 'u_admin_001', display_name: '平台管理员', system_role: 'platform_admin', current_tenant_id: '' },
      { uid: 'u_ops_002', display_name: '运营专员', system_role: 'user', current_tenant_id: '' }
    ],
    audit_events: [
      { id: 'a1', action: 'ORDER_SUBMITTED', resource_type: 'order', actor_uid: 'u_inspector_01', tenant_id: 'tenant_hd001', created_at: '2026-11-24T09:12:00Z' },
      { id: 'a2', action: 'REVIEW_APPROVED', resource_type: 'review', actor_uid: 'u_admin_hd', tenant_id: 'tenant_hd001', created_at: '2026-11-23T16:40:00Z' },
      { id: 'a3', action: 'REPORT_PUBLISHED', resource_type: 'report', actor_uid: 'u_admin_hd', tenant_id: 'tenant_hd001', created_at: '2026-11-23T16:42:00Z' },
      { id: 'a4', action: 'TENANT_SUSPENDED', resource_type: 'tenant', actor_uid: 'u_admin_001', tenant_id: 'tenant_xb003', created_at: '2026-11-20T03:18:00Z' },
      { id: 'a5', action: 'SHARE_TOKEN_CREATED', resource_type: 'share', actor_uid: 'u_admin_nf', tenant_id: 'tenant_nf002', created_at: '2026-11-19T07:55:00Z' }
    ]
  };
  function previewChain(table) {
    var o = {
      _t: table, _write: false,
      select: function () { return o; }, order: function () { return o; }, limit: function () { return o; },
      eq: function () { return o; }, maybeSingle: function () { return o; }, single: function () { return o; },
      insert: function () { o._write = true; return o; },
      update: function () { o._write = true; return o; },
      upsert: function () { o._write = true; return o; },
      then: function (resolve) {
        if (o._write) return Promise.resolve({ data: null, error: { message: '预览模式为只读演示' } }).then(resolve);
        var d = sample[table] || [];
        return Promise.resolve({ data: d, count: d.length, error: null }).then(resolve);
      }
    };
    return o;
  }
  function getDB() { return previewMode ? { from: previewChain } : cloud.database; }

  var content = document.getElementById('content');
  var crumb = document.getElementById('crumb');
  var toastEl = document.getElementById('toast');
  var modalMask = document.getElementById('modalMask');
  var modalBody = document.getElementById('modalBody');

  // ---------- 图标（与原型同为线性 stroke 风格） ----------
  var I = {
    plus:'<path d="M12 5v14M5 12h14"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    upRight:'<path d="M7 17 17 7M8 7h9v9"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    building:'<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/>',
    package:'<path d="m7.5 4.3 9 5.2M3.3 10.7 12 16l8.7-5.3M12 16v5M12 2 3 7v10l9 5 9-5V7z"/>',
    clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    gauge:'<path d="m12 14 4-4M3.3 18a10 10 0 1 1 17.4 0"/>',
    check:'<path d="m20 6-11 11-5-5"/>'
  };
  function svg(name, size) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + I[name] + '</svg>';
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(ts) {
    if (!ts) return '—';
    var d = new Date(ts), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function fmtTime(ts) {
    if (!ts) return '—';
    var d = new Date(ts), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return fmt(ts) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function uid(pre) {
    var s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', r = '';
    for (var i = 0; i < 18; i++) r += s[Math.floor(Math.random() * s.length)];
    return (pre || 'id') + '_' + Date.now().toString(36) + '_' + r;
  }
  function heading(eyebrow, title, desc, action) {
    return '<div class="page-heading"><div><span class="eyebrow">' + eyebrow + '</span><h1>' + title + '</h1><p>' + desc + '</p></div>' +
      (action ? '<div class="page-heading__action">' + action + '</div>' : '') + '</div>';
  }
  function pill(text, tone) {
    return '<span class="status-pill status-pill--' + (tone || 'neutral') + '"><i></i>' + esc(text) + '</span>';
  }
  function empty(title, desc) {
    return '<div class="empty-state"><div>' + svg('file', 20) + '</div><strong>' + title + '</strong><span>' + desc + '</span></div>';
  }

  // ---------- 登录 ----------
  function enterApp(name) {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');
    var display = name || '平台管理员';
    document.getElementById('sideName').textContent = display;
    document.getElementById('sideRole').textContent = '平台超级管理员 · 平台';
    document.getElementById('topAvatar').textContent = display.slice(0, 1);
    document.getElementById('sideAvatar').textContent = display.slice(0, 1);
    if (previewMode) {
      var badge = document.createElement('span');
      badge.className = 'demo-badge';
      badge.textContent = '只读示例';
      document.querySelector('.topbar-right').insertBefore(badge, document.getElementById('topHelp'));
    }
    navigate('overview');
  }
  function enterPreview() {
    enterApp('预览演示');
    var p = new URLSearchParams(location.search).get('page');
    if (p && names[p] && p !== 'overview') navigate(p);
  }

  function restoreAuth() {
    if (previewMode) { enterPreview(); return; }
    var url = new URL(location.href);
    var provider = url.searchParams.get('provider');
    if (url.searchParams.has('code') || url.searchParams.has('error')) {
      var handler = provider === 'workbuddy' ? cloud.auth.handleWorkBuddyCallback
        : provider === 'wechat' ? cloud.auth.handleWechatWebCallback : null;
      if (!handler) { document.getElementById('loginMsg').textContent = '授权回调缺少有效的登录方式'; return; }
      handler.call(cloud.auth).then(function (r) {
        if (r.error) { document.getElementById('loginMsg').textContent = r.error.message; return; }
        for (var k of ['code', 'state', 'provider']) url.searchParams.delete(k);
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        enterApp();
      });
      return;
    }
    cloud.auth.getSession().then(function (r) {
      if (r.data) {
        cloud.database.from('user_profiles').select('*').eq('uid', r.data.user.id).maybeSingle().then(function (p) {
          if (p.data && p.data.system_role === 'platform_admin') { session = r.data; enterApp(p.data.display_name); }
        });
      }
    });
  }
  document.getElementById('loginBtn').onclick = function () {
    var back = new URL(location.href); back.pathname = '/';
    for (var k of ['code', 'state', 'provider']) back.searchParams.delete(k);
    cloud.auth.signInWithOAuth({ provider: 'workbuddy', redirectTo: back.toString() }).then(function (r) {
      if (r.error) document.getElementById('loginMsg').textContent = r.error.message;
      else location.assign(r.data.url);
    });
  };

  // ---------- 导航 ----------
  var names = { overview:'工作概览', tenants:'机构列表', plans:'套餐与配额', accounts:'平台账号', audit:'全局审计' };
  function navigate(page) {
    document.querySelectorAll('.nav-item, .side-nav__item').forEach(function (n) { n.classList.toggle('is-active', n.dataset.page === page); });
    crumb.textContent = names[page];
    document.getElementById('sidebar').classList.remove('sidebar--open');
    ({ overview:renderOverview, tenants:renderTenants, plans:renderPlans, accounts:renderAccounts, audit:renderAudit })[page]();
  }
  document.getElementById('nav').addEventListener('click', function (e) {
    var item = e.target.closest('.side-nav__item');
    if (item) navigate(item.dataset.page);
  });
  document.getElementById('brandBtn').onclick = function () { navigate('overview'); };
  document.getElementById('menuToggle').onclick = function () { document.getElementById('sidebar').classList.toggle('sidebar--open'); };
  document.getElementById('topHelp').onclick = document.getElementById('helpBtn').onclick = function () { toast('帮助中心即将开放'); };
  document.getElementById('userBtn').onclick = document.getElementById('topAvatar').onclick = function () { toast('平台超级管理员 · 权限由平台方管理'); };

  // ---------- 工作概览 ----------
  function renderOverview() {
    var d = new Date();
    var week = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][d.getDay()];
    var month = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][d.getMonth()];
    var dateLabel = week + ', ' + month + ' ' + String(d.getDate()).padStart(2,'0') + ', ' + d.getFullYear();
    var hour = d.getHours();
    var greet = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    content.innerHTML =
      '<section class="welcome-strip">' +
        '<div><span class="welcome-date">' + dateLabel + ' <i></i></span><h1>' + greet + '，平台管理员 <span>✳</span></h1><p>把每一处细节，变成值得信赖的判断。</p></div>' +
        '<div class="welcome-metric"><span>本月新增机构</span><strong>3 <small>家机构</small></strong><div><span class="metric-trend">' + svg('upRight',13) + ' 16.8%</span> 较上月</div></div>' +
        '<div class="welcome-orbit"><div class="orbit-ring"></div><div class="orbit-ring orbit-ring--two"></div><div class="orbit-center">' + svg('gauge',26) + '</div><span class="orbit-dot orbit-dot--a"></span><span class="orbit-dot orbit-dot--b"></span><span class="orbit-dot orbit-dot--c"></span></div>' +
      '</section>' +
      '<div class="section-title section-title--start"><div><span class="eyebrow">PLATFORM OVERVIEW</span><h2>全平台概览</h2><p>机构、订单与报告的运营状态，敏感检测内容默认不展示。</p></div><button class="text-link" id="goTenants">查看机构 ' + svg('arrow',15) + '</button></div>' +
      '<div class="dashboard-grid" id="statGrid"></div>' +
      '<div class="section-title" style="margin-top:32px"><div><span class="eyebrow">CURRENT FOCUS</span><h2>工作进度</h2><p>平台开通与运营支持的执行概览。</p></div></div>' +
      '<div class="dashboard-grid" style="grid-template-columns:1.6fr 1fr">' +
        '<div class="today-card"><div class="today-card__head"><div><span class="eyebrow">TODAY\'S FOCUS</span><strong>运营进度</strong></div><span class="today-badge"><span></span> 进行中</span></div>' +
        '<div class="progress-stat"><span>入驻流程待跟进</span><strong>2 <small>/ 4 家</small></strong></div><div class="progress-track"><span style="width:50%"></span></div>' +
        '<div class="today-steps"><div class="today-step is-done"><span>' + svg('check',12) + '</span><strong>已开通</strong><small>1 家</small></div><div class="today-step is-live"><span>2</span><strong>跟进中</strong><small>2 家</small></div><div class="today-step"><span>3</span><strong>待审核</strong><small>1 家</small></div></div>' +
        '<button class="today-action" id="goAudit">查看审计记录 ' + svg('arrow',15) + '</button></div>' +
        '<div class="today-card"><div class="today-card__head"><div><span class="eyebrow">PRIVACY</span><strong>数据边界</strong></div>' + svg('shield',17) + '</div>' +
        '<div style="color:#839194;font-size:10px;line-height:1.9;margin-top:16px">平台后台用于机构入驻、状态管理、套餐配额与全局审计。默认不展示机构检测照片与完整报告正文；如需查看敏感检测内容，须具备明确授权、工单与审计目的。</div>' +
        '<div class="standard-disclaimer" style="margin-top:14px">' + svg('info',14) + '<span>机构业务角色仅检测师与机构管理员两种。</span></div></div>' +
      '</div>';
    document.getElementById('goTenants').onclick = function () { navigate('tenants'); };
    document.getElementById('goAudit').onclick = function () { navigate('audit'); };
    Promise.all([
      getDB().from('tenants').select('*', { count:'exact' }),
      getDB().from('orders').select('*', { count:'exact' }),
      getDB().from('reports').select('*', { count:'exact' }),
      getDB().from('tenant_members').select('*', { count:'exact' })
    ]).then(function (rs) {
      var stats = [
        { n:rs[0].count||0, l:'检测机构', icon:'building', tone:'green', foot:'已入驻并通过认证' },
        { n:rs[1].count||0, l:'检测订单', icon:'file', tone:'blue', foot:'全平台累计' },
        { n:rs[2].count||0, l:'正式报告', icon:'shield', tone:'amber', foot:'已发布不可变版本' },
        { n:rs[3].count||0, l:'机构成员', icon:'users', tone:'coral', foot:'检测师与管理员' }
      ];
      document.getElementById('statGrid').innerHTML = stats.map(function (s) {
        return '<div class="stat-card"><div class="stat-card__top"><div class="stat-card__icon stat-card__icon--' + s.tone + '">' + svg(s.icon,17) + '</div><span class="stat-card__trend">全平台</span></div>' +
          '<strong>' + s.n + '</strong><small>' + s.l + '</small><div class="stat-card__foot">' + s.foot + '</div></div>';
      }).join('');
    });
  }

  // ---------- 机构列表 ----------
  function renderTenants() {
    content.innerHTML = heading('TENANTS', '机构列表', '机构入驻、首个管理员开通、状态与套餐。',
      '<button class="button button--primary" id="newTenant">' + svg('plus',17) + ' 新建机构</button>') +
      '<div class="template-banner"><div class="template-banner__mark">' + svg('building',21) + '</div>' +
      '<div><strong>机构入驻流程</strong><span>平台开通机构 → 创建首个机构管理员 → 机构自主管理成员与模板。停用后历史数据只读保留。</span></div>' +
      '<span class="banner-count" id="tenantTotal">0<small>家机构</small></span></div>' +
      '<div class="order-toolbar"><div class="filter-tabs" id="tenantFilters">' +
      '<button class="is-active" data-f="all">全部 <span>3</span></button><button data-f="active">正常</button><button data-f="suspended">已停用</button></div>' +
      '<button class="toolbar-icon" id="refreshTenants">' + svg('clock',16) + ' 刷新</button></div>' +
      '<div class="order-list-card"><div class="table-heading"><span>机构名称 / 编码</span><span>状态</span><span>套餐</span><span>到期日</span><span>创建时间</span><span style="text-align:right">操作</span></div>' +
      '<div id="tenantRows"></div></div>' +
      '<div class="privacy-footnote">' + svg('shield',15) + ' 机构停用后，机构认证与接口按平台策略拒绝；历史数据只读保留。</div>';
    document.getElementById('newTenant').onclick = openTenantModal;
    document.getElementById('refreshTenants').onclick = function () { renderTenants(); toast('已刷新'); };
    document.getElementById('tenantFilters').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      document.querySelectorAll('#tenantFilters button').forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      loadTenants(b.dataset.f);
    });
    loadTenants('all');
  }
  function loadTenants(filter) {
    getDB().from('tenants').select('*').order('created_at', { ascending:false }).then(function (r) {
      var rows = (r.data || []).filter(function (t) { return filter === 'all' || t.status === filter; });
      document.getElementById('tenantTotal').innerHTML = (r.data || []).length + '<small>家机构</small>';
      document.getElementById('tenantBadge').textContent = (r.data || []).length;
      document.getElementById('tenantRows').innerHTML = rows.length ? rows.map(function (t) {
        var status = t.status === 'active' ? ['正常','green'] : t.status === 'suspended' ? ['已停用','coral'] : [t.status,'neutral'];
        var plan = t.plan_id === 'premium' ? '高级版' : t.plan_id === 'standard' ? '标准版' : t.plan_id === 'basic' ? '基础版' : (t.plan_id || '默认');
        return '<div class="order-table-row"><span class="cell-primary"><span class="cell-strong">' + esc(t.name) + '</span><span class="cell-sub">' + esc(t.code) + '</span></span>' +
          '<span>' + pill(status[0], status[1]) + '</span><span class="cell-muted">' + esc(plan) + '</span>' +
          '<span class="cell-muted">' + fmt(t.expires_at) + '</span><span class="cell-muted">' + fmt(t.created_at) + '</span>' +
          '<span class="cell-actions">' +
          (t.status === 'active'
            ? '<button class="mini-btn mini-btn--coral" data-a="stop" data-id="' + t.id + '">停用</button>'
            : '<button class="mini-btn" data-a="start" data-id="' + t.id + '">恢复</button>') +
          '<button class="mini-btn" data-a="plan" data-id="' + t.id + '">套餐</button>' +
          '<button class="mini-btn" data-a="admin" data-id="' + t.id + '">开通管理员</button></span></div>';
      }).join('') : empty('暂无此状态的机构', '切换筛选条件，或新建一家机构。');
      document.querySelectorAll('#tenantRows [data-a]').forEach(function (b) {
        b.onclick = function () {
          var id = b.dataset.id;
          if (b.dataset.a === 'stop') toggleTenant(id, 'suspended');
          else if (b.dataset.a === 'start') toggleTenant(id, 'active');
          else if (b.dataset.a === 'plan') openPlanModal(id);
          else openAdminModal(id);
        };
      });
    });
  }
  function openTenantModal() {
    showModal('<h3>新建机构</h3><div style="color:#97a3a2;font-size:9px">开通后将创建租户记录，随后需开通首个机构管理员。</div>' +
      '<div class="field"><label>机构名称</label><input id="fName" placeholder="如 某某车辆检测中心"></div>' +
      '<div class="field"><label>机构编码（唯一）</label><input id="fCode" placeholder="如 JIANJIAN01"></div>' +
      '<div class="modal-actions"><button class="button button--secondary" onclick="closeModal()">取消</button><button class="button button--primary" id="doCreate">创建机构</button></div>');
    document.getElementById('doCreate').onclick = function () {
      var name = document.getElementById('fName').value.trim(), code = document.getElementById('fCode').value.trim();
      if (!name || !code) { toast('请填写完整'); return; }
      getDB().from('tenants').insert({ id:uid('tenant'), name:name, code:code, status:'active' }).select().single().then(function (r) {
        if (r.error) { toast(r.error.message || '创建失败'); return; }
        closeModal(); toast('机构已创建'); renderTenants();
      });
    };
  }
  function toggleTenant(id, status) {
    var txt = status === 'suspended' ? '停用后该机构认证与接口将按平台策略拒绝，历史数据只读保留。确认停用？' : '确认恢复该机构？';
    if (!confirm(txt)) return;
    getDB().from('tenants').update({ status:status }).eq('id', id).select().then(function () {
      toast(status === 'suspended' ? '已停用' : '已恢复'); renderTenants();
    });
  }
  function openPlanModal(id) {
    showModal('<h3>套餐与到期日</h3><div style="color:#97a3a2;font-size:9px">设置机构服务套餐与有效期。</div>' +
      '<div class="field"><label>套餐标识</label><input id="fPlan" placeholder="premium / standard / basic"></div>' +
      '<div class="field"><label>到期日</label><input id="fExp" type="date"></div>' +
      '<div class="modal-actions"><button class="button button--secondary" onclick="closeModal()">取消</button><button class="button button--primary" id="doPlan">保存</button></div>');
    document.getElementById('doPlan').onclick = function () {
      var plan = document.getElementById('fPlan').value.trim(), exp = document.getElementById('fExp').value, patch = {};
      if (plan) patch.plan_id = plan; if (exp) patch.expires_at = new Date(exp).toISOString();
      getDB().from('tenants').update(patch).eq('id', id).select().then(function (r) {
        if (r.error) { toast(r.error.message); return; }
        closeModal(); toast('已保存'); renderTenants();
      });
    };
  }
  function openAdminModal(tid) {
    showModal('<h3>开通机构管理员</h3><div style="color:#97a3a2;font-size:9px">输入目标成员的账号 uid，将其设为该机构的管理员。</div>' +
      '<div class="field"><label>成员账号 uid</label><input id="fUid" placeholder="终端用户 uid"></div>' +
      '<div class="field"><label>显示名称</label><input id="fDisp" placeholder="管理员姓名"></div>' +
      '<div class="notice">成员需先登录过小程序以生成账号。开通后该成员在小程序中可见机构工作空间。</div>' +
      '<div class="modal-actions"><button class="button button--secondary" onclick="closeModal()">取消</button><button class="button button--primary" id="doAdmin">开通</button></div>');
    document.getElementById('doAdmin').onclick = function () {
      var u = document.getElementById('fUid').value.trim(), d = document.getElementById('fDisp').value.trim();
      if (!u) { toast('请输入成员 uid'); return; }
      getDB().from('tenant_members').upsert({ id:uid('mem'), tenant_id:tid, uid:u, role:'org_admin', display_name:d||'机构管理员', status:'active' }).select().then(function (r) {
        if (r.error) { toast(r.error.message); return; }
        getDB().from('user_profiles').upsert({ uid:u, display_name:d||'机构管理员', current_tenant_id:tid, system_role:'user' }).then(function () {
          closeModal(); toast('管理员已开通');
        });
      });
    };
  }

  // ---------- 套餐与配额 ----------
  function renderPlans() {
    content.innerHTML = heading('PLANS & QUOTA', '套餐与配额', '按机构查看套餐、到期状态与服务配额。') +
      '<div class="template-banner"><div class="template-banner__mark">' + svg('package',21) + '</div>' +
      '<div><strong>服务有效期</strong><span>机构到期后认证与接口按平台策略拒绝，历史数据依保留政策只读保留。</span></div></div>' +
      '<div class="order-list-card"><div class="table-heading" style="grid-template-columns:2fr 1fr 1fr 1fr"><span>机构</span><span>套餐</span><span>到期日</span><span>状态</span></div><div id="planRows"></div></div>';
    getDB().from('tenants').select('*').order('created_at', { ascending:false }).then(function (r) {
      document.getElementById('planRows').innerHTML = (r.data || []).map(function (t) {
        var expired = t.expires_at && new Date(t.expires_at) < new Date();
        var plan = t.plan_id === 'premium' ? '高级版' : t.plan_id === 'standard' ? '标准版' : t.plan_id === 'basic' ? '基础版' : '默认套餐';
        return '<div class="order-table-row" style="grid-template-columns:2fr 1fr 1fr 1fr"><span class="cell-strong">' + esc(t.name) + '</span><span class="cell-muted">' + esc(plan) + '</span><span class="cell-muted">' + fmt(t.expires_at) + '</span><span>' + pill(expired?'已到期':'有效', expired?'amber':'green') + '</span></div>';
      }).join('') || empty('暂无机构', '机构入驻后可在此查看套餐与配额。');
    });
  }

  // ---------- 平台账号 ----------
  function renderAccounts() {
    content.innerHTML = heading('PLATFORM ACCOUNTS', '平台账号', '平台超级管理员与运营账号（敏感权限）。') +
      '<div class="order-list-card"><div class="table-heading" style="grid-template-columns:2fr 1fr 1fr 1fr"><span>名称</span><span>系统角色</span><span>当前机构</span><span>账号 uid</span></div><div id="acctRows"></div></div>' +
      '<div class="standard-disclaimer" style="background:#f9eeea;border-color:#edd3ca;color:#b9725d">' + svg('shield',14) + '<span>高风险操作：平台超级管理员权限变更须二次确认并全部审计。前端不提供自我提权入口。</span></div>';
    getDB().from('user_profiles').select('*').order('created_at', { ascending:false }).then(function (r) {
      document.getElementById('acctRows').innerHTML = (r.data || []).map(function (p) {
        var admin = p.system_role === 'platform_admin';
        return '<div class="order-table-row" style="grid-template-columns:2fr 1fr 1fr 1fr"><span class="cell-strong">' + esc(p.display_name || '—') + '</span><span>' + pill(admin?'平台超级管理员':'普通用户', admin?'green':'neutral') + '</span><span class="cell-muted">' + esc(p.current_tenant_id || '—') + '</span><span class="cell-sub">' + esc(p.uid) + '</span></div>';
      }).join('') || empty('暂无账号', '账号首次登录后显示在此。');
    });
  }

  // ---------- 全局审计 ----------
  function renderAudit() {
    content.innerHTML = heading('AUDIT LOG', '全局审计', '追加式操作审计（脱敏元信息），按时间倒序。') +
      '<div class="order-list-card"><div class="table-heading" style="grid-template-columns:1.2fr 1.4fr 1fr 1fr 1.4fr"><span>时间</span><span>操作</span><span>资源</span><span>操作人</span><span>租户</span></div><div id="auditRows"></div></div>' +
      '<div class="privacy-footnote">' + svg('shield',15) + ' 审计记录只含脱敏元信息，不包含检测照片与报告正文。</div>';
    getDB().from('audit_events').select('*').order('created_at', { ascending:false }).limit(100).then(function (r) {
      document.getElementById('auditRows').innerHTML = (r.data || []).map(function (a) {
        return '<div class="order-table-row" style="grid-template-columns:1.2fr 1.4fr 1fr 1fr 1.4fr"><span class="cell-muted">' + fmtTime(a.created_at) + '</span><span class="cell-strong" style="font-size:9px">' + esc(a.action) + '</span><span class="cell-muted">' + esc(a.resource_type) + '</span><span class="cell-sub">' + esc(String(a.actor_uid).slice(0,12)) + '</span><span class="cell-sub">' + esc(a.tenant_id || '平台') + '</span></div>';
      }).join('') || empty('暂无审计记录', '操作发生后自动追加。');
    });
  }

  // ---------- 弹层 ----------
  function showModal(html) { modalBody.innerHTML = html; modalMask.classList.add('show'); }
  window.closeModal = function () { modalMask.classList.remove('show'); };
  modalMask.addEventListener('click', function (e) { if (e.target === modalMask) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  restoreAuth();
})();

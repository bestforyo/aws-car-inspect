// 现场照片云存储服务：上传到 users/<uid>/inspection/ 下，跨设备持久化
// 存储路径由服务端 SDK 强制归属当前登录用户，前端不能指定任意对象键。
var A = require('./auth');
var U = require('../utils/util');
var cloud = A.cloud;

// 把 wx.chooseImage 的临时文件路径读成 ArrayBuffer 并上传
function uploadInspectionPhoto(tempPath, orderId, itemName) {
  var session = A.getSession();
  if (!session || !session.user || !session.user.id) {
    return Promise.resolve({ error: { message: '请先登录后再上传照片' } });
  }
  var uid = session.user.id;
  var safeItem = String(itemName || 'item').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 40);
  var ext = /\.(\w+)$/.test(tempPath) ? RegExp.$1.toLowerCase() : 'jpg';
  if (ext === 'jpeg') ext = 'jpg';
  var objectName = 'inspection/' + orderId + '/' + Date.now() + '_' + safeItem + '_' + U.uid('').slice(0, 6) + '.' + ext;
  var path = cloud.storage.userPath(uid, objectName);

  return new Promise(function (resolve) {
    wx.getFileSystemManager().readFile({
      filePath: tempPath,
      success: function (fr) {
        cloud.storage.upload(path, fr.data, {
          contentType: 'image/' + (ext === 'jpg' ? 'jpeg' : ext),
          cacheControl: '3600',
          upsert: false,
          metadata: { purpose: 'inspection', order_id: orderId, item: safeItem }
        }).then(function (r) {
          resolve({ data: { path: path, tempUrl: tempPath }, error: r.error || null });
        }).catch(function (e) {
          resolve({ error: { message: (e && e.message) || '上传失败' } });
        });
      },
      fail: function (e) {
        resolve({ error: { message: (e && e.errMsg) || '读取照片失败' } });
      }
    });
  });
}

// 批量上传，返回成功的云路径数组
function uploadPhotos(tempPaths, orderId, itemName) {
  var tasks = (tempPaths || []).map(function (p) { return uploadInspectionPhoto(p, orderId, itemName); });
  return Promise.all(tasks).then(function (rs) {
    var paths = [], errors = [];
    rs.forEach(function (r) {
      if (r.error) errors.push(r.error.message);
      else if (r.data && r.data.path) paths.push(r.data.path);
    });
    return { paths: paths, errors: errors, data: paths, error: errors.length ? { message: errors.join('；') } : null };
  });
}

// 获取临时可访问 URL（用于预览与报告展示；签名 URL 有有效期，过期需重新签发）
function signedUrls(paths, ttlSeconds) {
  if (!paths || !paths.length) return Promise.resolve({ data: [], error: null });
  return cloud.storage.createSignedUrls(paths, ttlSeconds || 3600).then(function (r) {
    return { data: r.data, error: r.error || null };
  }).catch(function (e) {
    return { error: { message: (e && e.message) || '签名失败' } };
  });
}

module.exports = { uploadInspectionPhoto: uploadInspectionPhoto, uploadPhotos: uploadPhotos, signedUrls: signedUrls };

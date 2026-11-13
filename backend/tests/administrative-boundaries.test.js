const test = require('node:test');
const assert = require('node:assert/strict');
const divisions = require('../../frontend/src/data/vietnam-divisions.json');
const { getBoundaryByCode, locateAdministrativeUnit } = require('../services/administrative-boundary-service');
const classificationRouter = require('../routes/classification');

test('danh mục địa giới hiện hành có đủ tỉnh và đơn vị cấp xã, mã duy nhất', () => {
  const units = divisions.flatMap(province => province.wards.map(unit => ({ ...unit, province })));
  assert.equal(divisions.length, 34);
  assert.equal(units.length, 3321);
  assert.equal(new Set(divisions.map(item => item.code)).size, 34);
  assert.equal(new Set(units.map(item => item.code)).size, 3321);
  assert.ok(units.every(unit => unit.province.code && unit.malk && unit.name));
});

test('ranh giới được truy vấn theo mã và chuẩn hóa tọa độ chuỗi', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.match(String(url), /\/pread_json$/);
    assert.match(String(options.body), /diaphanhanhchinhcapxa_2025\.39/);
    return { ok: true, json: async () => ({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[['106.7 10.7'], ['106.8 10.8'], ['106.7 10.7']]] }, properties: {} }] }) };
  };
  try {
    const result = await getBoundaryByCode('26743');
    assert.deepEqual(result.features[0].geometry.coordinates[0][0], [106.7, 10.7]);
    assert.deepEqual(result.features[0].geometry.coordinates[0][1], [106.8, 10.8]);
  } finally { global.fetch = originalFetch; }
});

test('tọa độ trung tâm Quận 1 cũ được xác định đúng phường hiện hành', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => {
    assert.match(String(url), /GetFeatureInfo/);
    return { ok: true, json: async () => ({ features: [{ id: 'diaphanhanhchinhcapxa_2025.39', properties: { a03_ten: 'Phường Bến Thành' } }] }) };
  };
  try {
    const result = await locateAdministrativeUnit(10.77, 106.698);
    assert.equal(result.unit.name, 'Phường Bến Thành');
    assert.notEqual(result.unit.name, 'Phường Bình Tân');
    assert.equal(result.province.name, divisions.find(province => province.code === '79').name);
  } finally { global.fetch = originalFetch; }
});

test('tọa độ ngoài phạm vi địa lý không được gửi tới dịch vụ', async () => {
  await assert.rejects(() => locateAdministrativeUnit(95, 200), { status: 400 });
});

test('API tra cứu ranh giới nhận mã đơn vị và trả GeoJSON', async () => {
  const layer = classificationRouter.stack.find(item => item.route?.path === '/administrative-units/:code/boundary');
  assert.ok(layer, 'route boundary phải được đăng ký');
  const handler = layer.route.stack[0].handle;
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[106, 10], [107, 10], [106, 10]]] }, properties: {} }] }) });
  let statusCode = 200;
  let body;
  const response = { status(code) { statusCode = code; return this; }, json(data) { body = data; return this; } };
  try {
    await handler({ params: { code: '26743' } }, response);
    assert.equal(statusCode, 200);
    assert.equal(body.success, true);
    assert.equal(body.featureCollection.type, 'FeatureCollection');
  } finally { global.fetch = originalFetch; }
});

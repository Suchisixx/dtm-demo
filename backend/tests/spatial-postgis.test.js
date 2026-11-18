const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSpatialContext, analyzeSpatialContextWithDb } = require('../services/spatial-gis-service');
const { ensureGisSchema } = require('../services/project-verification-repository');

function createDb({ spatialRows = [], postgisError = null } = {}) {
  const sqlSeen = [];
  return {
    sqlSeen,
    async query(sql, params = []) {
      sqlSeen.push({ sql, params });
      if (/SELECT EXISTS/i.test(sql)) return { rows: [{ ready: false }] };
      if (/SELECT id, layer_type, name, category, flag_key, latitude, longitude, radius_km/i.test(sql)) {
        return { rows: [{
          id: 'test_zone', layer_type: 'SENSITIVE_ZONE', name: 'Test zone', category: 'bao_ton',
          flag_key: 'bao_ton', latitude: 10, longitude: 106, radius_km: 1,
          geometry_json: { type: 'Polygon', coordinates: [] }, province: 'Test', legal_ref: 'test',
          verification_status: 'VERIFIED', publication_status: 'PUBLISHED', source_document: 'test',
        }] };
      }
      if (/ST_Covers/i.test(sql)) {
        if (postgisError) throw postgisError;
        return { rows: spatialRows };
      }
      throw new Error(`Unexpected SQL in PostGIS unit test: ${sql}`);
    },
  };
}

test('PostGIS result marks polygon-covered point and uses DB spatial query', async () => {
  const db = createDb({ spatialRows: [{
    id: 'test_zone', geometry_json: { type: 'Polygon', coordinates: [[[106, 10], [106.1, 10], [106.1, 10.1], [106, 10.1], [106, 10]]] },
    geometry_valid: true, covers_point: true, distance_km: 0,
  }] });
  const result = await analyzeSpatialContextWithDb(10.05, 106.05, { db });
  assert.equal(result.gisSource, 'DATABASE');
  assert.equal(result.detectedSensitiveZones[0].spatialMethod, 'POSTGIS_POLYGON');
  assert.equal(result.detectedSensitiveZones[0].inCore, true);
  const spatialSql = db.sqlSeen.find(entry => /ST_Covers/i.test(entry.sql));
  assert.match(spatialSql.sql, /ST_Distance\([^)]*geography/i);
  assert.match(spatialSql.sql, /ST_IsValid/i);
  assert.deepEqual(spatialSql.params, [10.05, 106.05]);
});

test('PostGIS query failure uses explicitly unverified fallback', async () => {
  const db = createDb({ postgisError: new Error('PostGIS extension unavailable') });
  const result = await analyzeSpatialContextWithDb(10.05, 106.05, { db });
  assert.equal(result.gisSource, 'FALLBACK_UNVERIFIED');
  assert.match(result.fallbackReason, /PostGIS extension unavailable/);
});

test('missing PostGIS keeps legacy GIS schema available without claiming spatial verification', async () => {
  const statements = [];
  const db = {
    async query(sql) {
      statements.push(sql);
      if (/SELECT EXISTS/i.test(sql)) return { rows: [{ ready: false }] };
      if (/CREATE EXTENSION/i.test(sql)) {
        const error = new Error('extension "postgis" is not available');
        error.code = '0A000';
        throw error;
      }
      return { rows: [] };
    },
  };
  const result = await ensureGisSchema(db);
  assert.deepEqual(result, { ok: false, code: 'POSTGIS_UNAVAILABLE' });
  assert.ok(statements.some(sql => /CREATE TABLE IF NOT EXISTS gis_layers/i.test(sql)));
  assert.equal(statements.some(sql => /spatial_geometry geometry/i.test(sql)), false);
});

test('invalid polygon geometry is not treated as a verified PostGIS boundary', () => {
  const result = analyzeSpatialContext(10, 106, {
    sensitiveZones: [{ id: 'invalid_zone', name: 'Invalid boundary', lat: 10, lng: 106, radiusKm: 1, flagKey: 'bao_ton' }],
    industrialParks: [],
    spatialMatches: [{
      id: 'invalid_zone', geometry_json: { type: 'Polygon', coordinates: [] },
      geometry_valid: false, covers_point: false, distance_km: 0,
    }],
    gisSource: 'DATABASE',
  });
  assert.equal(result.detectedSensitiveZones[0].spatialMethod, 'POSTGIS_CENTER_RADIUS_APPROXIMATION');
  assert.equal(result.detectedSensitiveZones[0].inCore, true);
});

const TABLES = {
  users: { table: 'nguoi_dung', columns: { id: 'ma', username: 'ten_dang_nhap', password_hash: 'mat_khau_bam', reset_token_hash: 'ma_dat_lai_mat_khau_bam', reset_token_expires: 'ma_dat_lai_het_han_luc', full_name: 'ho_ten', role: 'vai_tro', created_at: 'tao_luc' } },
  laws: { table: 'luat', optionalColumns: ['updated_at'], columns: { id: 'ma', type: 'loai', year: 'nam', sort_date: 'ngay_sap_xep', so: 'so_hieu', ten: 'ten_van_ban', hieuluc: 'hieu_luc', status: 'trang_thai', mo_ta: 'mo_ta', dieu_khoang: 'dieu_khoan', note: 'ghi_chu', link: 'lien_ket', last_crawled_mod: 'crawler_cap_nhat_luc', updated_at: 'cap_nhat_luc' } },
  rules: { table: 'quy_tac', columns: { id: 'ma', rule_name: 'ten_quy_tac', rule_type: 'loai_quy_tac', expression: 'bieu_thuc', is_active: 'dang_hoat_dong', version: 'phien_ban' } },
  projects: { table: 'du_an', columns: { id: 'ma', user_id: 'nguoi_dung_ma', name: 'ten_du_an', form_data: 'du_lieu_bieu_mau', checklist_state: 'trang_thai_danh_sach_ho_so', created_at: 'tao_luc', latitude: 'vi_do', longitude: 'kinh_do', dia_chi_hien_thi: 'dia_chi_hien_thi', quan_huyen: 'quan_huyen', phuong_xa: 'phuong_xa', classification_result: 'ket_qua_phan_loai' } },
  qcvns: { table: 'quy_chuan_qcvn', columns: { id: 'ma', ten: 'ten_quy_chuan', ap_dung: 'pham_vi_ap_dung', tham_so: 'tham_so', standard_code: 'ma_tieu_chuan', standard_version: 'phien_ban_tieu_chuan', status: 'trang_thai', source_type: 'loai_nguon', column_code: 'ma_cot', flow_range: 'khoang_luu_luong', effective_from: 'hieu_luc_tu', effective_to: 'hieu_luc_den', mandatory_for_all_from: 'bat_buoc_tu', replaces: 'thay_the', transition_rules: 'quy_tac_chuyen_tiep', verification_status: 'trang_thai_xac_minh', publication_status: 'trang_thai_cong_bo', source_document: 'tai_lieu_nguon', rule_version: 'phien_ban_quy_tac', verified_by: 'nguoi_xac_minh', verified_at: 'xac_minh_luc', published_at: 'cong_bo_luc', updated_at: 'cap_nhat_luc' } },
  qcvn_samples: { table: 'mau_quan_trac_qcvn', columns: { id: 'ma', user_id: 'nguoi_dung_ma', name: 'ten_mau', type: 'loai', sub_type: 'loai_con', values: 'gia_tri_quan_trac', created_at: 'tao_luc', project_id: 'du_an_ma', trang_thai_tong_quat: 'trang_thai_tong_quat', overall_status: 'trang_thai_danh_gia', evaluation_details: 'chi_tiet_danh_gia', evaluated_rule_version: 'phien_ban_quy_tac_da_danh_gia', evaluated_verification_status: 'trang_thai_xac_minh_da_danh_gia' } },
  industries: { table: 'nganh_nghe', columns: { code: 'ma_nganh', name: 'ten_nganh', risk_level: 'muc_do_rui_ro', created_at: 'tao_luc', display_name: 'ten_hien_thi', capacity_label: 'nhan_quy_mo', unit: 'don_vi', note: 'ghi_chu', audit_note: 'ghi_chu_ra_soat', process_stages_meta: 'mo_ta_cong_doan', verification_status: 'trang_thai_xac_minh', publication_status: 'trang_thai_cong_bo', rule_version: 'phien_ban_quy_tac', source_document: 'tai_lieu_nguon', verified_by: 'nguoi_xac_minh', verified_at: 'xac_minh_luc', updated_at: 'cap_nhat_luc', aliases: 'ten_goi_khac' } },
  legal_appendices: { table: 'phu_luc_phap_ly', columns: { id: 'ma', law_id: 'luat_ma', appendix_name: 'ten_phu_luc', item_number: 'so_muc', content_summary: 'tom_tat_noi_dung' } },
  classification_thresholds: { table: 'nguong_phan_loai', columns: { id: 'ma', industry_code: 'nganh_nghe_ma', min_value: 'gia_tri_toi_thieu', max_value: 'gia_tri_toi_da', unit: 'don_vi', project_group: 'nhom_du_an', legal_doc_required: 'ho_so_phap_ly', appendix_id: 'phu_luc_phap_ly_ma', process_stage: 'cong_doan', operator: 'toan_tu', capacity_scale: 'quy_mo_cong_suat', tq: 'tham_quyen', historical_tq: 'tham_quyen_lich_su', phu_luc: 'phu_luc', legal_ref: 'can_cu_phap_ly', law_id: 'luat_ma', effective_from: 'hieu_luc_tu', effective_to: 'hieu_luc_den', verification_status: 'trang_thai_xac_minh', publication_status: 'trang_thai_cong_bo', tier_order: 'thu_tu_nguong', rule_version: 'phien_ban_quy_tac', source_ref: 'nguon_tham_chieu', approved_by: 'nguoi_duyet', approved_at: 'duyet_luc', is_active_version: 'la_phien_ban_hieu_luc', superseded_at: 'het_hieu_luc_luc', updated_at: 'cap_nhat_luc' } },
  audit_logs: { table: 'nhat_ky_kiem_toan', columns: { id: 'ma', user_id: 'nguoi_dung_ma', action: 'hanh_dong', ip_address: 'dia_chi_ip', user_agent: 'trinh_duyet', payload: 'du_lieu', created_at: 'tao_luc' } },
  query_logs: { table: 'nhat_ky_truy_van', columns: { id: 'ma', user_id: 'nguoi_dung_ma', query_type: 'loai_truy_van', input_params: 'tham_so_dau_vao', output_result: 'ket_qua_dau_ra', queried_at: 'truy_van_luc' } },
  gis_layers: { table: 'lop_ban_do', columns: { id: 'ma', layer_type: 'loai_lop', name: 'ten_lop', category: 'danh_muc', flag_key: 'ma_co', latitude: 'vi_do', longitude: 'kinh_do', radius_km: 'ban_kinh_km', geometry_json: 'hinh_hoc', province: 'tinh', legal_ref: 'can_cu_phap_ly', verification_status: 'trang_thai_xac_minh', publication_status: 'trang_thai_cong_bo', source_document: 'tai_lieu_nguon', verified_by: 'nguoi_xac_minh', verified_at: 'xac_minh_luc', created_at: 'tao_luc', updated_at: 'cap_nhat_luc' } },
  law_rule_impacts: { table: 'anh_huong_quy_tac_van_ban', columns: { id: 'ma', law_id: 'luat_ma', law_title: 'ten_van_ban', event_action: 'hanh_dong_su_kien', target_type: 'loai_doi_tuong', target_id: 'doi_tuong_ma', target_label: 'nhan_doi_tuong', severity: 'muc_do', impact_reason: 'ly_do_anh_huong', status: 'trang_thai', resolved_by: 'nguoi_xu_ly_ma', resolved_at: 'xu_ly_luc', resolution_note: 'ghi_chu_xu_ly', created_at: 'tao_luc', updated_at: 'cap_nhat_luc' } },
  law_update_history: { table: 'lich_su_cap_nhat_van_ban', columns: { id: 'ma', law_id: 'luat_ma', action: 'hanh_dong', updated_by: 'nguoi_cap_nhat_ma', updated_at: 'cap_nhat_luc', description: 'mo_ta' } },
  project_sensitive_verifications: { table: 'xac_minh_yeu_to_nhay_cam_du_an', columns: { id: 'ma', project_id: 'du_an_ma', declared_flags: 'co_yeu_to_khai_bao', declared_details: 'chi_tiet_khai_bao', spatial_snapshot: 'du_lieu_khong_gian', evidence_ref: 'tai_lieu_chung_minh', verification_status: 'trang_thai_xac_minh', verified_by: 'nguoi_xac_minh_ma', verified_at: 'xac_minh_luc', verification_note: 'ghi_chu_xac_minh', created_at: 'tao_luc', updated_at: 'cap_nhat_luc' } },
  rule_candidates: { table: 'de_xuat_quy_tac', columns: { id: 'ma', law_id: 'luat_ma', law_title: 'ten_van_ban', target_type: 'loai_doi_tuong', target_code: 'ma_doi_tuong', title: 'tieu_de', proposed_data: 'du_lieu_de_xuat', diff_summary: 'tom_tat_thay_doi', extraction_confidence: 'do_tin_cay_trich_xuat', source_excerpt: 'trich_doan_nguon', status: 'trang_thai', reviewed_by: 'nguoi_duyet_ma', reviewed_at: 'duyet_luc', review_note: 'ghi_chu_duyet', created_at: 'tao_luc', updated_at: 'cap_nhat_luc' } },
  rule_versions: { table: 'phien_ban_quy_tac', columns: { id: 'ma', rule_id: 'quy_tac_ma', version: 'phien_ban', expression: 'bieu_thuc', changed_by: 'nguoi_thay_doi_ma', changed_at: 'thay_doi_luc', change_reason: 'ly_do_thay_doi' } },
  system_settings: { table: 'cai_dat_he_thong', columns: { key: 'khoa', value: 'gia_tri' } },
  compliance_obligations: {
    table: 'nghia_vu_tuan_thu',
    columns: {
      id: 'ma',
      project_id: 'du_an_ma',
      user_id: 'nguoi_dung_ma',
      obligation_code: 'ma_nghia_vu',
      title: 'tieu_de',
      legal_basis: 'can_cu_phap_ly',
      recurrence: 'chu_ky',
      due_date: 'han_nop',
      warning_days: 'so_ngay_nhac_truoc',
      status: 'trang_thai',
      completed_at: 'hoan_thanh_luc',
      completed_by: 'nguoi_hoan_thanh_ma',
      completion_note: 'ghi_chu_hoan_thanh',
      last_alert_level: 'muc_canh_bao_cuoi',
      last_alerted_at: 'canh_bao_luc',
      created_at: 'tao_luc',
      updated_at: 'cap_nhat_luc',
    },
  },
};

const reverse = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [value, key]));

async function relationKind(db, name) {
  const result = await db.query(
    `SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`, [name]
  );
  return result.rows[0]?.relkind || null;
}

async function migrateVietnameseSchema(db) {
  const pool = db.pool?.connect
    ? db.pool
    : (typeof db.connect === 'function' && /pool/i.test(db.constructor?.name || '') ? db : null);
  const client = pool ? await pool.connect() : db;
  const ownsClient = client !== db;
  try {
    await client.query('BEGIN');
    for (const [oldTable, spec] of Object.entries(TABLES)) {
      const oldKind = await relationKind(client, oldTable);
      const newKind = await relationKind(client, spec.table);
      const oldIsTable = oldKind === 'r' || oldKind === 'p';
      const newIsTable = newKind === 'r' || newKind === 'p';
      if (oldIsTable && newKind) throw new Error(`SCHEMA_RENAME_CONFLICT:${oldTable}:${spec.table}`);
      if (oldIsTable) await client.query(`ALTER TABLE public.${oldTable} RENAME TO ${spec.table}`);
      else if (!newIsTable) throw new Error(`SCHEMA_TABLE_MISSING:${oldTable}`);

      const existingColumns = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`, [spec.table]
      );
      const knownColumnNames = new Set([...Object.keys(spec.columns), ...Object.values(spec.columns)]);
      const unmappedColumns = existingColumns.rows.map(row => row.column_name)
        .filter(column => !knownColumnNames.has(column));
      if (unmappedColumns.length) throw new Error(`SCHEMA_COLUMNS_UNMAPPED:${spec.table}:${unmappedColumns.join(',')}`);
      const presentColumns = new Set(existingColumns.rows.map(row => row.column_name));

      for (const [oldColumn, newColumn] of Object.entries(spec.columns)) {
        if (oldColumn === newColumn) continue;
        if (!presentColumns.has(oldColumn) && !presentColumns.has(newColumn)) {
          if ((spec.optionalColumns || []).includes(oldColumn)) continue;
          throw new Error(`SCHEMA_COLUMN_MISSING:${spec.table}:${oldColumn}`);
        }
        const columns = await client.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2::text[])`,
          [spec.table, [oldColumn, newColumn]]
        );
        const present = new Set(columns.rows.map(row => row.column_name));
        if (present.has(oldColumn) && present.has(newColumn)) throw new Error(`SCHEMA_COLUMN_CONFLICT:${spec.table}:${oldColumn}:${newColumn}`);
        if (present.has(oldColumn)) await client.query(`ALTER TABLE public.${spec.table} RENAME COLUMN ${oldColumn} TO ${newColumn}`);
        else if (!present.has(newColumn)) throw new Error(`SCHEMA_COLUMN_MISSING:${spec.table}:${oldColumn}`);
      }

      const oldView = await client.query(
        `SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = $1`, [oldTable]
      );
      if (oldView.rowCount) continue;
      const currentColumns = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`, [spec.table]
      );
      const currentColumnSet = new Set(currentColumns.rows.map(row => row.column_name));
      const projection = Object.entries(spec.columns)
        .filter(([, newColumn]) => currentColumnSet.has(newColumn))
        .map(([oldColumn, newColumn]) => `t.${newColumn} AS ${oldColumn}`).join(', ');
      await client.query(`CREATE VIEW public.${oldTable} AS SELECT ${projection} FROM public.${spec.table} t`);
    }

    await client.query('COMMIT');
    return { ok: true, tablesRenamed: Object.keys(TABLES).length };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    if (ownsClient) client.release();
  }
}

module.exports = { TABLES, migrateVietnameseSchema };

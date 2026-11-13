// backend/scripts/seed-demo-projects.js
// Kịch bản khởi tạo 3 dự án thực tế và các mẫu quan trắc QCVN phục vụ thực nghiệm hệ thống.
// Tuân thủ nguyên tắc Single Database Source of Truth và Server-Authoritative Evaluation.

const { pool } = require('../config/db');
const { evaluateClassificationWithDb } = require('../services/classification-service');
const { evaluateQcvnSampleWithDb } = require('../services/qcvn-service');

async function seedDemoProjects() {
  const client = await pool.connect();
  try {
    console.log('--- BẮT ĐẦU NẠP 3 DỰ ÁN THỰC TẾ & MẪU QUAN TRẮC MÔI TRƯỜNG ---');

    // 1. Lấy danh sách tài khoản hợp lệ
    const usersRes = await client.query('SELECT id, username, role FROM users');
    const userMap = new Map();
    usersRes.rows.forEach(u => userMap.set(u.username, u.id));

    const adminId = userMap.get('admin') || usersRes.rows[0]?.id || 1;
    const staff1Id = userMap.get('staff1') || adminId;
    const staff2Id = userMap.get('staff2') || adminId;

    const DEMO_PROJECTS = [
      {
        name: 'Nhà máy Dệt nhuộm & May mặc Xuất khẩu Hoà Khánh',
        userId: adminId,
        latitude: 16.0754,
        longitude: 108.1482,
        dia_chi_hien_thi: 'Đường số 3, KCN Hoà Khánh, Phường Hoà Khánh Bắc, Quận Liên Chiểu, TP. Đà Nẵng',
        quan_huyen: 'Quận Liên Chiểu',
        phuong_xa: 'Phường Hoà Khánh Bắc',
        form_data: {
          nganh: 'det_nhuom',
          processStage: 'dyeing_washing',
          capacity: 12000000,
          nt: 1500,
          kt: 25000,
          tinh: 'Đà Nẵng',
          kcn: true,
          bg: false,
          lua: false,
          ctnh: false,
          rung: false,
          ven_bien: false,
          dtcong: false,
          phanky: false,
          morongdt: false,
          latitude: 16.0754,
          longitude: 108.1482
        },
        samples: [
          {
            name: 'Mẫu NT-01: Nước thải công nghiệp dệt nhuộm sau xử lý (Quý 3)',
            type: 'nuoc_thai_cn',
            sub_type: 'qcvn40_a_low',
            values: {
              Temp: 32,
              pH: 7.2,
              Color: 42,
              BOD5: 22,
              COD: 52,
              TSS: 36,
              NH4N: 3.5,
              TotalN: 15,
              TotalP: 3.0,
              Coliform: 2200
            },
            receivingWaterConfirmed: true,
            flowRate: 1500
          }
        ]
      },
      {
        name: 'Nhà máy Chế biến Thủy hải sản Xuất khẩu Sao Mai',
        userId: staff1Id,
        latitude: 10.0152,
        longitude: 105.1085,
        dia_chi_hien_thi: 'Khu tiểu thủ công nghiệp Vĩnh Hiệp, Phường Vĩnh Hiệp, TP. Rạch Giá, Tỉnh Kiên Giang',
        quan_huyen: 'Thành phố Rạch Giá',
        phuong_xa: 'Phường Vĩnh Hiệp',
        form_data: {
          nganh: 'thuc_pham',
          processStage: '',
          capacity: 35000,
          nt: 850,
          kt: 0,
          tinh: 'Kiên Giang',
          kcn: false,
          bg: false,
          lua: false,
          ctnh: false,
          rung: false,
          ven_bien: true,
          dtcong: false,
          phanky: false,
          morongdt: false,
          latitude: 10.0152,
          longitude: 105.1085
        },
        samples: [
          {
            name: 'Mẫu SH-01: Nước thải sinh hoạt khu nhà ăn & văn phòng công ty',
            type: 'nuoc_thai_sh',
            sub_type: 'qcvn14_b',
            values: {
              pH: 7.4,
              BOD5: 20,
              COD: 50,
              TSS: 30,
              NH4N: 4.5,
              TotalN: 18,
              TotalP: 3.5,
              Oil: 6.0,
              Coliform: 1800
            },
            receivingWaterConfirmed: true,
            createdAt: new Date(Date.now() - 7200000) // 2 giờ trước
          },
          {
            name: 'Mẫu NT-01: Nước thải chế biến thủy sản sau hệ thống sinh học',
            type: 'nuoc_thai_cn',
            sub_type: 'qcvn40_b_low',
            values: {
              Temp: 31,
              pH: 6.8,
              Color: 65,
              BOD5: 35,
              COD: 110,
              TSS: 75,
              NH4N: 15,
              TotalN: 32,
              TotalP: 4.5,
              Coliform: 3500
            },
            receivingWaterConfirmed: true,
            flowRate: 850,
            createdAt: new Date(Date.now()) // Quan trắc gần nhất -> Vượt ngưỡng
          }
        ]
      },
      {
        name: 'Nhà máy Chế biến Gỗ & Sản xuất Nội thất Tân Uyên',
        userId: staff2Id,
        latitude: 11.0825,
        longitude: 106.8123,
        dia_chi_hien_thi: 'Đường ĐT 747, Phường Uyên Hưng, TP. Tân Uyên, Tỉnh Bình Dương',
        quan_huyen: 'Thành phố Tân Uyên',
        phuong_xa: 'Phường Uyên Hưng',
        form_data: {
          nganh: 'che_bien_go',
          processStage: '',
          capacity: 25000,
          nt: 30,
          kt: 60000,
          tinh: 'Bình Dương',
          kcn: false,
          bg: false,
          lua: false,
          ctnh: false,
          rung: false,
          ven_bien: false,
          dtcong: false,
          phanky: false,
          morongdt: false,
          latitude: 11.0825,
          longitude: 106.8123
        },
        samples: [
          {
            name: 'Mẫu KT-01: Khí thải buồng phun sơn sấy nội thất chuyền số 1',
            type: 'khi_thai_cn',
            sub_type: 'qcvn19_2024_b',
            values: {
              Dust: 75,
              SO2: 180,
              NOx: 280,
              CO: 220
            },
            receivingWaterConfirmed: true
          }
        ]
      }
    ];

    for (const pDef of DEMO_PROJECTS) {
      console.log(`\n▶ Xử lý dự án: "${pDef.name}"...`);

      // 1. Phân loại chuẩn xác trên Server từ PostgreSQL
      const dbWrapper = { query: (t, p) => client.query(t, p) };
      const classificationResult = await evaluateClassificationWithDb(pDef.form_data, { db: dbWrapper });

      console.log(`   - Nhóm: ${classificationResult.projectGroup || classificationResult.nhom}`);
      console.log(`   - Thủ tục: ${classificationResult.hs || 'N/A'}`);
      console.log(`   - Thẩm quyền: ${classificationResult.competentAuthority?.competentAgency || classificationResult.coQuan}`);

      // 2. Chèn hoặc cập nhật dự án (Idempotent)
      let projectId = null;
      const existRes = await client.query('SELECT id FROM projects WHERE name = $1', [pDef.name]);
      if (existRes.rows.length > 0) {
        projectId = existRes.rows[0].id;
        await client.query(
          `UPDATE projects 
           SET user_id = $1, form_data = $2, latitude = $3, longitude = $4,
               dia_chi_hien_thi = $5, quan_huyen = $6, phuong_xa = $7, classification_result = $8
           WHERE id = $9`,
          [
            pDef.userId,
            JSON.stringify(pDef.form_data),
            pDef.latitude,
            pDef.longitude,
            pDef.dia_chi_hien_thi,
            pDef.quan_huyen,
            pDef.phuong_xa,
            JSON.stringify(classificationResult),
            projectId
          ]
        );
        console.log(`   ✔ Đã cập nhật dự án (ID: ${projectId})`);
      } else {
        const insertRes = await client.query(
          `INSERT INTO projects (user_id, name, form_data, checklist_state, latitude, longitude, dia_chi_hien_thi, quan_huyen, phuong_xa, classification_result)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            pDef.userId,
            pDef.name,
            JSON.stringify(pDef.form_data),
            JSON.stringify({}),
            pDef.latitude,
            pDef.longitude,
            pDef.dia_chi_hien_thi,
            pDef.quan_huyen,
            pDef.phuong_xa,
            JSON.stringify(classificationResult)
          ]
        );
        projectId = insertRes.rows[0].id;
        console.log(`   ✔ Đã tạo mới dự án (ID: ${projectId})`);
      }

      // 3. Xử lý các mẫu quan trắc liên kết với dự án
      for (const sDef of pDef.samples) {
        console.log(`   - Đang đánh giá & nạp mẫu: "${sDef.name}"...`);

        // Đánh giá QCVN chuẩn xác qua server evaluator
        const evalRes = await evaluateQcvnSampleWithDb({
          qcvnId: sDef.sub_type,
          measuredValues: sDef.values,
          receivingWaterConfirmed: sDef.receivingWaterConfirmed,
          flowRate: sDef.flowRate
        }, { db: dbWrapper });

        let computedDbStatus = 'can_ra_soat';
        if (evalRes.preliminaryStatus === 'FAIL' || evalRes.overallStatus === 'FAIL') {
          computedDbStatus = 'vuot_nguong';
        } else if (evalRes.preliminaryStatus === 'PASS_WITH_WARNING') {
          computedDbStatus = 'canh_bao';
        } else if (evalRes.preliminaryStatus === 'PASS') {
          computedDbStatus = 'dat';
        } else if (evalRes.preliminaryStatus === 'INCOMPLETE') {
          computedDbStatus = 'chua_du_thong_so';
        }

        const overallStatusToStore = (evalRes.preliminaryStatus === 'FAIL')
          ? 'FAIL'
          : (evalRes.preliminaryStatus === 'PASS_WITH_WARNING'
              ? 'PASS_WITH_WARNING'
              : (evalRes.preliminaryStatus === 'PASS'
                  ? 'PASS'
                  : evalRes.overallStatus));

        const evaluationDetails = {
          overallStatus: overallStatusToStore,
          preliminaryStatus: evalRes.preliminaryStatus,
          conclusionStatus: evalRes.conclusionStatus,
          reason: evalRes.reason,
          ruleSource: evalRes.ruleSource,
          ruleVersion: evalRes.ruleVersion,
          evaluations: evalRes.evaluations || [],
          summary: evalRes.summary || {},
          unverifiedReasons: evalRes.unverifiedReasons || []
        };

        const sampleCreatedAt = sDef.createdAt || new Date();

        // Kiểm tra xem mẫu đã tồn tại chưa
        const sampleExistRes = await client.query('SELECT id FROM qcvn_samples WHERE name = $1 AND project_id = $2', [sDef.name, projectId]);
        if (sampleExistRes.rows.length > 0) {
          const sampleId = sampleExistRes.rows[0].id;
          await client.query(
            `UPDATE qcvn_samples
             SET type = $1, sub_type = $2, values = $3, trang_thai_tong_quat = $4,
                 overall_status = $5, evaluation_details = $6, evaluated_rule_version = $7, evaluated_verification_status = $8,
                 created_at = $9
             WHERE id = $10`,
            [
              sDef.type,
              sDef.sub_type,
              JSON.stringify(sDef.values),
              computedDbStatus,
              overallStatusToStore,
              JSON.stringify(evaluationDetails),
              evalRes.ruleVersion || null,
              evalRes.verificationStatus || 'NEEDS_LEGAL_VERIFICATION',
              sampleCreatedAt,
              sampleId
            ]
          );
          console.log(`     ✔ Cập nhật mẫu (ID: ${sampleId}) — Trạng thái: ${overallStatusToStore} (${computedDbStatus})`);
        } else {
          const sampleInsertRes = await client.query(
            `INSERT INTO qcvn_samples (user_id, name, type, sub_type, values, project_id, trang_thai_tong_quat, overall_status, evaluation_details, evaluated_rule_version, evaluated_verification_status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [
              pDef.userId,
              sDef.name,
              sDef.type,
              sDef.sub_type,
              JSON.stringify(sDef.values),
              projectId,
              computedDbStatus,
              overallStatusToStore,
              JSON.stringify(evaluationDetails),
              evalRes.ruleVersion || null,
              evalRes.verificationStatus || 'NEEDS_LEGAL_VERIFICATION',
              sampleCreatedAt
            ]
          );
          console.log(`     ✔ Tạo mới mẫu (ID: ${sampleInsertRes.rows[0].id}) — Trạng thái: ${overallStatusToStore} (${computedDbStatus})`);
        }
      }
    }

    console.log('\n--- HOÀN TẤT NẠP 3 DỰ ÁN THỰC TẾ & MẪU QUAN TRẮC MÔI TRƯỜNG THÀNH CÔNG ---');
  } catch (error) {
    console.error('Lỗi khi nạp demo projects:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoProjects();

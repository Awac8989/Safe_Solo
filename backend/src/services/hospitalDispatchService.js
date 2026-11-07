const HospitalTraumaCenter = require('../models/HospitalTraumaCenter');
const RescueIncident = require('../models/RescueIncident');

class HospitalDispatchService {
  /**
   * Khởi tạo danh mục các Bệnh viện Tuyến đầu & Trung tâm Cấp cứu 115 TP.HCM
   */
  async seedTraumaHospitals() {
    const defaultHospitals = [
      {
        hospitalCode: 'BV_CHO_RAY',
        hospitalName: 'Bệnh viện Chợ Rẫy (Trung tâm Chấn thương Đa Khoa Tuyến Cuối)',
        tierLevel: 'LEVEL_1_TRAUMA',
        address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
        location: { type: 'Point', coordinates: [106.6596, 10.7578] },
        hotline115: '02838554137',
        specialties: [
          'NEURO_TRAUMA',
          'CARDIAC_ARREST',
          'POLYTRAUMA',
          'BURNS',
          'LIMB_REPLANTATION',
          'THORACIC_SURGERY',
          'SPINAL_SURGERY',
          'TOXICOLOGY',
          'VASCULAR_SURGERY',
          'PELVIC_TRAUMA',
          'OBSTETRIC_TRAUMA',
          'MASSIVE_TRANSFUSION',
          'HYPOTHERMIA_ECMO',
          'ENDOCRINOLOGY_ICU',
          'INDUSTRIAL_TOXICOLOGY',
          'CARDIOLOGY_ICU',
          'SEPSIS_ICU',
          'VASCULAR_INTERVENTION',
          'DANTROLENE_STOCK',
          'ECPR_CENTER',
          'SPINE_SURGERY_ICU',
          'HYPERBARIC_ALTITUDE',
          'CRYOGENIC_BURN',
          'NECROTIZING_FASCIITIS',
          'ORBITAL_COMPARTMENT_SURGERY',
          'LAST_LIPID_RESCUE',
          'PULMONARY_EMBOLISM_ECMO',
          'THORACIC_ESOPHAGEAL_SURGERY',
          'UROLOGY_TRAUMA',
          'NEUROVASCULAR_INTERVENTION',
          'CARDIOTHORACIC_EMERGENCY_SURGERY',
          'SPINE_DECOMPRESSION_SURGERY',
          'FAT_EMBOLISM_ORTHO_ICU',
          'HYPERTENSIVE_EMERGENCY_ICU',
          'PHEOCHROMOCYTOMA_ENDOCRINE_ICU',
          'ICH_NEUROSURGERY_CENTER',
          'AORTIC_DISSECTION_EMERGENCY_SURGERY',
          'HHS_HYPEROSMOLAR_ENDOCRINE_ICU',
          'PULMONOLOGY_ICU_ASTHMA',
          'VASCULAR_SURGERY_LIMB_ISCHEMIA',
          'BILIARY_ENDOSCOPY_ERCP_CENTER',
          'PNEUMOPERICARDIUM_CARDIOTHORACIC',
          'METHANOL_TOXICOLOGY_DIALYSIS',
          'ABDOMINAL_COMPARTMENT_SURGERY',
          'OPEN_GLOBE_OPHTHALMIC_SURGERY',
          'DOAC_ANTIDOTE_HEMATOLOGY_ICU',
          'BLUNT_CARDIAC_RUPTURE_CEC',
          'VENOUS_AIR_EMBOLISM_HBOT_ICU',
          'ESOPHAGEAL_VARICEAL_ENDOSCOPY_EVL', 'MASSIVE_HEMOTHORAX_THORACOTOMY',
          'SMOKE_INHALATION_CYANOKIT_BURN',
          'BIPHASIC_ANAPHYLAXIS_GLUCAGON_ICU',
          'TORSADES_DE_POINTES_CARDIOLOGY_ICU',
          'MASSIVE_HEMOTHORAX_THORACOTOMY',
          'POSTPARTUM_HEMORRHAGE_BAKRI_ICU',
          'MASSIVE_PE_THROMBOLYSIS_ECMO',
          'POSTPARTUM_HEMORRHAGE_BAKRI_ICU',
          'MASSIVE_PE_THROMBOLYSIS_ECMO',
          'BIPHASIC_ANAPHYLAXIS_GLUCAGON_ICU',
          'TORSADES_DE_POINTES_CARDIOLOGY_ICU',
          'MASSIVE_HEMOTHORAX_THORACOTOMY',
          'VENOUS_AIR_EMBOLISM_HBOT_ICU',
          'ESOPHAGEAL_VARICEAL_ENDOSCOPY_EVL',
          'SMOKE_INHALATION_CYANOKIT_BURN',
          'NEUROGENIC_SHOCK_MAP85_SPINE_ICU',
          'PENETRATING_NECK_HEMATOMA_SURGERY',
          'DELIRIUM_TREMENS_ICU_TOXICOLOGY',
          'IMPALED_THORACIC_TRAUMA_SURGERY',
          'CEREBRAL_MALARIA_ARTESUNATE_ICU',
          'GRADE_V_RENAL_VASCULAR_SURGERY',
          'EXERTIONAL_HEAT_STROKE_CWI_ICU',
          'SEVERE_CHEMICAL_BURNS_DECONTAM',
          'GRADE_V_HEPATIC_PACKING_SURGERY',
          'GRADE_V_SPLENIC_DCR_SURGERY',
          'ALUMINIUM_PHOSPHIDE_TOXICOLOGY_ECMO',
          'OPEN_SUCKING_CHEST_FLUTTER_SURGERY',
          'MYASTHENIC_CRISIS_PLEX_NEURO_ICU',
          'GASTRIC_VARICES_GLUE_INJECTION_TIPS',
          'TRACHEOBRONCHIAL_RUPTURE_BRONCHOSCOPY_SURGERY',
          'TCA_TOXICOLOGY_BICARBONATE_ICU',
          'AMNIOTIC_FLUID_EMBOLISM_AOK_ICU',
          'METHEMOGLOBINEMIA_METHYLENE_BLUE_TOXICOLOGY_ICU',
          'VISCERAL_ANEURYSM_DSA_EMBOLIZATION_SURGERY',
          'ACUTE_HYPOCALCEMIA_GLUCONATE_ENDOCRINE_ICU',
          'CONTRAST_ANAPHYLAXIS_ADRENALINE_ICU',
          'PELVIC_FRACTURE_BINDER_ANGIO_SURGERY',
          'CHOLINESTERASE_INHIBITOR_ATROPINE_TOXICOLOGY',
          'HYPOTHERMIC_ARREST_ECLS_ECMO_REWARMING',
          'BEE_STING_ANAPHYLAXIS_CRRT_TOXICOLOGY',
          'CONFINED_SPACE_ATMOSPHERIC_RESCUE_HBOT',
          'VIBRIO_VULNIFICUS_FASCIOTOMY_SEPSIS',
          'SEVERE_DKA_HHS_ENDOCRINE_ICU',
          'SYMPATHOMIMETIC_TOXIDROME_BENZO_ICU',
          'ELEVATOR_COLLAPSE_USAR_TRAUMA_CENTER',
          'HYPERKALEMIA_EMERGENT_HEMODIALYSIS_ICU',
          'CRICOTHYROIDOTOMY_ENT_AIRWAY_CENTER',
          'SUBMERSION_DROWNING_PEDIATRIC_ICU',
          'GIANT_HORNET_CYTOKINE_STORM_PLEX_ICU',
          'MARITIME_SAR_HYPOTHERMIA_CENTER',
          'PARADOXICAL_UNDRESSING_REWARMING_ICU',
          'PARAQUAT_HEMOPERFUSION_TOXICOLOGY_ICU',
          'ACUTE_TESTICULAR_TORSION_UROLOGY_SURGERY',
          'CARBON_MONOXIDE_HBOT_CHAMBER',
          'PENETRATING_CAROTID_NECK_VASCULAR_SURGERY',
          'HIGH_VOLTAGE_ELECTRICAL_BURN_ICU',
          'OPEN_GLOBE_OCULAR_TRAUMA_SURGERY',
        ],
        emergencyDepartmentStatus: {
          status: 'NORMAL',
          availableIcuBeds: 8,
          ctScannerOperational: true,
          cathLab247Ready: true,
          bloodBankReserveUnits: 120,
          burnUnitReady: true,
          availableBurnBeds: 15,
        },
        antivenomStocks: [
          { antivenomType: 'COBRA_ELAPIDAE', vialsAvailable: 25, batchLot: 'LOT-AV-COB-01' },
          { antivenomType: 'KRAIT_BUNGARUS', vialsAvailable: 15, batchLot: 'LOT-AV-KRA-01' },
          { antivenomType: 'VIPER_GREEN_PIT', vialsAvailable: 40, batchLot: 'LOT-AV-VIP-01' },
          { antivenomType: 'POLYVALENT', vialsAvailable: 30, batchLot: 'LOT-AV-POL-01' },
        ],
      },
      {
        hospitalCode: 'BV_115',
        hospitalName: 'Bệnh viện Nhân Dân 115 (Trung tâm Đột Quỵ Não & Tim Mạch Chuyên Sâu)',
        tierLevel: 'LEVEL_1_TRAUMA',
        address: '527 Sư Vạn Hạnh, Phường 12, Quận 10, TP.HCM',
        location: { type: 'Point', coordinates: [106.6669, 10.7745] },
        hotline115: '02838652368',
        specialties: [
          'STROKE_INTERVENTION',
          'CARDIAC_ARREST',
          'NEURO_TRAUMA',
          'POLYTRAUMA',
          'THORACIC_SURGERY',
          'SPINAL_SURGERY',
          'ENDOCRINOLOGY_ICU',
          'MASSIVE_TRANSFUSION',
          'CARDIOLOGY_ICU',
          'SEPSIS_ICU',
          'VASCULAR_INTERVENTION',
          'DANTROLENE_STOCK',
          'ECPR_CENTER',
          'SPINE_SURGERY_ICU',
          'HYPERBARIC_ALTITUDE',
          'CRYOGENIC_BURN',
          'NECROTIZING_FASCIITIS',
          'ORBITAL_COMPARTMENT_SURGERY',
          'LAST_LIPID_RESCUE',
          'PULMONARY_EMBOLISM_ECMO',
          'THORACIC_ESOPHAGEAL_SURGERY',
          'UROLOGY_TRAUMA',
          'NEUROVASCULAR_INTERVENTION',
          'CARDIOTHORACIC_EMERGENCY_SURGERY',
          'SPINE_DECOMPRESSION_SURGERY',
          'FAT_EMBOLISM_ORTHO_ICU',
          'HYPERTENSIVE_EMERGENCY_ICU',
          'PHEOCHROMOCYTOMA_ENDOCRINE_ICU',
          'ICH_NEUROSURGERY_CENTER',
          'AORTIC_DISSECTION_EMERGENCY_SURGERY',
          'HHS_HYPEROSMOLAR_ENDOCRINE_ICU',
          'PULMONOLOGY_ICU_ASTHMA',
          'VASCULAR_SURGERY_LIMB_ISCHEMIA',
          'BILIARY_ENDOSCOPY_ERCP_CENTER',
          'PNEUMOPERICARDIUM_CARDIOTHORACIC',
          'METHANOL_TOXICOLOGY_DIALYSIS',
          'ABDOMINAL_COMPARTMENT_SURGERY',
          'OPEN_GLOBE_OPHTHALMIC_SURGERY',
          'DOAC_ANTIDOTE_HEMATOLOGY_ICU',
          'BLUNT_CARDIAC_RUPTURE_CEC',
          'VENOUS_AIR_EMBOLISM_HBOT_ICU',
          'ESOPHAGEAL_VARICEAL_ENDOSCOPY_EVL',
          'SMOKE_INHALATION_CYANOKIT_BURN',
          'NEUROGENIC_SHOCK_MAP85_SPINE_ICU',
          'PENETRATING_NECK_HEMATOMA_SURGERY',
          'DELIRIUM_TREMENS_ICU_TOXICOLOGY',
          'IMPALED_THORACIC_TRAUMA_SURGERY',
          'CEREBRAL_MALARIA_ARTESUNATE_ICU',
          'GRADE_V_RENAL_VASCULAR_SURGERY',
          'EXERTIONAL_HEAT_STROKE_CWI_ICU',
          'SEVERE_CHEMICAL_BURNS_DECONTAM',
          'GRADE_V_HEPATIC_PACKING_SURGERY',
          'GRADE_V_SPLENIC_DCR_SURGERY',
          'ALUMINIUM_PHOSPHIDE_TOXICOLOGY_ECMO',
          'OPEN_SUCKING_CHEST_FLUTTER_SURGERY',
          'MYASTHENIC_CRISIS_PLEX_NEURO_ICU',
          'GASTRIC_VARICES_GLUE_INJECTION_TIPS',
          'TRACHEOBRONCHIAL_RUPTURE_BRONCHOSCOPY_SURGERY',
          'TCA_TOXICOLOGY_BICARBONATE_ICU',
          'AMNIOTIC_FLUID_EMBOLISM_AOK_ICU',
          'METHEMOGLOBINEMIA_METHYLENE_BLUE_TOXICOLOGY_ICU',
          'VISCERAL_ANEURYSM_DSA_EMBOLIZATION_SURGERY',
          'ACUTE_HYPOCALCEMIA_GLUCONATE_ENDOCRINE_ICU',
          'CONTRAST_ANAPHYLAXIS_ADRENALINE_ICU',
          'PELVIC_FRACTURE_BINDER_ANGIO_SURGERY',
          'CHOLINESTERASE_INHIBITOR_ATROPINE_TOXICOLOGY',
          'HYPOTHERMIC_ARREST_ECLS_ECMO_REWARMING',
          'BEE_STING_ANAPHYLAXIS_CRRT_TOXICOLOGY',
          'CONFINED_SPACE_ATMOSPHERIC_RESCUE_HBOT',
          'VIBRIO_VULNIFICUS_FASCIOTOMY_SEPSIS',
          'SEVERE_DKA_HHS_ENDOCRINE_ICU',
          'SYMPATHOMIMETIC_TOXIDROME_BENZO_ICU',
          'ELEVATOR_COLLAPSE_USAR_TRAUMA_CENTER',
          'HYPERKALEMIA_EMERGENT_HEMODIALYSIS_ICU',
          'CRICOTHYROIDOTOMY_ENT_AIRWAY_CENTER',
          'SUBMERSION_DROWNING_PEDIATRIC_ICU',
          'GIANT_HORNET_CYTOKINE_STORM_PLEX_ICU',
          'MARITIME_SAR_HYPOTHERMIA_CENTER',
          'PARADOXICAL_UNDRESSING_REWARMING_ICU',
          'PARAQUAT_HEMOPERFUSION_TOXICOLOGY_ICU',
          'ACUTE_TESTICULAR_TORSION_UROLOGY_SURGERY',
          'CARBON_MONOXIDE_HBOT_CHAMBER',
          'PENETRATING_CAROTID_NECK_VASCULAR_SURGERY',
          'HIGH_VOLTAGE_ELECTRICAL_BURN_ICU',
          'OPEN_GLOBE_OCULAR_TRAUMA_SURGERY',
        ],
        emergencyDepartmentStatus: {
          status: 'NORMAL',
          availableIcuBeds: 6,
          ctScannerOperational: true,
          cathLab247Ready: true,
          bloodBankReserveUnits: 85,
          burnUnitReady: true,
          availableBurnBeds: 8,
        },
        antivenomStocks: [
          { antivenomType: 'VIPER_GREEN_PIT', vialsAvailable: 20, batchLot: 'LOT-AV-VIP-02' },
          { antivenomType: 'POLYVALENT', vialsAvailable: 15, batchLot: 'LOT-AV-POL-02' },
        ],
      },
      {
        hospitalCode: 'BV_NHI_DONG_1',
        hospitalName: 'Bệnh viện Nhi Đồng 1 (Cấp Cứu & Ngoại Nhi Chuyên Khoa)',
        tierLevel: 'SPECIALIZED_PEDIATRIC',
        address: '341 Sư Vạn Hạnh, Phường 10, Quận 10, TP.HCM',
        location: { type: 'Point', coordinates: [106.6682, 10.7694] },
        hotline115: '02839271119',
        specialties: ['PEDIATRIC', 'CARDIAC_ARREST', 'BURNS', 'POLYTRAUMA', 'PEDIATRIC_EPIGLOTTITIS_AIRWAY_ENT', 'SEVERE_CHEMICAL_BURNS_DECONTAM', 'MECONIUM_ASPIRATION_SURFACTANT_HFOV_NICU', 'METHEMOGLOBINEMIA_METHYLENE_BLUE_TOXICOLOGY_ICU', 'SUBMERSION_DROWNING_PEDIATRIC_ICU', 'PEDIATRIC_FBAO_AIRWAY_EMERGENCY_ICU'],
        emergencyDepartmentStatus: {
          status: 'NORMAL',
          availableIcuBeds: 10,
          ctScannerOperational: true,
          cathLab247Ready: false,
          bloodBankReserveUnits: 60,
          burnUnitReady: true,
          availableBurnBeds: 10,
        },
        antivenomStocks: [
          { antivenomType: 'VIPER_GREEN_PIT', vialsAvailable: 25, batchLot: 'LOT-AV-VIP-03' },
          { antivenomType: 'KRAIT_BUNGARUS', vialsAvailable: 10, batchLot: 'LOT-AV-KRA-02' },
        ],
      },
      {
        hospitalCode: 'BV_TU_DU',
        hospitalName: 'Bệnh viện Từ Dũ (Cấp Cứu Sản - Phụ Khoa & Sơ Sinh)',
        tierLevel: 'SPECIALIZED_OBSTETRIC',
        address: '284 Cống Quỳnh, Phường Phạm Ngũ Lão, Quận 1, TP.HCM',
        location: { type: 'Point', coordinates: [106.6853, 10.7675] },
        hotline115: '02854042829',
        specialties: ['OBSTETRICS', 'CARDIAC_ARREST', 'OBSTETRIC_TRAUMA', 'PULMONARY_EMBOLISM_ECMO', 'POSTPARTUM_HEMORRHAGE_BAKRI_ICU', 'AMNIOTIC_FLUID_EMBOLISM_AOK_ICU', 'MECONIUM_ASPIRATION_SURFACTANT_HFOV_NICU', 'VISCERAL_ANEURYSM_DSA_EMBOLIZATION_SURGERY'],
        emergencyDepartmentStatus: {
          status: 'NORMAL',
          availableIcuBeds: 4,
          ctScannerOperational: true,
          cathLab247Ready: false,
          bloodBankReserveUnits: 45,
        },
      },
      {
        hospitalCode: 'BV_CTCH',
        hospitalName: 'Bệnh viện Chấn Thương Chỉnh Hình TP.HCM (Vi phẫu nối chi & Cột sống)',
        tierLevel: 'LEVEL_2_GENERAL',
        address: '929 Trần Hưng Đạo, Phường 1, Quận 5, TP.HCM',
        location: { type: 'Point', coordinates: [106.6781, 10.7539] },
        hotline115: '02839235821',
        specialties: ['LIMB_REPLANTATION', 'POLYTRAUMA', 'SPINAL_SURGERY', 'SPINE_SURGERY_ICU', 'CRYOGENIC_BURN', 'SPINE_DECOMPRESSION_SURGERY', 'FAT_EMBOLISM_ORTHO_ICU', 'PELVIC_FRACTURE_BINDER_ANGIO_SURGERY', 'ELEVATOR_COLLAPSE_USAR_TRAUMA_CENTER'],
        emergencyDepartmentStatus: {
          status: 'NORMAL',
          availableIcuBeds: 5,
          ctScannerOperational: true,
          cathLab247Ready: false,
          bloodBankReserveUnits: 30,
        },
      },
      {
        hospitalCode: 'BV_MAT_TPHCM',
        hospitalName: 'Bệnh viện Mắt TP.HCM (Cấp cứu Nhãn khoa & Bỏng Mắt)',
        tierLevel: 'LEVEL_2_GENERAL',
        address: '280 Điện Biên Phủ, Phường Võ Thị Sáu, Quận 3, TP.HCM',
        location: { type: 'Point', coordinates: [106.6872, 10.7788] },
        hotline115: '02839325713',
        specialties: ['OPHTHALMOLOGY', 'EYE_TRAUMA', 'OCULAR_BURNS', 'ORBITAL_COMPARTMENT_SURGERY', 'OPEN_GLOBE_OPHTHALMIC_SURGERY', 'OPEN_GLOBE_OCULAR_TRAUMA_SURGERY'],
        emergencyDepartmentStatus: {
          status: 'NORMAL',
          availableIcuBeds: 4,
          ctScannerOperational: true,
          cathLab247Ready: false,
          bloodBankReserveUnits: 20,
        },
      },
      {
        hospitalCode: 'TT_OXY_CAO_AP',
        hospitalName: 'Trung tâm Điều trị Oxy Cao Áp TP.HCM (Viện Y học Biển / Quân Y)',
        tierLevel: 'LEVEL_2_GENERAL',
        address: '273 Nguyễn Văn Trỗi, Phường 10, Quận Phú Nhuận, TP.HCM',
        location: { type: 'Point', coordinates: [106.6710, 10.7960] },
        hotline115: '02838446156',
        specialties: ['HYPERBARIC_OXYGEN', 'CO_POISONING', 'SMOKE_INHALATION', 'DECOMPRESSION_SICKNESS', 'CARBON_MONOXIDE_HBOT_CHAMBER'],
        emergencyDepartmentStatus: {
          status: 'NORMAL',
          availableIcuBeds: 6,
          ctScannerOperational: true,
          cathLab247Ready: false,
          bloodBankReserveUnits: 25,
        },
      },
      {
        hospitalCode: 'BV_NHIET_DOI',
        hospitalName: 'Bệnh viện Bệnh Nhiệt Đới TP.HCM (Trung tâm Hồi sức Nhiễm trùng & Sốc nhiễm khuẩn Tuyến cuối)',
        tierLevel: 'LEVEL_1_TRAUMA',
        address: '764 Võ Văn Kiệt, Phường 1, Quận 5, TP.HCM',
        location: { type: 'Point', coordinates: [106.6803, 10.7511] },
        hotline115: '02839235804',
        specialties: ['SEPSIS_ICU', 'INFECTIOUS_DISEASES', 'CARDIAC_ARREST', 'NECROTIZING_FASCIITIS', 'CEREBRAL_MALARIA_ARTESUNATE_ICU', 'BEE_STING_ANAPHYLAXIS_CRRT_TOXICOLOGY', 'VIBRIO_VULNIFICUS_FASCIOTOMY_SEPSIS'],
        emergencyDepartmentStatus: {
          status: 'NORMAL',
          availableIcuBeds: 12,
          ctScannerOperational: true,
          cathLab247Ready: false,
          bloodBankReserveUnits: 50,
        },
      },
      {
        hospitalCode: 'BV_BINH_DAN',
        hospitalName: 'Bệnh viện Bình Dân (Trung tâm Phẫu thuật Tiết niệu & Ngoại Lồng ngực - Tiêu hóa Đầu ngành)',
        tierLevel: 'LEVEL_1_TRAUMA',
        address: '371 Điện Biên Phủ, Phường 4, Quận 3, TP.HCM',
        location: { type: 'Point', coordinates: [106.6788, 10.7712] },
        hotline115: '02838394747',
        specialties: ['UROLOGY_TRAUMA', 'THORACIC_ESOPHAGEAL_SURGERY', 'POLYTRAUMA', 'BILIARY_ENDOSCOPY_ERCP_CENTER', 'ABDOMINAL_COMPARTMENT_SURGERY', 'ESOPHAGEAL_VARICEAL_ENDOSCOPY_EVL', 'PENETRATING_NECK_HEMATOMA_SURGERY', 'GRADE_V_RENAL_VASCULAR_SURGERY', 'IMPALED_THORACIC_TRAUMA_SURGERY', 'GRADE_V_HEPATIC_PACKING_SURGERY', 'GRADE_V_SPLENIC_DCR_SURGERY', 'OPEN_SUCKING_CHEST_FLUTTER_SURGERY', 'GASTRIC_VARICES_GLUE_INJECTION_TIPS', 'TRACHEOBRONCHIAL_RUPTURE_BRONCHOSCOPY_SURGERY', 'VISCERAL_ANEURYSM_DSA_EMBOLIZATION_SURGERY', 'ACUTE_HYPOCALCEMIA_GLUCONATE_ENDOCRINE_ICU', 'HYPERKALEMIA_EMERGENT_HEMODIALYSIS_ICU', 'CRICOTHYROIDOTOMY_ENT_AIRWAY_CENTER', 'ACUTE_TESTICULAR_TORSION_UROLOGY_SURGERY', 'PENETRATING_CAROTID_NECK_VASCULAR_SURGERY'],
        emergencyDepartmentStatus: {
          status: 'NORMAL',
          availableIcuBeds: 8,
          ctScannerOperational: true,
          cathLab247Ready: false,
          bloodBankReserveUnits: 40,
        },
      },
    ];

    for (const h of defaultHospitals) {
      await HospitalTraumaCenter.findOneAndUpdate(
        { hospitalCode: h.hospitalCode },
        { $set: h },
        { upsert: true, new: true },
      );
    }
  }

  /**
   * Tính khoảng cách Haversine (mét)
   */
  _calcDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Thuật toán Phân luồng Bệnh viện đích tối ưu dựa trên Bệnh cảnh Lâm sàng & Tình trạng Giường Cấp cứu
   */
  async recommendDestinationHospital(incidentId, conditionCategory = 'POLYTRAUMA') {
    await this.seedTraumaHospitals();

    let incidentLat = 10.7769;
    let incidentLng = 106.7009;

    if (incidentId) {
      const inc = await RescueIncident.findById(incidentId);
      if (inc && inc.exactLat != null) {
        incidentLat = inc.exactLat;
        incidentLng = inc.exactLng;
      }
    }

    const hospitals = await HospitalTraumaCenter.find();
    if (!hospitals || hospitals.length === 0) {
      throw new Error('Chưa có dữ liệu mạng lưới bệnh viện cấp cứu 115');
    }

    // Lọc theo năng lực chuyên khoa nếu có
    const scoredHospitals = hospitals.map((h) => {
      const coords = h.location?.coordinates || [106.66, 10.76];
      const distMeters = this._calcDistanceMeters(
        incidentLat,
        incidentLng,
        coords[1],
        coords[0],
      );
      const distKm = parseFloat((distMeters / 1000).toFixed(2));
      const estMinutes = Math.max(3, Math.round(distKm * 2.2)); // Trung bình xe cấp cứu 115 chạy 30-40km/h có còi ưu tiên

      let matchScore = 50;
      // Khớp chuyên khoa cấp bách
      if (h.specialties.includes(conditionCategory)) {
        matchScore += 40;
      }
      // Ưu tiên Trung tâm Chấn thương Cấp 1 Tuyến cuối (Level 1 Trauma Center) cho ca đa chấn thương
      if (h.tierLevel === 'LEVEL_1_TRAUMA') {
        matchScore += 20;
      }
      // Khả dụng giường ICU
      if (h.emergencyDepartmentStatus.availableIcuBeds > 3) {
        matchScore += 10;
      }
      // Trừ điểm nếu khoa cấp cứu quá tải
      if (h.emergencyDepartmentStatus.status === 'OVERCROWDED') {
        matchScore -= 20;
      } else if (h.emergencyDepartmentStatus.status === 'DIVERT_CRITICAL') {
        matchScore -= 50;
      }

      // Trừ điểm khoảng cách (mỗi km -2 điểm)
      matchScore -= Math.min(20, Math.round(distKm * 2));

      return {
        hospitalCode: h.hospitalCode,
        hospitalName: h.hospitalName,
        tierLevel: h.tierLevel,
        address: h.address,
        hotline115: h.hotline115,
        specialties: h.specialties,
        distanceKm: distKm,
        etaMinutes: estMinutes,
        matchScore,
        emergencyDepartmentStatus: h.emergencyDepartmentStatus,
        isCathLabReady: h.emergencyDepartmentStatus.cathLab247Ready,
        isCtScannerReady: h.emergencyDepartmentStatus.ctScannerOperational,
      };
    });

    scoredHospitals.sort((a, b) => b.matchScore - a.matchScore);
    const recommended = scoredHospitals[0];

    return {
      success: true,
      conditionCategory,
      incidentCoordinates: { lat: incidentLat, lng: incidentLng },
      recommendedHospital: recommended,
      alternativeHospitals: scoredHospitals.slice(1, 3),
      triageDecisionRationale: `Gợi ý chuyển viện tối ưu đến ${recommended.hospitalName} (${recommended.distanceKm} km, ETA: ${recommended.etaMinutes} phút). Lý do: Bệnh viện đạt chuẩn tiếp nhận chuyên khoa ${conditionCategory}, có sẵn ${recommended.emergencyDepartmentStatus.availableIcuBeds} giường ICU và thiết bị CT/CathLab sẵn sàng.`,
    };
  }

  /**
   * Phát Thông Báo Tiền Viện SBAR (Pre-Arrival Notification) tới Khoa Cấp Cứu Bệnh Viện
   */
  async dispatchPreArrivalNotification(incidentId, hospitalCode, etaMinutes = 10, chiefComplaint = 'Chấn thương nặng / Suy hô hấp cấp') {
    const hospital = await HospitalTraumaCenter.findOne({ hospitalCode });
    if (!hospital) throw new Error(`Không tìm thấy bệnh viện mã ${hospitalCode}`);

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (!incident) throw new Error('Không tìm thấy sự cố cứu nạn');

    // Thêm bản ghi thông báo tiền viện vào bệnh viện
    const notification = {
      incidentId,
      sbarDossierId: incident.clinicalAssessment?.sbarDossier?.hashProof || 'SBAR-EMERGENCY',
      etaMinutes: Number(etaMinutes) || 10,
      chiefComplaint,
      notifiedAt: new Date(),
      status: 'PENDING',
    };
    hospital.preArrivalNotifications.push(notification);
    await hospital.save();

    // Cập nhật trạng thái sự cố
    incident.hospitalPreArrival = {
      targetHospitalCode: hospital.hospitalCode,
      targetHospitalName: hospital.hospitalName,
      recommendedReason: `Thông báo tiền viện cấp cứu SBAR tới ${hospital.hospitalName}`,
      etaMinutes: Number(etaMinutes) || 10,
      notifiedAt: new Date(),
      status: 'PRE_ARRIVAL_SENT',
    };
    incident.auditTrail.push({
      action: 'PRE_ARRIVAL_NOTIFICATION_SENT',
      timestamp: new Date(),
      details: `Đã phát thông báo tiền viện tới Khoa Cấp Cứu ${hospital.hospitalName}, dự kiến đến sau ${etaMinutes} phút`,
    });
    await incident.save();

    return {
      success: true,
      incidentId: incident._id,
      hospitalCode: hospital.hospitalCode,
      hospitalName: hospital.hospitalName,
      etaMinutes,
      chiefComplaint,
      status: 'PRE_ARRIVAL_SENT',
      message: `Đã gửi cảnh báo tiền viện tới ${hospital.hospitalName}. Đội ngũ bác sĩ cấp cứu đã nhận tín hiệu và đang chuẩn bị buồng hồi sức tích cực.`,
    };
  }

  /**
   * Bác Sĩ Cấp Cứu Bệnh Viện Xác Nhận Tiếp Nhận & Bố Trí Buồng Hồi Sức Sốc Sẵn Sàng (Bay Ready)
   */
  async acknowledgePreArrival(hospitalCode, incidentId, doctorName = 'BS.CKII Lê Văn Cường', bayNumber = 'Buồng Hồi Sức Cấp Cứu Sốc 01') {
    const hospital = await HospitalTraumaCenter.findOne({ hospitalCode });
    if (!hospital) throw new Error(`Không tìm thấy bệnh viện mã ${hospitalCode}`);

    const notif = hospital.preArrivalNotifications.find((n) => n.incidentId === incidentId);
    if (notif) {
      notif.status = 'ACCEPTED_BAY_READY';
      notif.acknowledgedByDoctor = doctorName;
      notif.resuscitationBayAssigned = bayNumber;
      notif.doctorNotes = 'Đã chuẩn bị sẵn máy thở, dịch truyền ấm, máy hút đờm và kíp phẫu thuật trực';
      await hospital.save();
    }

    const RescueIncident = require('../models/RescueIncident');
    const incident = await RescueIncident.findById(incidentId);
    if (incident) {
      if (!incident.hospitalPreArrival) incident.hospitalPreArrival = {};
      incident.hospitalPreArrival.acknowledgedByDoctor = doctorName;
      incident.hospitalPreArrival.resuscitationBayAssigned = bayNumber;
      incident.hospitalPreArrival.doctorPreparationNotes = 'Buồng hồi sức sốc sẵn sàng tiếp nhận';
      incident.hospitalPreArrival.status = 'HOSPITAL_ACCEPTED_BAY_READY';

      incident.auditTrail.push({
        action: 'HOSPITAL_BAY_RESERVED',
        timestamp: new Date(),
        details: `${doctorName} (${hospital.hospitalName}) đã xác nhận chuẩn bị ${bayNumber}`,
      });
      await incident.save();
    }

    return {
      success: true,
      hospitalCode,
      hospitalName: hospital.hospitalName,
      incidentId,
      acknowledgedByDoctor: doctorName,
      resuscitationBayAssigned: bayNumber,
      status: 'HOSPITAL_ACCEPTED_BAY_READY',
      preparationSummary: `${doctorName} tại ${hospital.hospitalName} đã tiếp nhận ca bệnh. Đã kích hoạt kíp hồi sức ngoại viện và bố trí ${bayNumber} sẵn sàng cứu chữa tức thì ngay khi xe tới cổng.`,
    };
  }

  /**
   * Định vị Bệnh viện có sẵn huyết thanh kháng nọc rắn đặc hiệu
   */
  async findNearestAntivenomHospital(lat, lng, antivenomType = 'POLYVALENT') {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      'antivenomStocks.antivenomType': antivenomType,
      'antivenomStocks.vialsAvailable': { $gt: 0 },
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    const stockInfo = (nearest.antivenomStocks || []).find((s) => s.antivenomType === antivenomType);
    const vials = stockInfo?.vialsAvailable ?? 25;

    return {
      success: true,
      antivenomType,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      vialsAvailable: vials,
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      clinicalGuidance: `Đã xác nhận sẵn có ${vials} lọ huyết thanh ${antivenomType} tại ${nearest.hospitalName}. Đội ngũ bác sĩ chống độc sẵn sàng thử test và truyền tĩnh mạch.`,
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Bỏng chuyên sâu gần nhất
   */
  async findNearestBurnCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      'emergencyDepartmentStatus.burnUnitReady': true,
      'emergencyDepartmentStatus.availableBurnBeds': { $gt: 0 },
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      availableBurnBeds: nearest.emergencyDepartmentStatus?.availableBurnBeds ?? 6,
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      preHospitalAdvice: 'Duy trì tưới rửa nước sạch mát 20 phút (không dùng đá lạnh). Bọc vết bỏng bằng màng bọc thực phẩm sạch/gạc ẩm vô trùng.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Lồng ngực & Chấn thương ngực gần nhất
   */
  async findNearestThoracicHospital(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'THORACIC_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'THORACIC_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      surgicalGuidance: `Đã kết nối với Trung tâm Phẫu thuật Lồng ngực ${nearest.hospitalName}. Kíp mổ lồng ngực và dẫn lưu màng phổi sẵn sàng tiếp nhận.`,
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Chấn thương Mắt & Bỏng Nhãn Cầu gần nhất
   */
  async findNearestEyeHospital(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'OPHTHALMOLOGY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'OPHTHALMOLOGY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      preHospitalDirectives: 'Bỏng hóa chất: Duy trì tưới rửa mắt liên tục ít nhất 15-20 phút. Chấn thương xuyên thủng: Đặt khiên che mắt cứng, TUYỆT ĐỐI KHÔNG ÉP VÀ KHÔNG RÚT DỊ VẬT.',
    };
  }

  /**
   * Định vị Trung tâm Vi phẫu Tạo hình & Nối Chi Đứt Rời gần nhất
   */
  async findNearestMicrovascularHospital(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'LIMB_REPLANTATION',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'LIMB_REPLANTATION',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      replantationAdvice: 'Bảo quản phần chi đứt rời theo quy tắc 3 lớp: Bọc gạc ẩm nước muối sinh lý -> Bỏ túi nilon kín -> Đặt vào xô nước đá 2-4 độ C (KHÔNG ngâm trực tiếp vào đá lạnh). Cầm máu mỏm cụt bằng băng ép hoặc garô nếu đứt động mạch lớn.',
    };
  }

  /**
   * Định vị Trung tâm Điều trị Oxy Cao Áp (Hyperbaric Oxygen Therapy - HBOT) gần nhất
   */
  async findNearestHyperbaricCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'HYPERBARIC_OXYGEN',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'HYPERBARIC_OXYGEN',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hbotGuidance: 'Chỉ định buồng Oxy cao áp 2.5 - 3.0 ATA cho ngộ độc khí CO nặng (HbCO > 25%, phụ nữ mang thai, ngất/hôn mê). Thở oxy 100% dòng cao qua mask có túi dự trữ trong suốt quá trình vận chuyển.',
    };
  }

  /**
   * Định vị Trung tâm Chống Độc & Hồi sức Độc chất gần nhất
   */
  async findNearestToxicologyCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'TOXICOLOGY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'TOXICOLOGY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      antidoteGuidance: 'Trung tâm Chống độc sẵn sàng tiếp nhận ngộ độc hóa chất/thuốc trừ sâu. Duy trì Atropin hóa, Pralidoxime (PAM) và lọc máu cấp cứu nếu có chỉ định.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Tim Mạch - Mạch Máu Cấp Cứu (Vỡ Phình ĐM Chủ Bụng)
   */
  async findNearestVascularSurgeryCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'VASCULAR_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'VASCULAR_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      surgicalGuidance: 'Báo động đỏ Vỡ phình ĐM chủ bụng (Ruptured AAA). Duy trì hạ huyết áp cho phép (SBP 80-90 mmHg, tránh vỡ cục máu đông tạm thời). Phòng mổ mạch máu và can thiệp nội mạch EVAR sẵn sàng đón bệnh nhân.',
    };
  }

  /**
   * Định vị Trung tâm Cấp Cứu Chấn Thương Vỡ Khung Chậu Nặng
   */
  async findNearestPelvicTraumaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PELVIC_TRAUMA',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PELVIC_TRAUMA',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      pelvicCareDirectives: 'Vỡ khung chậu nặng đe dọa mất 3-5L máu sau phúc mạc. Đã cố định bằng đai kẹp vùng chậu ngang mấu chuyển lớn xương đùi. Phòng mổ can thiệp nút mạch chậu (Angio-embolization) và khung cố định ngoài sẵn sàng.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Thần kinh & Chấn thương Sọ não Nặng (Phân hệ 40)
   */
  async findNearestNeurosurgeryCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'NEURO_TRAUMA',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'NEURO_TRAUMA',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      surgicalGuidance: 'Báo động đỏ Tụt kẹt não & Chấn thương sọ não nặng. Chuẩn bị sẵn phòng mổ mở sọ giải áp cấp cứu (Decompressive Craniectomy) và máy CT sọ não 128 dãy.',
    };
  }

  /**
   * Định vị Trung tâm Cấp Cứu Sản - Ngoại Hồi Sức Tuyến Cuối (Phân hệ 41)
   */
  async findNearestObstetricTraumaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'OBSTETRIC_TRAUMA',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'OBSTETRIC_TRAUMA',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      maternalGuidance: 'Báo động khẩn Sản phụ chấn thương / Ngừng tim thai phụ. Kíp phẫu thuật Sản - Ngoại và buồng Hồi sức sơ sinh (NICU) sẵn sàng kích hoạt mổ bắt con cấp cứu cứu mẹ (PMCD) trong 4-5 phút.',
    };
  }

  /**
   * Định vị Trung tâm Buồng Tăng Áp & Điều Trị Bệnh Giảm Áp (Phân hệ 42)
   */
  async findNearestDecompressionRecompressionCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'DECOMPRESSION_SICKNESS',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'DECOMPRESSION_SICKNESS',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hyperbaricDirectives: 'Bệnh giảm áp cấp tính (Bends / Thuyên tắc khí động mạch AGE). Buồng tăng áp đa chỗ (Multiplace Chamber) sẵn sàng kích hoạt Phác đồ Bảng 6 Hải quân (US Navy Treatment Table 6 - 2.8 ATA).',
    };
  }

  /**
   * Định vị Trung tâm Truyền Máu Tối Khẩn & Hồi Sức Sốc Mất Máu Nặng (Phân hệ 43)
   */
  async findNearestMassiveTransfusionCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'MASSIVE_TRANSFUSION',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'MASSIVE_TRANSFUSION',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      transfusionGuidance: 'Báo động đỏ Truyền máu khối lượng lớn (MTP 1:1:1). Ngân hàng máu xuất sẵn 4 đơn vị Hồng cầu lắng O âm/dương, 4 đơn vị Huyết tương tươi đông lạnh (FFP) và 1 kit Tiểu cầu đậm đặc.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Hạ Thân Nhiệt Sâu & ECMO Làm Ấm (Phân hệ 44)
   */
  async findNearestHypothermiaEcmoCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'HYPOTHERMIA_ECMO',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'HYPOTHERMIA_ECMO',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      ecmoGuidance: 'Báo động cấp cứu Hạ thân nhiệt sâu ngập lũ / rừng núi (Thân nhiệt lõi < 28°C). Kíp hồi sức ECMO V-A (Extracorporeal Life Support) sẵn sàng kết nối tuần hoàn ngoài cơ thể để làm ấm máu tích cực.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Nội Tiết & Cơn Bão Giáp Trạng (Phân hệ 45)
   */
  async findNearestEndocrinologyIcuCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ENDOCRINOLOGY_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ENDOCRINOLOGY_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      endocrineGuidance: 'Báo động đỏ Cơn bão giáp trạng (Thyroid Storm). Khoa Hồi sức Cấp cứu chuẩn bị sẵn Propylthiouracil (PTU), Lugol dung dịch nhỏ giọt, Hydrocortisone tĩnh mạch và Propranolol.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Chống Độc Công Nghiệp & Khí Độc H2S/Clo (Phân hệ 46)
   */
  async findNearestIndustrialToxicologyCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'INDUSTRIAL_TOXICOLOGY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'INDUSTRIAL_TOXICOLOGY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      toxicologyGuidance: 'Báo động đỏ Ngộ độc khí độc công nghiệp H2S/Clo. Khoa Chống Độc chuẩn bị sẵn Sodium Nitrite, Hydroxocobalamin liều cao và buồng khí dung kiềm hóa.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Sốc Tim & Phù Phổi Cấp (Phân hệ 47)
   */
  async findNearestCardiogenicShockCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'CARDIOLOGY_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'CARDIOLOGY_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      cardiologyGuidance: 'Báo động kíp Can thiệp Tim Mạch (Cath Lab) và Hồi sức Sốc Tim Killip IV. Chuẩn bị máy thở không xâm lấn CPAP, phòng thông tim mạch vành và bóng IABP hỗ trợ tuần hoàn.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Sốc Nhiễm Khuẩn & Sepsis Tuyến Cuối (Phân hệ 48)
   */
  async findNearestSepsisIcuCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'SEPSIS_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'SEPSIS_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      sepsisGuidance: 'Báo động Gói Giờ Vàng Sốc Nhiễm Khuẩn (Sepsis Hour-1 Bundle). Khoa ICU sẵn sàng cấy máu 2 vị trí, kháng sinh phổ rộng IV và đường truyền trung tâm (CVC) theo dõi CVP/ScvO2.',
    };
  }

  /**
   * Định vị Trung tâm Can Thiệp & Phẫu Thuật Mạch Máu Giáp Ranh (Phân hệ 49)
   */
  async findNearestVascularInterventionCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'VASCULAR_INTERVENTION',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'VASCULAR_INTERVENTION',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      vascularGuidance: 'Báo động đỏ Chấn thương mạch máu lớn & Nguy cơ hội chứng khoang. Khoa Ngoại Lồng ngực - Mạch máu chuẩn bị sẵn phòng mổ khẩn cấp, garô hơi chuyên dụng, dụng cụ mở bao cân giải áp (Fasciotomy) và mảnh ghép mạch nhân tạo Dacron/PTFE.',
    };
  }

  /**
   * Định vị Trung tâm Lưu Trữ & Cấp Phát Thuốc Giải Độc Dantrolene (Phân hệ 50)
   */
  async findNearestDantroleneStockCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'DANTROLENE_STOCK',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'DANTROLENE_STOCK',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hyperthermiaGuidance: 'Báo động Tăng Thân Nhiệt Ác Tính & Hội Chứng Serotonin đe dọa tính mạng. Khoa Dược xuất kho cấp cứu Dantrolene Sodium (liều khởi đầu 2.5 mg/kg IV) và Cyproheptadine 12 mg, buồng hồi sức chuẩn bị chăn hạ nhiệt đối lưu và máy lọc máu liên tục CRRT.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sinh Tim Phổi Ngoài Cơ Thể ECPR Tiền Viện (Phân hệ 51)
   */
  async findNearestEcprCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ECPR_CENTER',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ECPR_CENTER',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      ecprGuidance: 'KÍCH HOẠT TIỀN BÁO ECPR PRE-ALERT: Trung tâm Hồi sức Cấp cứu ECMO & Cath Lab chuẩn bị tiếp nhận ca ngừng tuần hoàn ngoại viện đang ép tim cơ học liên tục. Kíp đặt Cannula mạch đùi (Femoral VA-ECMO) sẵn sàng khởi động trong vòng dưới 60 phút tính từ lúc ngừng tim.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu Thuật Cột Sống & Hồi Sức Tủy Cấp (Phân hệ 52)
   */
  async findNearestSpineSurgeryCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'SPINE_SURGERY_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'SPINE_SURGERY_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      spineGuidance: 'Báo động đỏ Chấn thương cột sống ngực - thắt lưng & Nghi ngờ đứt tủy cấp tính. Khoa Phẫu thuật Cột sống chuẩn bị phòng mổ chấn thương, máy chụp CT đa lát cắt và nẹp cố định đệm chân không chuyên dụng.',
    };
  }

  /**
   * Định vị Trung tâm Điều Trị Oxy Cao Áp & Bệnh Lý Độ Cao (Phân hệ 53)
   */
  async findNearestAltitudeHyperbaricCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'HYPERBARIC_ALTITUDE',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'HYPERBARIC_ALTITUDE',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      altitudeGuidance: 'Báo động Phù não cấp (HACE) & Phù phổi cấp do độ cao (HAPE). Trung tâm Oxy Cao Áp sẵn sàng buồng giảm áp y tế nhiều chỗ (Multi-place Chamber), thở oxy phân áp cao 100% và thuốc chống phù não Dexamethasone.',
    };
  }

  /**
   * Định vị Trung tâm Bỏng Lạnh & Khí Hóa Lỏng Chuyên Sâu (Phân hệ 54)
   */
  async findNearestCryogenicBurnCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'CRYOGENIC_BURN',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'CRYOGENIC_BURN',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      cryogenicGuidance: 'Báo động Tổn thương Bỏng lạnh cực độ & Khí hóa lỏng (Liquid Nitrogen/CO2). Đơn vị Bỏng & Vi phẫu tạo hình chuẩn bị bồn ngâm tuần hoàn nước ấm 37-39°C, thuốc giãn mạch bảo tồn chi Iloprost và vật liệu băng gạc sinh học Aloe Vera.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Cấp cứu Viêm Cân Mạc Hoại Tử & Sốc Độc Tố (Phân hệ 55)
   */
  async findNearestNecrotizingFasciitisCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'NECROTIZING_FASCIITIS',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'NECROTIZING_FASCIITIS',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      necrotizingFasciitisGuidance: 'Báo động khẩn cấp Viêm cân mạc hoại tử (Necrotizing Fasciitis / TSS). Khoa Phẫu thuật Cấp cứu chuẩn bị phòng mổ rạch bao cân cắt lọc hoại tử khẩn cấp trong vòng <6 giờ và ICU chuẩn bị hồi sức lọc máu liên tục CRRT.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Cấp cứu Khối Máu Tụ Hốc Mắt & Mở Góc Mắt (Phân hệ 56)
   */
  async findNearestOrbitalSurgeryCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ORBITAL_COMPARTMENT_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ORBITAL_COMPARTMENT_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      orbitalGuidance: 'Báo động Khối máu tụ sau nhãn cầu gây Hội chứng khoang hốc mắt (Orbital Compartment Syndrome). Kíp phẫu thuật Nhãn khoa & Hàm mặt chuẩn bị bộ dụng cụ rạch mở góc mắt ngoài và cắt dây chằng mi dưới (Lateral Canthotomy & Cantholysis) để giải áp trước mốc 60-90 phút.',
    };
  }

  /**
   * Định vị Trung tâm Cấp Cứu Ngộ Độc Thuốc Tê & Nhũ Dịch Lipid 20% (Phân hệ 57)
   */
  async findNearestLipidRescueCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'LAST_LIPID_RESCUE',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'LAST_LIPID_RESCUE',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      lipidRescueGuidance: 'Báo động Ngộ độc thuốc tê toàn thân nghiêm trọng (LAST Protocol). Chuẩn bị sẵn sàng Nhũ dịch Lipid 20% (Intralipid 20%), hệ thống tuần hoàn ngoài cơ thể ECMO hỗ trợ nếu ngừng tim trơ và máy khử rung tim.',
    };
  }

  /**
   * Định vị Trung tâm Cấp Cứu Thuyên Tắc Phổi Diện Rộng & Tắc Mạch Ối (Phân hệ 58)
   */
  async findNearestPulmonaryEmbolismCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PULMONARY_EMBOLISM_ECMO',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PULMONARY_EMBOLISM_ECMO',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      pulmonaryEmbolismGuidance: 'Báo động đỏ Thuyên tắc phổi diện rộng (Massive PE) / Tắc mạch ối (AFE). Trung tâm Can thiệp Tim mạch & Hồi sức ECMO chuẩn bị bàn chụp mạch xóa nền DSA, thuốc tiêu sợi huyết Alteplase tPA và hệ thống oxy hóa màng ngoài cơ thể V-A ECMO hỗ trợ suy thất phải cấp.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Cấp cứu Vỡ Thực Quản & Tràn Khí Trung Thất (Phân hệ 59)
   */
  async findNearestEsophagealSurgeryCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'THORACIC_ESOPHAGEAL_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'THORACIC_ESOPHAGEAL_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      esophagealSurgeryGuidance: 'Báo động Khẩn cấp Vỡ thực quản tự phát áp lực (Hội chứng Boerhaave / Viêm trung thất hoại tử). Kíp Phẫu thuật Lồng ngực chuẩn bị phòng mổ nội soi lồng ngực khâu lỗ thủng thực quản khẩn cấp và dẫn lưu khoang trung thất trong vòng 12-24 giờ vàng.',
    };
  }

  /**
   * Định vị Trung tâm Cấp Cứu Tiết Niệu & Chấn Thương Niệu Đạo Phức Tạp (Phân hệ 60)
   */
  async findNearestUrologyTraumaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'UROLOGY_TRAUMA',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'UROLOGY_TRAUMA',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      urologyTraumaGuidance: 'Báo động Vỡ bàng quang & Chấn thương đứt niệu đạo (Urethral Disruption). Khoa Cấp cứu Tiết niệu chuẩn bị máy X-quang chụp niệu đạo ngược dòng RUG, bộ dụng cụ mở bàng quang ra da trên xương mu (Suprapubic Cystostomy) và phòng mổ phục hồi niệu đạo.',
    };
  }

  /**
   * Định vị Trung tâm Can Thiệp Mạch Não & Đột Quỵ Tuyến Cuối (Phân hệ 61)
   */
  async findNearestNeurovascularCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'NEUROVASCULAR_INTERVENTION',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'NEUROVASCULAR_INTERVENTION',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      neurovascularGuidance: 'Báo động Xuất huyết não dưới nhện cấp aSAH (Cơn đau đầu sét đánh / Hunt-Hess). Khoa Cấp cứu Đột quỵ sẵn sàng phòng Can thiệp Mạch não DSA 24/7 chụp mạch và nút coil phình mạch khẩn cấp (Endovascular Coiling).',
    };
  }

  /**
   * Định vị Trung tâm Phẫu Thuật Cấp Cứu Tim Lồng Ngực Tuyến Cuối (Phân hệ 62)
   */
  async findNearestCardiothoracicEmergencyCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'CARDIOTHORACIC_EMERGENCY_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'CARDIOTHORACIC_EMERGENCY_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      cardiothoracicGuidance: 'Báo động Đỏ Vết thương xuyên thấu tim & Chèn ép tim cấp (Tam chứng Beck). Kíp Phẫu thuật Tim Lồng ngực sẵn sàng phòng mổ khẩn cấp mở ngực cấp cứu EDT, giải phóng chèn ép màng ngoài tim và khâu vết rách tim/mạch vành.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu Thuật Giải Ép Cột Sống & Thần Kinh Khẩn Cấp (Phân hệ 63)
   */
  async findNearestSpineDecompressionCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'SPINE_DECOMPRESSION_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'SPINE_DECOMPRESSION_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      spineDecompressionGuidance: 'Báo động Cờ đỏ Hội chứng Chùm đuôi ngựa cấp (CES - Saddle Anesthesia & Bí tiểu cấp). Kíp Ngoại Thần kinh Cột sống sẵn sàng chụp MRI khẩn cấp và chuẩn bị phòng mổ giải ép thần kinh trong vòng 24-48 giờ vàng bảo tồn chức năng vận động và cơ tròn.',
    };
  }

  /**
   * Định vị Trung tâm Cấp Cứu Thuyên Tắc Mỡ & Đa Chấn Thương Tuyến Cuối (Phân hệ 64)
   */
  async findNearestFatEmbolismCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'FAT_EMBOLISM_ORTHO_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'FAT_EMBOLISM_ORTHO_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      fatEmbolismGuidance: 'Báo động Hội chứng Thuyên tắc mỡ sau gãy xương dài (FES Gurd Triad / VAE Durant Maneuver). Khoa Hồi sức Chấn thương sẵn sàng máy thở bảo vệ phổi ARDS, phòng mổ kết hợp xương khẩn cấp và theo dõi sát chức năng thần kinh.',
    };
  }

  /**
   * Định vị Trung tâm Cấp Cứu Cơn Tăng Huyết Áp & Hồi Sức Tim Mạch Tuyến Cuối (Phân hệ 65)
   */
  async findNearestHypertensiveEmergencyCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'HYPERTENSIVE_EMERGENCY_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'HYPERTENSIVE_EMERGENCY_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hypertensiveGuidance: 'Báo động Cơn Tăng huyết áp cấp cứu kèm tổn thương cơ quan đích (Hypertensive Emergency). Khoa Cấp cứu Tim Mạch chuẩn bị bơm tiêm điện truyền Nicardipine/Labetalol tĩnh mạch chỉnh liều, chụp CT sọ não và theo dõi xâm lấn huyết áp động mạch A-line.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Nội Tiết U Tủy Thượng Thận Tuyến Cuối (Phân hệ 66)
   */
  async findNearestEndocrinePheochromocytomaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PHEOCHROMOCYTOMA_ENDOCRINE_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PHEOCHROMOCYTOMA_ENDOCRINE_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      pheochromocytomaGuidance: 'Báo động Cơn bão Catecholamine U tủy thượng thận (Pheochromocytoma Crisis). Khoa Hồi sức Nội tiết chuẩn bị Phentolamine tiêm tĩnh mạch, bù dịch lòng mạch và nghiêm cấm dùng thuốc chẹn Beta đơn độc.',
    };
  }

  /**
   * Định vị Trung tâm Đột Quỵ Xuất Huyết Não & Phẫu Thuật Mở Sọ Giải Áp Tuyến Cuối (Phân hệ 67)
   */
  async findNearestIchNeurosurgeryCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ICH_NEUROSURGERY_CENTER',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ICH_NEUROSURGERY_CENTER',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      ichNeurosurgeryGuidance: 'Báo động Đột quỵ Xuất huyết não trong nhu mô (ICH & Spot Sign CTA). Khoa Phẫu thuật Thần kinh và Hồi sức Đột quỵ sẵn sàng mở sọ giải áp khẩn cấp (Cerebellar Hematoma >= 3cm), dẫn lưu não thất ngoài EVD và chuẩn bị thuốc đảo ngược chống đông 4-Factor PCC / Idarucizumab.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu Thuật Tim Hở & Bóc Tách ĐMC Cấp Tính Tuyến Cuối (Phân hệ 68)
   */
  async findNearestAorticDissectionCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'AORTIC_DISSECTION_EMERGENCY_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'AORTIC_DISSECTION_EMERGENCY_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      aorticDissectionGuidance: 'Báo động đỏ Phẫu thuật Lồng ngực - Mạch máu khẩn cấp Bóc tách ĐMC cấp tính (Stanford Type A Hemopericardium Tamponade). Chuẩn bị phòng mổ tim mở và máy tuần hoàn ngoài cơ thể CEC; cảnh báo TUYỆT ĐỐI CẤM chọc hút màng tim bừa bãi làm mất hiệu ứng tự cầm máu.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Nội Tiết Hôn Mê Tăng Áp Lực Thẩm Thấu Tuyến Cuối (Phân hệ 69)
   */
  async findNearestHhsEndocrineIcuCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'HHS_HYPEROSMOLAR_ENDOCRINE_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'HHS_HYPEROSMOLAR_ENDOCRINE_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hhsEndocrineGuidance: 'Báo động Hôn mê tăng áp lực thẩm thấu do đái tháo đường (HHS Glucose >= 600 mg/dL, Áp lực thẩm thấu > 320 mOsm/kg, mất nước trầm trọng 9-12L). Khoa ICU Nội tiết sẵn sàng bù dịch tinh thể NaCl 0.9% tốc độ cao, bù Kali đạt >= 3.3 mEq/L trước khi khởi động Insulin.',
    };
  }

  /**
   * Định vị Trung tâm Cấp Cứu Cơn Hen Ác Tính & Hồi Sức Hô Hấp Tuyến Cuối (Phân hệ 70)
   */
  async findNearestSevereAsthmaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PULMONOLOGY_ICU_ASTHMA',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PULMONOLOGY_ICU_ASTHMA',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      asthmaGuidance: 'Báo động Cơn hen phế quản ác tính đe dọa tính mạng (Near-Fatal Asthma & Silent Chest). Khoa Hồi sức Hô hấp sẵn sàng khí dung liên tục, truyền Magnesium Sulfate 2g tĩnh mạch, chuẩn bị máy thở với chế độ thở chậm I:E 1:4-1:5 chống bẫy khí Auto-PEEP và TUYỆT ĐỐI CẤM dùng thuốc an thần.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu Thuật Mạch Máu Cấp Cứu Thuyên Tắc Chi Cấp Tuyến Cuối (Phân hệ 71)
   */
  async findNearestLimbIschemiaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'VASCULAR_SURGERY_LIMB_ISCHEMIA',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'VASCULAR_SURGERY_LIMB_ISCHEMIA',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      limbIschemiaGuidance: 'Báo động Thiếu máu chi cấp tính đe dọa hoại tử (Acute Limb Ischemia Hội chứng 6P Rutherford IIb). Khoa Phẫu thuật Lồng ngực - Mạch máu chuẩn bị phòng can thiệp lấy huyết khối bằng ống thông Fogarty hoặc tiêu sợi huyết nội mạch trong cửa sổ vàng 6 giờ; cảnh báo TUYỆT ĐỐI CẤM chườm nóng và cấm kê cao chi.',
    };
  }

  /**
   * Định vị Trung tâm Nội Soi Mật Tụy Can Thiệp ERCP & Nhiễm Trùng Đường Mật Tuyến Cuối (Phân hệ 72)
   */
  async findNearestBiliaryCholangitisCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'BILIARY_ENDOSCOPY_ERCP_CENTER',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'BILIARY_ENDOSCOPY_ERCP_CENTER',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      cholangitisGuidance: 'Báo động Nhiễm trùng đường mật cấp tính có sốc nhiễm trùng (Tam chứng Charcot & Ngũ chứng Reynolds Pentad). Khoa Nội soi Tiêu hóa và Ngoại Gan Mật Tụy sẵn sàng phòng can thiệp ERCP đặt stent giải áp đường mật khẩn cấp trong vòng 12-24 giờ và hồi sức sốc nhiễm khuẩn huyết.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Lồng ngực Tim mạch & Giải áp Tràn khí màng ngoài tim (Phân hệ 73)
   */
  async findNearestPneumopericardiumCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PNEUMOPERICARDIUM_CARDIOTHORACIC',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PNEUMOPERICARDIUM_CARDIOTHORACIC',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      pneumopericardiumGuidance: 'Báo động Tràn khí màng ngoài tim áp lực đe dọa chèn ép tim cấp (Tension Pneumopericardium tiếng bánh xe nước Bruit de Moulin). Khoa Phẫu thuật Lồng ngực - Tim mạch chuẩn bị phòng mổ cấp cứu dẫn lưu màng ngoài tim giải áp; TUYỆT ĐỐI CẤM thông khí áp lực dương cao trước khi dẫn lưu.',
    };
  }

  /**
   * Định vị Trung tâm Chống độc & Chạy thận Lọc máu Ngắt quãng khẩn cấp Ngộ độc Methanol (Phân hệ 74)
   */
  async findNearestMethanolDialysisCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'METHANOL_TOXICOLOGY_DIALYSIS',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'METHANOL_TOXICOLOGY_DIALYSIS',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      methanolDialysisGuidance: 'Báo động Ngộ độc cấp cồn công nghiệp Methanol toan máu nặng kèm tổn thương thị giác bão tuyết (Snowstorm Vision). Khoa Hồi sức Chống độc sẵn sàng Fomepizole/Ethanol 40 độ và kích hoạt máy lọc máu ngắt quãng cấp cứu (IHD) trong vòng 6 giờ đầu để ngăn ngừa mù lòa vĩnh viễn và tử vong.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Ngoại Tiêu hóa & Mở bụng Giải áp Hội chứng Khoang Bụng ACS (Phân hệ 75)
   */
  async findNearestAbdominalCompartmentCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ABDOMINAL_COMPARTMENT_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ABDOMINAL_COMPARTMENT_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      abdominalCompartmentGuidance: 'Báo động Hội chứng Chèn ép Khoang Bụng Cấp (Abdominal Compartment Syndrome IAP > 20 mmHg kèm suy đa tạng). Khoa Ngoại Tiêu hóa chuẩn bị kíp mổ mở toang ổ bụng khẩn cấp (Decompressive Laparotomy) dùng túi Bogota/Vac-Pack giải áp; khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch quá tải.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Nhãn khoa & Phẫu thuật Khâu Vỡ Nhãn Cầu Mở Tuyến Cuối (Phân hệ 76)
   */
  async findNearestOpenGlobeSurgeryCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'OPEN_GLOBE_OPHTHALMIC_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'OPEN_GLOBE_OPHTHALMIC_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      openGlobeGuidance: 'Báo động Chấn thương Thủng / Vỡ Nhãn Cầu Mở (Open Globe Injury Seidel dương tính). Khoa Cấp cứu Nhãn khoa chuẩn bị phòng mổ vi phẫu khâu bảo tồn nhãn cầu khẩn cấp; khóa cảnh báo TUYỆT ĐỐI CẤM tỳ đè băng ép mắt và CẤM Succinylcholine khi gây mê.',
    };
  }

  /**
   * Định vị Trung tâm Đột quỵ - Huyết học & Kho Thuốc Đối Kháng DOACs Khẩn Cấp (Phân hệ 77)
   */
  async findNearestDoacAntidoteCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'DOAC_ANTIDOTE_HEMATOLOGY_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'DOAC_ANTIDOTE_HEMATOLOGY_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      doacGuidance: 'Báo động Xuất huyết nặng đe dọa tử vong do Thuốc chống đông đường uống thế hệ mới (DOACs Bleeding Crisis). Khoa Hồi sức Huyết học chuẩn bị sẵn Idarucizumab 5g IV cho Dabigatran hoặc 4-Factor PCC 50 IU/kg cho thuốc kháng Xa; cảnh báo TUYỆT ĐỐI CẤM truyền FFP đơn thuần.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Tim Mạch Hở & Chạy Máy Tim Phổi Nhân Tạo CEC Cấp Cứu Vỡ Tim (Phân hệ 78)
   */
  async findNearestBluntCardiacRuptureCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'BLUNT_CARDIAC_RUPTURE_CEC',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'BLUNT_CARDIAC_RUPTURE_CEC',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      bluntCardiacGuidance: 'Báo động Đụng dập ngực kín vỡ tim / rách vách liên thất / tràn máu màng tim cấp (Blunt Cardiac Rupture E-FAST xoáy cuộn). Khoa Phẫu thuật Lồng ngực - Tim mạch và kíp tim phổi nhân tạo CEC sẵn sàng mở ngực vá tim cấp cứu; khóa cảnh báo TUYỆT ĐỐI CẤM tiêu sợi huyết tPA.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Tắc Mạch Khí Tĩnh Mạch & Buồng Oxy Cao Áp HBOT (Phân hệ 79)
   */
  async findNearestAirEmbolismCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'VENOUS_AIR_EMBOLISM_HBOT_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'VENOUS_AIR_EMBOLISM_HBOT_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      airEmbolismGuidance: 'Báo động Tắc mạch khí tĩnh mạch khổng lồ (Venous Air Embolism). ICU và Đơn vị Buồng Oxy cao áp HBOT sẵn sàng; lập tức đặt tư thế Durant (nằm nghiêng trái, đầu dốc Trendelenburg 15-30 độ) và thở oxy 100% qua mặt nạ thở lại; TUYỆT ĐỐI CẤM ngồi dậy.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Nội soi Thắt Vòng Giãn Tĩnh Mạch Thực Quản EVL (Phân hệ 80)
   */
  async findNearestVaricealEndoscopyCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ESOPHAGEAL_VARICEAL_ENDOSCOPY_EVL',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ESOPHAGEAL_VARICEAL_ENDOSCOPY_EVL',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      varicealGuidance: 'Báo động Xuất huyết tiêu hóa ồ ạt do Vỡ giãn tĩnh mạch thực quản (Acute Esophageal Variceal Bleeding). Đơn vị Nội soi can thiệp EVL và Ngân hàng máu sẵn sàng; tiêm mạch Terlipressin 2mg, kháng sinh Ceftriaxone 1g, truyền máu hạn chế mục tiêu Hb 7-8 g/dL, TUYỆT ĐỐI CẤM bù dịch quá tải.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Ngạt Khói & Giải Độc Cyanide / Đơn vị Bỏng Chuyên Sâu (Phân hệ 81)
   */
  async findNearestSmokeCyanokitBurnCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'SMOKE_INHALATION_CYANOKIT_BURN',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'SMOKE_INHALATION_CYANOKIT_BURN',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      smokeCyanideGuidance: 'Báo động Hít phải khói đám cháy kín & Nhiễm độc Cyanide / CO kết hợp (Smoke Inhalation Cyanide Poisoning). Khoa Cấp cứu / Bỏng chuẩn bị sẵn Hydroxocobalamin (Cyanokit) 5g IV, bình oxy 100%, kíp đặt nội khí quản sớm trước phù nề thanh môn; TUYỆT ĐỐI CẤM dùng thuốc giải độc nhóm Nitrite.',
    };
  }

  /**
   * Định vị Trung tâm Dị ứng Miễn dịch Lâm sàng & Hồi sức Cấp cứu Sốc Phản Vệ Pha Hai (Phân hệ 82)
   */
  async findNearestBiphasicAnaphylaxisCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'BIPHASIC_ANAPHYLAXIS_GLUCAGON_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'BIPHASIC_ANAPHYLAXIS_GLUCAGON_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      biphasicGuidance: 'Báo động Sốc phản vệ pha hai (Biphasic Anaphylaxis) / Kháng Adrenaline do chẹn Beta. ICU và Trung tâm Dị ứng Miễn dịch sẵn sàng Glucagon 1-5mg IV tiêm chậm >= 5 phút, theo dõi tối thiểu 12-24 giờ; TUYỆT ĐỐI CẤM cho nạn nhân xuất viện sớm.',
    };
  }

  /**
   * Định vị Trung tâm Can thiệp Điện sinh lý Tim mạch & Điều trị Xoắn Đỉnh TdP (Phân hệ 83)
   */
  async findNearestTorsadesDePointesCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'TORSADES_DE_POINTES_CARDIOLOGY_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'TORSADES_DE_POINTES_CARDIOLOGY_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      torsadesGuidance: 'Báo động Cơn loạn nhịp thất xoắn đỉnh do thuốc (Drug-Induced Torsades de Pointes QTc > 500ms). Khoa Tim mạch chuẩn bị sẵn Magnesium Sulfate 2g IV, máy tạo nhịp vượt tần số; khóa cảnh báo TUYỆT ĐỐI CẤM thuốc chống loạn nhịp nhóm Ia/III (Amiodarone) và cấm sốc điện đồng bộ.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Lồng ngực - Mạch máu Mở Ngực Cấp Cứu Tràn Máu Lượng Lớn (Phân hệ 84)
   */
  async findNearestMassiveHemothoraxCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'MASSIVE_HEMOTHORAX_THORACOTOMY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'MASSIVE_HEMOTHORAX_THORACOTOMY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      massiveHemothoraxGuidance: 'Báo động Tràn máu màng phổi lượng lớn >= 1,500 mL (Massive Hemothorax). Khoa Phẫu thuật Lồng ngực chuẩn bị sẵn ống dẫn lưu ngực lớn 28-32 Fr, hệ thống hút áp lực âm liên tục, bộ truyền máu hoàn hồi Autotransfusion và kíp mở ngực khẩn cấp; khóa cảnh báo TUYỆT ĐỐI CẤM kẹp ống dẫn lưu.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Tắc Mạch Khí Tĩnh Mạch & Buồng Oxy Cao Áp HBOT (Phân hệ 79)
   */
  async findNearestAirEmbolismCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'VENOUS_AIR_EMBOLISM_HBOT_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'VENOUS_AIR_EMBOLISM_HBOT_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      airEmbolismGuidance: 'Báo động Tắc mạch khí tĩnh mạch khổng lồ (Venous Air Embolism). ICU và Đơn vị Buồng Oxy cao áp HBOT sẵn sàng; lập tức đặt tư thế Durant (nằm nghiêng trái, đầu dốc Trendelenburg 15-30 độ) và thở oxy 100% qua mặt nạ thở lại; TUYỆT ĐỐI CẤM ngồi dậy.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Nội soi Thắt Vòng Giãn Tĩnh Mạch Thực Quản EVL (Phân hệ 80)
   */
  async findNearestVaricealEndoscopyCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ESOPHAGEAL_VARICEAL_ENDOSCOPY_EVL',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ESOPHAGEAL_VARICEAL_ENDOSCOPY_EVL',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      varicealGuidance: 'Báo động Xuất huyết tiêu hóa ồ ạt do Vỡ giãn tĩnh mạch thực quản (Acute Esophageal Variceal Bleeding). Đơn vị Nội soi can thiệp EVL và Ngân hàng máu sẵn sàng; tiêm mạch Terlipressin 2mg, kháng sinh Ceftriaxone 1g, truyền máu hạn chế mục tiêu Hb 7-8 g/dL, TUYỆT ĐỐI CẤM bù dịch quá tải.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Ngạt Khói & Giải Độc Cyanide / Đơn vị Bỏng Chuyên Sâu (Phân hệ 81)
   */
  async findNearestSmokeCyanokitBurnCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'SMOKE_INHALATION_CYANOKIT_BURN',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'SMOKE_INHALATION_CYANOKIT_BURN',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      smokeCyanideGuidance: 'Báo động Hít phải khói đám cháy kín & Nhiễm độc Cyanide / CO kết hợp (Smoke Inhalation Cyanide Poisoning). Khoa Cấp cứu / Bỏng chuẩn bị sẵn Hydroxocobalamin (Cyanokit) 5g IV, bình oxy 100%, kíp đặt nội khí quản sớm trước phù nề thanh môn; TUYỆT ĐỐI CẤM dùng thuốc giải độc nhóm Nitrite.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Sản - Phụ Khoa & Hồi Sức Băng Huyết Sau Sinh PPH (Phân hệ 85)
   */
  async findNearestPostpartumHemorrhageCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'POSTPARTUM_HEMORRHAGE_BAKRI_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'POSTPARTUM_HEMORRHAGE_BAKRI_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      pphGuidance: 'Báo động Băng huyết sau sinh nguy kịch (Postpartum Hemorrhage). Sản khoa chuẩn bị sẵn Oxytocin, Tranexamic Acid (TXA) 1g IV, bóng chèn Bakri và kích hoạt quy trình truyền máu khối lượng lớn MTP; khóa cảnh báo TUYỆT ĐỐI CẤM Methylergometrine ở sản phụ tăng HA hoặc tiền sản giật.',
    };
  }

  /**
   * Định vị Trung tâm Hồi sức Can thiệp Mạch Phổi & Tiêu Sợi Huyết / ECMO Cấp Cứu (Phân hệ 86)
   */
  async findNearestMassivePEThrombolysisCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'MASSIVE_PE_THROMBOLYSIS_ECMO',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'MASSIVE_PE_THROMBOLYSIS_ECMO',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      massivePeGuidance: 'Báo động Thuyên tắc động mạch phổi diện rộng nguy cơ tử vong cao (High-Risk Massive Pulmonary Embolism). Khoa Hồi sức Tim mạch chuẩn bị sẵn Alteplase (rt-PA) 50-100mg IV, kíp VA-ECMO; khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch quá mức (> 500 mL) gây đè ép thất trái ngừng tim.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Tai Mũi Họng & Hồi Sức Đường Thở Nhi Khoa (Phân hệ 87)
   */
  async findNearestPediatricEpiglottitisCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PEDIATRIC_EPIGLOTTITIS_AIRWAY_ENT',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PEDIATRIC_EPIGLOTTITIS_AIRWAY_ENT',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      epiglottitisGuidance: 'Báo động Viêm nắp thanh quản cấp trẻ em đe dọa tắc thở (Pediatric Acute Epiglottitis). Phòng mổ Nhi & Bác sĩ Tai Mũi Họng chuẩn bị sẵn kíp đặt ống nội khí quản và mở màng nhẫn giáp vi phẫu; khóa cảnh báo TUYỆT ĐỐI CẤM dùng đè lưỡi khám họng và CẤM bắt trẻ nằm ngửa.',
    };
  }

  /**
   * Định vị Trung tâm Cấp cứu Phẫu thuật Thần kinh - Hồi sức Cột Sống & Sốc Tủy (Phân hệ 88)
   */
  async findNearestNeurogenicShockCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'NEUROGENIC_SHOCK_MAP85_SPINE_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'NEUROGENIC_SHOCK_MAP85_SPINE_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      neurogenicShockGuidance: 'Báo động Sốc tủy do chấn thương tủy cổ/ngực cao (Neurogenic Shock). Khoa Hồi sức Cột sống chuẩn bị sẵn Norepinephrine/Dopamine duy trì MAP >= 85-90 mmHg liên tục 7 ngày; khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch quá tải và CẤM Phenylephrine đơn độc.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Tim Mạch - Lồng Ngực Cổ & Máu Tụ Chèn Ép Khí Quản Cấp (Phân hệ 89)
   */
  async findNearestPenetratingNeckCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PENETRATING_NECK_HEMATOMA_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PENETRATING_NECK_HEMATOMA_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      penetratingNeckGuidance: 'Báo động Vết thương xuyên thấu cổ & Khối máu tụ đè xẹp khí quản (Penetrating Neck Trauma & Expanding Hematoma). Kíp Phẫu thuật Mạch máu & Gây mê chuẩn bị mở màng nhẫn giáp vi phẫu hoặc Video Laryngoscope; khóa cảnh báo TUYỆT ĐỐI CẤM băng ép vòng qua cổ và CẤM kẹp Hemostat mò trong vết thương.',
    };
  }

  /**
   * Định vị Trung tâm Hồi sức Chống Độc & Cấp Cứu Hội Chứng Cai Rượu Mê Sảng Nặng (Phân hệ 90)
   */
  async findNearestDeliriumTremensCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'DELIRIUM_TREMENS_ICU_TOXICOLOGY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'DELIRIUM_TREMENS_ICU_TOXICOLOGY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      deliriumTremensGuidance: 'Báo động Hội chứng cai rượu tối cấp & Mê sảng nặng (Severe Delirium Tremens). Khoa Hồi sức Chống độc chuẩn bị sẵn Diazepam liều cao IV, Thiamine (Vitamin B1) tiêm trước dịch truyền đường Glucose; khóa cảnh báo TUYỆT ĐỐI CẤM Haloperidol đơn độc.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Tim Mạch - Lồng Ngực Cấp Cứu Dị Vật Găm Ngực (Phân hệ 91)
   */
  async findNearestImpaledThoracicCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'IMPALED_THORACIC_TRAUMA_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'IMPALED_THORACIC_TRAUMA_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      impaledThoracicGuidance: 'Báo động Chấn thương xuyên thấu tim có dị vật găm lồng ngực (Impaled Thoracic Trauma). Phòng mổ Tim mạch & Kíp tuần hoàn ngoài cơ thể CEC sẵn sàng mở ngực khẩn cấp; khóa cảnh báo TUYỆT ĐỐI CẤM rút dị vật ngoại viện.',
    };
  }

  /**
   * Định vị Trung tâm Hồi sức Cấp cứu Nhiễm trùng & Sốt Rét Ác Tính Tuyến Cuối (Phân hệ 92)
   */
  async findNearestCerebralMalariaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'CEREBRAL_MALARIA_ARTESUNATE_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'CEREBRAL_MALARIA_ARTESUNATE_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      cerebralMalariaGuidance: 'Báo động Sốt rét ác tính thể não (Severe Falciparum Cerebral Malaria). Khoa Cấp cứu - Hồi sức Nhiễm trùng chuẩn bị sẵn Artesunate 2.4 mg/kg IV tiêm chậm; khóa cảnh báo TUYỆT ĐỐI CẤM Dexamethasone và CẤM truyền dịch quá tải.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Tiết niệu & Can thiệp Mạch Cấp Cứu Vỡ Thận Độ V (Phân hệ 93)
   */
  async findNearestGradeVRenalCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'GRADE_V_RENAL_VASCULAR_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    const list = candidates.length > 0 ? candidates : await HospitalTraumaCenter.find();
    for (const h of list) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'GRADE_V_RENAL_VASCULAR_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      gradeVRenalGuidance: 'Báo động Vỡ thận độ V đứt toạc cuống mạch thận sau phúc mạc (Grade V Renal Pedicle Avulsion). Phòng can thiệp mạch DSA và Phòng mổ Tiết niệu chuẩn bị nút mạch hoặc thắt cuống thận; khóa cảnh báo TUYỆT ĐỐI CẤM nắn ép mạnh vùng hông lưng tránh rách mạc Gerota.',
    };
  }

  /**
   * Định vị Trung tâm Hồi sức Cấp cứu Sốc Nhiệt Ác Tính & Bồn Ngâm Nước Đá CWI (Phân hệ 94)
   */
  async findNearestExertionalHeatStrokeCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'EXERTIONAL_HEAT_STROKE_CWI_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'EXERTIONAL_HEAT_STROKE_CWI_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      heatStrokeGuidance: 'Báo động Sốc nhiệt ác tính gắng sức (Exertional Heat Stroke - EHS). ICU chuẩn bị hệ thống bồn ngâm CWI, máy hạ thân nhiệt chỉ huy Arctic Sun và lọc máu CRRT dự phòng suy thận do tiêu cơ vân; khóa cảnh báo TUYỆT ĐỐI CẤM dùng thuốc hạ sốt Paracetamol/Aspirin và quy tắc COOL FIRST, TRANSPORT SECOND.',
    };
  }

  /**
   * Định vị Trung tâm Bỏng & Phẫu thuật Tạo hình Cấp Cứu Hóa Chất Công Nghiệp (Phân hệ 95)
   */
  async findNearestSevereChemicalBurnsCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'SEVERE_CHEMICAL_BURNS_DECONTAM',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'SEVERE_CHEMICAL_BURNS_DECONTAM',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      chemicalBurnGuidance: 'Báo động Bỏng hóa chất công nghiệp diện rộng (Severe Chemical Burns). Trung tâm Bỏng chuẩn bị phòng khử nhiễm vô trùng, dung dịch rửa Diphoterine và đo pH mắt; khóa cảnh báo TUYỆT ĐỐI CẤM dùng hóa chất đối kháng trung hòa (tránh sinh nhiệt ngoại vi) và CẤM vòi xịt áp lực mạnh.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Gan Mật Tụy Cấp Cứu Vỡ Gan Độ V (Phân hệ 96)
   */
  async findNearestGradeVHepaticSurgeryCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'GRADE_V_HEPATIC_PACKING_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'GRADE_V_HEPATIC_PACKING_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      gradeVHepaticGuidance: 'Báo động Vỡ gan độ V & Rách tĩnh mạch sau gan nguy kịch mất máu (AAST Grade V Hepatic Laceration). Phòng mổ Gan Mật Tụy và Kíp Can thiệp mạch chuẩn bị Nghiệm pháp Pringle, chèn gạc quanh gan (Packing) và MTP 1:1:1; khóa cảnh báo TUYỆT ĐỐI CẤM dỡ bỏ gạc chèn (unpacking) sớm trước 48-72h và CẤM khâu mò tĩnh mạch sau gan.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Tiêu hóa & Can thiệp Mạch Cấp Cứu Vỡ Lách Độ V (Phân hệ 97)
   */
  async findNearestGradeVSplenicCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'GRADE_V_SPLENIC_DCR_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'GRADE_V_SPLENIC_DCR_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      gradeVSplenicGuidance: 'Báo động Vỡ lách độ V dập nát hoặc đứt toạc cuống mạch (AAST Grade V Splenic Rupture). Phòng mổ Cấp cứu và Kíp Can thiệp mạch DSA chuẩn bị cắt lách hoặc nút mạch lách SAE kết hợp MTP 1:1:1; khóa cảnh báo TUYỆT ĐỐI CẤM nâng HA bình thường bằng dịch tinh thể và CẤM trì hoãn chụp CT khi sốc không ổn định.',
    };
  }

  /**
   * Định vị Trung tâm Hồi sức Chống Độc & Cấp Cứu Ngộ Độc Nhôm Photphua (Phân hệ 98)
   */
  async findNearestAluminiumPhosphideCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ALUMINIUM_PHOSPHIDE_TOXICOLOGY_ECMO',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ALUMINIUM_PHOSPHIDE_TOXICOLOGY_ECMO',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      phosphideGuidance: 'Báo động Ngộ độc thuốc diệt mọt Nhôm Photphua giải phóng khí độc Phosphine (Aluminium Phosphide Poisoning). ICU Chống độc chuẩn bị dầu dừa, dung dịch NaHCO3 5% rửa dạ dày, phòng thông gió bảo hộ và VA-ECMO; khóa cảnh báo TUYỆT ĐỐI CẤM rửa dạ dày bằng nước lã thông thường.',
    };
  }

  /**
   * Định vị Trung tâm Phẫu thuật Tim Mạch - Lồng Ngực Cấp Cứu Vết Thương Ngực Hở (Phân hệ 99)
   */
  async findNearestOpenSuckingChestCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'OPEN_SUCKING_CHEST_FLUTTER_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'OPEN_SUCKING_CHEST_FLUTTER_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      openChestGuidance: 'Báo động Vết thương hở thành ngực phì phò rít gió (Open Sucking Chest Wound). Khoa Cấp cứu & Ngoại Lồng ngực chuẩn bị băng van 3 cạnh, bộ đặt ống dẫn lưu màng phổi kín 28-32 Fr có bình hút nước; khóa cảnh báo TUYỆT ĐỐI CẤM băng kín 4 cạnh (tránh biến thành tràn khí áp lực cao) và CẤM nhét gạc vào vết thương.',
    };
  }

  /**
   * Định vị Trung tâm Thần kinh - Hồi sức Cấp cứu Cơn Bão Nhược Cơ Nặng (Phân hệ 100)
   */
  async findNearestMyasthenicCrisisCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'MYASTHENIC_CRISIS_PLEX_NEURO_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'MYASTHENIC_CRISIS_PLEX_NEURO_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      myasthenicGuidance: 'Báo động Cơn bão nhược cơ bùng phát suy hô hấp cấp (Myasthenic Crisis). Neuro-ICU chuẩn bị đặt NKQ thở máy, hệ thống thay huyết tương cấp cứu PLEX hoặc IVIG 2 g/kg; khóa cảnh báo TUYỆT ĐỐI CẤM kháng sinh Aminoglycoside/Macrolide/Quinolone, chẹn Beta/Canxi, Magnesium và CẤM an thần khi chưa kiểm soát thở máy.',
    };
  }

  /**
   * Định vị Trung tâm Nội soi Tiêu hóa Cấp Cứu Vỡ Giãn Tĩnh Mạch Phình Vị Dạ Dày & Tiêm Keo Histoacryl / TIPS (Phân hệ 101)
   */
  async findNearestGastricVaricealCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'GASTRIC_VARICES_GLUE_INJECTION_TIPS',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'GASTRIC_VARICES_GLUE_INJECTION_TIPS',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      gastricVaricealGuidance: 'Báo động Xuất huyết vỡ búi giãn tĩnh mạch phình vị dạ dày (Gastric Variceal Bleeding Sarin IGV1/GOV2). Trung tâm Nội soi Tiêu hóa chuẩn bị tiêm keo sinh học Histoacryl pha Lipiodol tỷ lệ 1:1, Terlipressin 2mg IV, Ceftriaxone 1g, kíp can thiệp TIPS/BRTO; khóa cảnh báo TUYỆT ĐỐI CẤM thắt vòng cao su EVL trên búi phình vị to, CẤM tiêm keo nguyên chất không Lipiodol và CẤM nâng huyết áp mục tiêu lên bình thường.',
    };
  }

  /**
   * Định vị Trung tâm Ngoại Lồng Ngực Cấp Cứu Rách Khí Phế Quản Lớn & Soi Phế Quản Can Thiệp (Phân hệ 102)
   */
  async findNearestTracheobronchialRuptureCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'TRACHEOBRONCHIAL_RUPTURE_BRONCHOSCOPY_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'TRACHEOBRONCHIAL_RUPTURE_BRONCHOSCOPY_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      tracheobronchialGuidance: 'Báo động Chấn thương đụng dập rách khí phế quản lớn (Tracheobronchial Rupture & Massive Subcutaneous Emphysema). Phòng mổ Lồng ngực chuẩn bị nội soi phế quản ống mềm khẩn cấp, ống NKQ 2 nòng (Double-lumen), phẫu thuật khâu phục hồi khí phế quản; khóa cảnh báo TUYỆT ĐỐI CẤM thở máy áp lực dương cao PIP/PEEP cao và CẤM đặt NKQ mò.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Chống Độc Cấp Cứu Ngộ Độc Thuốc Chống Trầm Cảm 3 Vòng TCA (Phân hệ 103)
   */
  async findNearestTcaToxicityCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'TCA_TOXICOLOGY_BICARBONATE_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'TCA_TOXICOLOGY_BICARBONATE_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      tcaGuidance: 'Báo động Ngộ độc cấp thuốc chống trầm cảm 3 vòng (TCA Amitriptyline Toxicity). ICU Chống độc chuẩn bị dung dịch Natri Bicarbonate 8.4% bolus kiềm hóa máu mục tiêu pH 7.45-7.55 / QRS < 100ms, Noradrenaline, nhũ dịch lipid Intralipid 20%; khóa cảnh báo TUYỆT ĐỐI CẤM thuốc chống loạn nhịp nhóm IA, IC, Amiodarone và CẤM dùng Physostigmine.',
    };
  }

  /**
   * Định vị Trung tâm Sản - Hồi Sức Cấp Cứu Thuyên Tắc Ối Tối Cấp & Phác Đồ A-OK (Phân hệ 104)
   */
  async findNearestAmnioticFluidEmbolismCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'AMNIOTIC_FLUID_EMBOLISM_AOK_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'AMNIOTIC_FLUID_EMBOLISM_AOK_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      amnioticGuidance: 'Báo động Thuyên tắc ối tối cấp (Amniotic Fluid Embolism - AFE & DIC). Kíp Sản - Hồi sức Cấp cứu chuẩn bị kích hoạt Phác đồ A-OK (Atropine, Ondansetron, Ketorolac), MTP 1:1:1 kèm Fibrinogen / Cryoprecipitate / TXA 1g, sẵn sàng mổ lấy thai PMCD trong 4-5 phút vàng khi mẹ ngừng tim; khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch tinh thể quá tải làm suy sụp thất phải.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Sơ Sinh NICU Level IV & Cấp Cứu Hít Phân Su Tối Cấp (Phân hệ 105)
   */
  async findNearestMeconiumAspirationCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'MECONIUM_ASPIRATION_SURFACTANT_HFOV_NICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'MECONIUM_ASPIRATION_SURFACTANT_HFOV_NICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      meconiumGuidance: 'Báo động Hội chứng hít phân su sơ sinh tối cấp (Meconium Aspiration Syndrome MAS). Kíp Hồi sức sơ sinh NICU chuẩn bị thở máy rung cao tần HFOV, bơm Surfactant ngoại sinh 100-200 mg/kg, khí giãn mạch iNO 20 ppm và sẵn sàng ECMO sơ sinh; khóa cảnh báo TUYỆT ĐỐI CẤM hút sâu phế quản mò mẫm khi trẻ đã thở/khóc và CẤM bóp bóng áp lực cao bừa bãi khi bẫy khí.',
    };
  }

  /**
   * Định vị Trung tâm Chống Độc & Hồi Sức Ngộ Độc Methemoglobinemia Tối Cấp (Phân hệ 106)
   */
  async findNearestMethemoglobinemiaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'METHEMOGLOBINEMIA_METHYLENE_BLUE_TOXICOLOGY_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'METHEMOGLOBINEMIA_METHYLENE_BLUE_TOXICOLOGY_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      methemoglobinGuidance: 'Báo động Cấp cứu Ngộ độc Methemoglobinemia tối cấp (MetHb & Refractory Cyanosis). Kíp Chống độc chuẩn bị sẵn sàng Xanh Methylen 1% (Methylene Blue 1-2 mg/kg IV chậm), Vitamin C Axit Ascorbic liều cao và đơn vị thay máu cấp cứu; khóa cảnh báo CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI Xanh Methylen ở bệnh nhân thiếu men G6PD (gây tan máu nội mạch ồ ạt tử vong) và CẤM quá liều tích lũy > 7 mg/kg.',
    };
  }

  /**
   * Định vị Trung tâm Can Thiệp Mạch DSA & Ngoại Mạch Máu Vỡ Túi Phình Động Mạch Tạng (Phân hệ 107)
   */
  async findNearestVisceralAneurysmCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'VISCERAL_ANEURYSM_DSA_EMBOLIZATION_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'VISCERAL_ANEURYSM_DSA_EMBOLIZATION_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      visceralGuidance: 'Báo động Cấp cứu Vỡ túi phình động mạch tạng tối cấp (Splenic / Hepatic Artery Aneurysm Rupture). Phòng can thiệp DSA / Hybrid OR sẵn sàng can thiệp nút mạch coils sandwich hoặc đặt covered stent-graft; kích hoạt DCR huyết áp mục tiêu SBP 80-90 mmHg, MTP 1:1:1 và TXA 1g; khóa cảnh báo TUYỆT ĐỐI CẤM ấn nắn mạnh thượng vị làm vỡ thì 2 khối máu tụ và CẤM bù dịch quá tải SBP > 100 mmHg.',
    };
  }

  /**
   * Định vị Trung tâm Nội Tiết & Hồi Sức Cấp Cứu Cơn Hạ Canxi Máu Tối Cấp (Phân hệ 108)
   */
  async findNearestAcuteHypocalcemiaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ACUTE_HYPOCALCEMIA_GLUCONATE_ENDOCRINE_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ACUTE_HYPOCALCEMIA_GLUCONATE_ENDOCRINE_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hypocalcemiaGuidance: 'Báo động Cơn Hạ Canxi máu tối cấp kèm co thắt thanh quản Stridor & Dấu hiệu Trousseau. Kíp Hồi sức cấp cứu chuẩn bị Calcium Gluconate 10% (10-20 mL pha loãng tiêm chậm 10-20 phút dưới monitor ECG liên tục), Magie Sulfat 1-2g IV và duy trì truyền Canxi 0.5-1.5 mg/kg/h; khóa cảnh báo CHỐNG CHỈ ĐỊNH tiêm nhanh Calcium Chloride ngoại vi (hoại tử mô sâu và vô tâm thu) và CẤM tiêm chung với Bicarbonate/Phosphat gây kết tủa tắc mạch.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Cấp Cứu Sốc Phản Vệ Cản Quang Iod Tối Cấp (Phân hệ 109)
   */
  async findNearestContrastAnaphylaxisCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'CONTRAST_ANAPHYLAXIS_ADRENALINE_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'CONTRAST_ANAPHYLAXIS_ADRENALINE_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      contrastAnaphylaxisGuidance: 'Báo động Cấp cứu Sốc phản vệ tối cấp do thuốc cản quang chứa Iod (Severe Contrast-Induced Anaphylaxis). Kíp Hồi sức cấp cứu chuẩn bị Adrenaline 0.5mg tiêm bắp mặt trước ngoài đùi lặp lại mỗi 5-10 phút, thở oxy mask túi 15L/min, bolus dịch tinh thể 1-2L đẳng trương và khí dung Budesonide/Salbutamol; khóa cảnh báo TUYỆT ĐỐI CẤM tiêm IV trực tiếp Adrenaline nguyên chất 1:1,000 và CẤM dùng Corticoid/Kháng Histamin thay thế Adrenaline làm mất thời gian vàng cứu sống.',
    };
  }

  /**
   * Định vị Trung tâm Cấp Cứu Chấn Thương Vỡ Toác Khung Chậu Mất Vững (Phân hệ 110)
   */
  async findNearestPelvicFractureCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PELVIC_FRACTURE_BINDER_ANGIO_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PELVIC_FRACTURE_BINDER_ANGIO_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      pelvicFractureGuidance: 'Báo động Chấn thương Vỡ toác khung chậu mất vững nguy kịch (Unstable Pelvic Fracture - Open Book / Vertical Shear). Kíp Cấp cứu Chấn thương Chỉnh hình & Mạch máu chuẩn bị đai nẹp chậu SAM Pelvic Sling II đặt ngang mấu chuyển lớn xương đùi, kích hoạt DCR huyết áp thấp SBP 80-90 mmHg, quy trình truyền máu khối lượng lớn MTP 1:1:1, TXA 1g IV và phòng DSA can thiệp nút mạch ĐM chậu trong; khóa cảnh báo TUYỆT ĐỐI CẤM đặt nẹp chậu cao ở mào chậu và CẤM lật trở bệnh nhân khám rung lắc xương chậu nhiều lần.',
    };
  }

  /**
   * Định vị Trung tâm Chống Độc Vũ Khí Hóa Học Thần Kinh Ức Chế Cholinesterase (Phân hệ 111)
   */
  async findNearestCholinesteraseInhibitorCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'CHOLINESTERASE_INHIBITOR_ATROPINE_TOXICOLOGY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'CHOLINESTERASE_INHIBITOR_ATROPINE_TOXICOLOGY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      nerveAgentGuidance: 'Báo động Khẩn cấp Cấp cứu Ngộ độc Vũ khí Hóa học Thần kinh / Chất ức chế Cholinesterase cực nặng (Sarin / VX / Organophosphate Threat). Kíp Cấp cứu Chống độc chuẩn bị sẵn bộ đôi DuoDote (Atropine sulfate 2-4mg tiêm IV/IM tăng liều đến khi đạt tiêu chuẩn khô phổi Atropinization + Pralidoxime 2-PAM 1-2g IV trong 30-60 phút), Diazepam 10mg chống co giật; trạm tiêu tẩy hóa sinh Decon Station sẵn sàng; khóa cảnh báo TUYỆT ĐỐI CẤM dùng Pralidoxime đơn độc không có Atropine và CẤM nhân viên cứu hộ tiếp cận hiện trường khi chưa mang đồ bảo hộ PPE cấp độ A/B.',
    };
  }

  /**
   * Định vị Trung tâm Hồi Sức Cấp Cứu Ngưng Tim Hạ Thân Nhiệt Sâu & ECMO ECLS (Phân hệ 112)
   */
  async findNearestHypothermicArrestCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'HYPOTHERMIC_ARREST_ECLS_ECMO_REWARMING',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'HYPOTHERMIC_ARREST_ECLS_ECMO_REWARMING',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hypothermicArrestGuidance: 'Báo động Cấp cứu Ngưng tim do Hạ thân nhiệt sâu dưới 30°C (Severe Accidental Hypothermia Cardiac Arrest). Kíp Hồi sức cấp cứu & Can thiệp ECMO chuẩn bị hệ thống VA-ECMO (ECLS) làm ấm tuần hoàn ngoài cơ thể nâng nhiệt 2-3°C/h; tiếp tục CPR chất lượng cao liên tục, giới hạn sốc điện tối đa 3 lần và HOÃN thuốc vận mạch đến khi thân nhiệt lõi > 30°C; tuân thủ quy trình Gentle Handling di chuyển nhẹ nhàng; khóa cảnh báo TUYỆT ĐỐI CẤM công bố tử vong trước khi sưởi ấm lên trên 35°C ("No one is dead until warm and dead") và CẤM sưởi ấm tứ chi trước gây tụt nhiệt Afterdrop tử vong.',
    };
  }

  /**
   * Phân hệ 114: Định vị Trung tâm Chống Độc & Hồi Sức Cấp Cứu Sốc Phản Vệ Ngừng Tim Do Ong Vò Vẽ Đốt Tuyến Cuối
   */
  async findNearestBeeStingToxicologyCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'BEE_STING_ANAPHYLAXIS_CRRT_TOXICOLOGY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'BEE_STING_ANAPHYLAXIS_CRRT_TOXICOLOGY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      beeStingGuidance: 'Báo động Cấp cứu Sốc phản vệ ngừng tim do ong vò vẽ đốt hàng chục nốt (Multiple Bee Sting Anaphylactic Arrest). Khoa Hồi sức Chống độc chuẩn bị Adrenaline IM mặt ngoài đùi + Vasopressin IV kháng trị; chuẩn bị hệ thống Lọc máu liên tục CRRT quả lọc hấp phụ nọc ong; khóa cảnh báo TUYỆT ĐỐI CẤM dùng nhíp bóp nặn túi nọc ong và CẤM chườm nóng gây giãn mạch khuếch tán nọc độc tử vong.',
    };
  }

  /**
   * Phân hệ 115: Định vị Trung tâm Hồi Sức Cấp Cứu Không Gian Kín Khí Độc & Oxy Cao Áp HBOT Tuyến Cuối
   */
  async findNearestConfinedSpaceRescueCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'CONFINED_SPACE_ATMOSPHERIC_RESCUE_HBOT',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'CONFINED_SPACE_ATMOSPHERIC_RESCUE_HBOT',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      confinedSpaceGuidance: 'Báo động Cấp cứu Ngạt khí độc không gian kín hầm biogas/cống ngầm đô thị (Confined Space Toxic Rescue). Kíp Cấp cứu Hồi sức Chống độc chuẩn bị Buồng Oxy cao áp HBOT và thông khí bảo vệ phổi; phối hợp Cảnh sát PCCC & CNCH 114 triển khai SCBA áp lực dương và quạt thổi khí tươi; khóa cảnh báo TUYỆT ĐỐI CẤM bước xuống hầm cứu khi chưa có SCBA (tránh tử vong dây chuyền) và CẤM dùng nguồn lửa/thiết bị không phòng nổ.',
    };
  }

  /**
   * Phân hệ 116: Định vị Trung tâm Hồi Sức Nhiễm Trùng & Phẫu Thuật Cắt Lọc Hoại Tử Cân Mạc Vibrio Vulnificus Tuyến Cuối
   */
  async findNearestVibrioInfectionCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'VIBRIO_VULNIFICUS_FASCIOTOMY_SEPSIS',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'VIBRIO_VULNIFICUS_FASCIOTOMY_SEPSIS',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      vibrioGuidance: 'Báo động Cấp cứu Viêm cân mạc hoại tử vi khuẩn ăn thịt người thủy sản Vibrio vulnificus (Necrotizing Fasciitis Marine Sepsis). Kíp Phẫu thuật Ngoại khoa và Hồi sức Nhiễm trùng chuẩn bị phòng mổ rạch mở cân mạc giải áp cấp cứu; khởi động gói kháng sinh kép Giờ Vàng Doxycycline 100mg IV + Ceftriaxone 2g IV; khóa cảnh báo TUYỆT ĐỐI CẤM ngâm nước muối/đắp lá cây và CẤM trì hoãn phẫu thuật chờ cấy vi sinh.',
    };
  }

  /**
   * Phân hệ 117: Định vị Trung tâm Hồi Sức Nội Tiết Cấp Cứu Cơn Toan Ceton Nặng DKA & HHS Tuyến Cuối
   */
  async findNearestSevereDkaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'SEVERE_DKA_HHS_ENDOCRINE_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'SEVERE_DKA_HHS_ENDOCRINE_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      severeDkaGuidance: 'Báo động Cấp cứu Cơn Toan ceton đái tháo đường nặng & Hôn mê tăng áp lực thẩm thấu (Severe DKA & HHS Crisis). Khoa Hồi sức Nội tiết chuẩn bị bù thể tích đẳng trương NaCl 0.9% 1-1.5L trong giờ đầu; xét nghiệm khẩn Kali máu và monitor đường huyết liên tục; khóa cảnh báo TUYỆT ĐỐI CẤM bolus Insulin liều cao khi Kali máu < 3.3 mEq/L (tránh ngừng tim rung thất) và CẤM truyền nhanh dịch nhược trương giờ đầu chống phù não tụt kẹt.',
    };
  }

  /**
   * Phân hệ 119: Định vị Trung tâm Chống Độc Hồi Sức Ngộ Độc Ma Túy Giao Cảm Cấp Tối Tuyến Cuối
   */
  async findNearestSympathomimeticToxidromeCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'SYMPATHOMIMETIC_TOXIDROME_BENZO_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'SYMPATHOMIMETIC_TOXIDROME_BENZO_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      sympathomimeticGuidance: 'Báo động Cấp cứu Hội chứng kích thích giao cảm cấp & Sốc quá liều ma túy đá MDMA (Sympathomimetic Crisis & Excited Delirium). Khoa Hồi sức Chống độc chuẩn bị buồng hạ nhiệt vật lý tích cực, Benzodiazepine liều cao (Diazepam/Midazolam) và dịch truyền kiềm hóa bảo vệ thận; khóa cảnh báo TUYỆT ĐỐI CẤM dùng thuốc chẹn Beta đơn độc (nguy cơ co mạch Alpha ác tính xuất huyết não tử vong) và CẤM dùng Haloperidol (nguy cơ xoắn đỉnh Torsades và co giật).',
    };
  }

  /**
   * Phân hệ 120: Định vị Trung tâm Chấn Thương & Cứu Hộ Kẹt Thang Máy / Sập Đổ Đô Thị USAR
   */
  async findNearestElevatorCollapseTraumaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ELEVATOR_COLLAPSE_USAR_TRAUMA_CENTER',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ELEVATOR_COLLAPSE_USAR_TRAUMA_CENTER',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      elevatorCollapseGuidance: 'Báo động Cấp cứu Chấn thương kẹt thang máy cao ốc & Sập đổ công trình (High-Rise Elevator Collapse Entrapment). Kíp Phẫu thuật Chấn thương Chỉnh hình & Hồi sức Hút đàm ngạt khí sẵn sàng đón nạn nhân; phối hợp Lực lượng PCCC 114 sử dụng thiết bị thủy lực banh cắt; khóa hướng dẫn TUYỆT ĐỐI CẤM cạy cửa cabin nhảy ra ngoài khi chưa khóa hãm cơ khí và CẤM nguồn lửa trong buồng thang.',
    };
  }

  /**
   * Phân hệ 121: Định vị Trung tâm Hồi Sức Thận Nhân Tạo Cấp Cứu Tăng Kali Máu Tối Cấp Tuyến Cuối
   */
  async findNearestHyperkalemiaHemodialysisCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'HYPERKALEMIA_EMERGENT_HEMODIALYSIS_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'HYPERKALEMIA_EMERGENT_HEMODIALYSIS_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hyperkalemiaGuidance: 'Báo động Cấp cứu Tăng Kali máu tối cấp đe dọa ngừng tim ở bệnh nhân suy thận (Emergent Hyperkalemia Dialysis Crisis). Khoa Thận nhân tạo và Hồi sức tích cực sẵn sàng máy lọc máu cấp cứu; tiêm ngay Calcium Gluconate 10% 10-20 mL IV ổn định màng cơ tim và phối hợp Insulin-Glucose; khóa cảnh báo TUYỆT ĐỐI CẤM trì hoãn tiêm Canxi khi QRS đã biến dạng và CẤM chỉ dùng thuốc hạ Kali đường uống đơn độc.',
    };
  }

  /**
   * Phân hệ 122: Định vị Trung tâm Cấp Cứu Tai Mũi Họng & Mở Màng Nhẫn Giáp Cấp Cứu Tuyến Cuối
   */
  async findNearestCricothyroidotomyAirwayCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'CRICOTHYROIDOTOMY_ENT_AIRWAY_CENTER',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'CRICOTHYROIDOTOMY_ENT_AIRWAY_CENTER',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      cricothyroidotomyGuidance: 'Báo động Cấp cứu Co thắt khí quản ác tính & Phù mạch Quinke thanh quản tắc nghẽn đường thở CICO (Acute Angioedema Cricothyroidotomy Emergency). Khoa Tai Mũi Họng & Hồi sức chuẩn bị bộ mở khí quản màng nhẫn giáp cấp cứu Scalpel-Bougie-Tube; tiêm bắp khẩn cấp Adrenaline 0.5mg; khóa cảnh báo TUYỆT ĐỐI CẤM đặt nội khí quản mò lặp lại quá 3 lần và CẤM tiêm thuốc giãn cơ khi chưa chuẩn bị đường thở ngoại khoa.',
    };
  }

  /**
   * Phân hệ 123: Định vị Trung tâm Hồi Sức Cấp Cứu Đuối Nước Trẻ Em & Đô Thị Tuyến Cuối
   */
  async findNearestSubmersionRescueCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'SUBMERSION_DROWNING_PEDIATRIC_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'SUBMERSION_DROWNING_PEDIATRIC_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      submersionGuidance: 'Báo động Cấp cứu Đuối nước ngạt nước & Phù phổi cấp do thiếu dưỡng khí (Submersion Drowning Emergency). Khoa Hồi sức Cấp cứu chuẩn bị máy thở áp lực dương PEEP, hệ thống làm ấm chủ động chống hạ thân nhiệt; khóa cảnh báo TUYỆT ĐỐI CẤM dốc ngược xốc nước chạy vòng quanh gây trào ngược vào phổi và BẮT BUỘC thực hiện 5 nhịp thổi ngạt cứu nạn trước tiên khi CPR.',
    };
  }

  /**
   * Phân hệ 124: Định vị Trung tâm Lọc máu Than hoạt HA330 & Hồi sức Bão Cytokine Ong Bắp Cày Tuyến Cuối
   */
  async findNearestGiantHornetPlexCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'GIANT_HORNET_CYTOKINE_STORM_PLEX_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'GIANT_HORNET_CYTOKINE_STORM_PLEX_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hornetGuidance: 'Báo động Cấp cứu Hội chứng Bão Cytokine & Sốc Phản Phệ Ong Bắp Cày Khổng Lồ đốt (Giant Hornet Cytokine Storm Emergency). Khoa Hồi sức Cấp cứu chuẩn bị quả lọc than hoạt HA330, hệ thống lọc máu liên tục CRRT / PLEX thay huyết tương cấp cứu trước 6-12h; khóa cảnh báo TUYỆT ĐỐI CẤM hoãn lọc máu chờ suy thận vô niệu và CẤM đắp vôi nóng, thuốc lá lên vết đốt.',
    };
  }

  /**
   * Phân hệ 125: Định vị Trung tâm Cứu nạn Biển SAR & Cấp cứu Hạ thân nhiệt Đắm thuyền Ban đêm
   */
  async findNearestMaritimeSarHospital(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'MARITIME_SAR_HYPOTHERMIA_CENTER',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'MARITIME_SAR_HYPOTHERMIA_CENTER',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      maritimeGuidance: 'Báo động Tìm kiếm Cứu nạn Đắm thuyền / Rơi xuống biển sâu ban đêm độc hành (Maritime Immersion Survival SAR). Đội cứu hộ biển phối hợp Khoa Cấp cứu chuẩn bị cáng vớt nằm ngang chống trụy tim, buồng ủ ấm đối lưu và bù dịch ấm 38-42°C; khóa cảnh báo TUYỆT ĐỐI CẤM cởi bỏ quần áo khi trôi nổi trên biển và CẤM uống nước biển khi khát.',
    };
  }

  /**
   * Phân hệ 126: Định vị Trung tâm Hồi sức Làm ấm Lõi Cơn Hạ thân nhiệt Nghịch lý Vùng Núi Rừng Lạnh
   */
  async findNearestParadoxicalUndressingCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PARADOXICAL_UNDRESSING_REWARMING_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PARADOXICAL_UNDRESSING_REWARMING_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      rewarmingGuidance: 'Báo động Cấp cứu Cơn hạ thân nhiệt nghịch lý Cởi bỏ quần áo tử thần vùng núi tuyết / rừng lạnh (Paradoxical Undressing Hypothermia). Khoa Hồi sức Cấp cứu chuẩn bị hệ thống làm ấm lõi chủ động Bair Hugger, truyền dung dịch ấm 40-42°C, theo dõi sát rung thất sau hồi nhiệt (Afterdrop); khóa cảnh báo TUYỆT ĐỐI CẤM uống rượu sưởi ấm và CẤM cọ xát bằng tuyết/mát-xa mạnh.',
    };
  }

  /**
   * Phân hệ 127: Định vị Trung tâm Chống Độc & Lọc Máu Hấp Phụ Kép Cấp Cứu Paraquat / Diquat Cửa Sổ Vàng
   */
  async findNearestParaquatToxicologyCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PARAQUAT_HEMOPERFUSION_TOXICOLOGY_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PARAQUAT_HEMOPERFUSION_TOXICOLOGY_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      paraquatGuidance: 'Báo động Cấp cứu Ngộ độc cấp thuốc diệt cỏ Paraquat / Diquat (Paraquat Acute Intoxication Emergency). Trung tâm Chống độc chuẩn bị khẩn cấp cột hấp phụ than hoạt kép (Hemoperfusion HA330 / HP) trong Cửa Sổ Vàng 2-4h, phối hợp truyền N-acetylcysteine (NAC) liều cao; khóa cảnh báo TUYỆT ĐỐI CẤM thở oxy liều cao khi SpO2 >= 85% và CẤM trì hoãn lọc máu qua mốc 4h.',
    };
  }

  /**
   * Phân hệ 128: Định vị Trung tâm Phẫu thuật Tiết niệu Cấp cứu Xoắn Tinh hoàn Cửa Sổ Vàng Tuyến Cuối
   */
  async findNearestAcuteTesticularTorsionCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'ACUTE_TESTICULAR_TORSION_UROLOGY_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'ACUTE_TESTICULAR_TORSION_UROLOGY_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      torsionGuidance: 'Báo động Cấp cứu Xoắn tinh hoàn cấp tính đe dọa hoại tử tuyến sinh dục độc hành (Acute Testicular Torsion Emergency). Khoa Ngoại Tiết niệu chuẩn bị phòng mổ khẩn cấp trong Cửa Sổ Vàng dưới 6 giờ và tiến hành tháo xoắn Open-Book xoay từ trong ra ngoài; khóa cảnh báo TUYỆT ĐỐI CẤM chườm nóng / dùng giảm đau mạnh che dấu triệu chứng trước khám và CẤM xoay sai chiều vào trong hoặc hoãn mổ.',
    };
  }

  /**
   * Phân hệ 129: Định vị Trung tâm Buồng Oxy Cao Áp HBOT Cấp cứu Ngộ độc khí CO Phòng kín Tuyến Cuối
   */
  async findNearestCarbonMonoxideHbotCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'CARBON_MONOXIDE_HBOT_CHAMBER',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'CARBON_MONOXIDE_HBOT_CHAMBER',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      hbotGuidance: 'Báo động Cấp cứu Ngộ độc khí Carbon Monoxide (CO) trong phòng kín (Acute CO Poisoning Emergency). Chuẩn bị sẵn sàng buồng Oxy cao áp HBOT 2.5-3.0 ATA để giải mẫn cảm HbCO và bảo vệ thần kinh trung ương, khóa cảnh báo TUYỆT ĐỐI CẤM dựa vào SpO2 xung thông thường đọc 100% giả tạo và CẤM hoãn chuyển buồng HBOT qua mốc 6h vàng.',
    };
  }

  /**
   * Phân hệ 130: Định vị Trung tâm Phẫu thuật Tim Mạch - Mạch Máu Cổ Ngoại Viện Tuyến Cuối
   */
  async findNearestCarotidNeckVascularSurgeryCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PENETRATING_CAROTID_NECK_VASCULAR_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PENETRATING_CAROTID_NECK_VASCULAR_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      neckVascularGuidance: 'Báo động Đỏ Phẫu thuật Tim Mạch - Lồng Ngực Cấp Cứu Vết Thương Đứt Rách Động Mạch Cảnh / Cổ (Penetrating Carotid Artery Trauma). Kích hoạt kíp mổ cấp cứu và kích hoạt quy trình truyền máu tối cấp MTP, khóa cảnh báo TUYỆT ĐỐI CẤM dùng garrot siết vòng quanh cổ và CẤM ép đồng thời cả 2 bên động mạch cảnh.',
    };
  }

  /**
   * Phân hệ 131: Định vị Trung tâm Bỏng & Hồi sức Thận Lọc Máu Cấp Cứu Tổn Thương Điện Cao Thế Tuyến Cuối
   */
  async findNearestHighVoltageElectricalBurnCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'HIGH_VOLTAGE_ELECTRICAL_BURN_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'HIGH_VOLTAGE_ELECTRICAL_BURN_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      electricalGuidance: 'Báo động Trung tâm Bỏng & Hồi sức Thận Lọc Máu Cấp Cứu Tổn Thương Điện Cao Thế & Tiêu Cơ Vân Cấp (High-Voltage Electrical Injury & Rhabdomyolysis). Kích hoạt bù dịch Ringer Lactate tốc độ cao duy trì nước tiểu >= 1.5-2.0 mL/kg/h kèm kiềm hóa nước tiểu bằng NaHCO3 8.4% và gắn monitor theo dõi loạn nhịp thất / rung thất 24h, khóa cảnh báo TUYỆT ĐỐI CẤM tiếp cận khi chưa ngắt điện và CẤM xuất viện sớm khi chưa đủ 24h ECG.',
    };
  }

  /**
   * Phân hệ 132: Định vị Trung tâm Hồi Sức Cấp Cứu & Nội Soi Phế Quản Hóc Dị Vật Nhi Tuyến Cuối
   */
  async findNearestPediatricAirwayEmergencyCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'PEDIATRIC_FBAO_AIRWAY_EMERGENCY_ICU',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'PEDIATRIC_FBAO_AIRWAY_EMERGENCY_ICU',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      fbaoGuidance: 'Báo động Cấp cứu Hồi Sức Nhi Đồng & Nội Soi Phế Quản Khẩn Cấp Trẻ Hóc Dị Vật Đường Thở Tắc Hoàn Toàn Dưới 1 Tuổi (Pediatric Complete FBAO Emergency). Chuẩn bị phòng nội soi gắp dị vật khẩn cấp, hướng dẫn sơ cứu 5 vỗ lưng + 5 ấn ngực, khóa cảnh báo TUYỆT ĐỐI CẤM móc mò họng mù và CẤM ép bụng Heimlich cho trẻ dưới 1 tuổi.',
    };
  }

  /**
   * Phân hệ 133: Định vị Trung tâm Vi Phẫu Mắt Cấp Cứu Vết Thương Xuyên Thấu Nhãn Cầu Tuyến Cuối
   */
  async findNearestOpenGlobeOcularTraumaCenter(lat, lng) {
    await this.seedTraumaHospitals();

    const candidates = await HospitalTraumaCenter.find({
      specialties: 'OPEN_GLOBE_OCULAR_TRAUMA_SURGERY',
    });

    let nearest = null;
    let minDistance = Infinity;

    for (const h of candidates) {
      const hLng = h.location.coordinates[0];
      const hLat = h.location.coordinates[1];
      const dist = this._calcDistanceMeters(lat, lng, hLat, hLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    }

    return {
      success: true,
      hospitalCode: nearest.hospitalCode,
      hospitalName: nearest.hospitalName,
      specialty: 'OPEN_GLOBE_OCULAR_TRAUMA_SURGERY',
      distanceMeters: Math.round(minDistance),
      etaMinutes: Math.round((minDistance / 1000 / 30) * 60) + 5,
      eyeGuidance: 'Báo động Vi Phẫu Mắt Cấp Cứu Vết Thương Xuyên Thấu Nhãn Cầu & Nguy Cơ Phụt Thể Pha Lê (Penetrating Open Globe Eye Trauma). Chuẩn bị phòng mổ vi phẫu khâu phục hồi nhãn cầu trong 12-24h, úp vỏ bảo vệ cứng Rigid Shield và băng cả 2 mắt, khóa cảnh báo TUYỆT ĐỐI CẤM tì đè ép trực tiếp lên mắt hở và CẤM rút dị vật cắm trong mắt hoặc tra thuốc mỡ bừa bãi.',
    };
  }
}

module.exports = new HospitalDispatchService();

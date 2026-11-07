const crypto = require('crypto');
const mongoose = require('mongoose');

const ACTIVE_STATUSES = [
  'ACTIVE',
  'TRIGGERED',
  'DISPATCHING_R1',
  'DISPATCHING_R2',
  'ACCEPTED',
  'EN_ROUTE',
  'ON_SCENE',
];

const RescueIncidentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    victimId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: [
        'ACTIVE', // Legacy & general active
        'TRIGGERED', // Vừa kích hoạt, đang đếm ngược
        'DISPATCHING_R1', // Đang quét bán kính Vòng 1 (1.2km)
        'DISPATCHING_R2', // Đang quét bán kính Vòng 2 (4.5km)
        'ACCEPTED', // Hiệp sĩ đã nhận (Atomic lock)
        'EN_ROUTE', // Hiệp sĩ đang di chuyển đến
        'ON_SCENE', // Hiệp sĩ đã có mặt (< 25m)
        'HANDED_OVER_115', // Đã bàn giao bác sĩ/công an
        'RESOLVED_SAFE', // Nạn nhân an toàn, hoàn tất
        'ESCALATED_115', // Hết thời gian chờ, chuyển tổng đài 115
        'CANCELLED_FALSE_ALARM', // Hủy do báo động giả
        'RECONCILED_TIMEOUT', // Tự động đối soát và giải tỏa do hết hạn/kẹt
        'RESOLVED', // Legacy resolved
      ],
      default: 'ACTIVE',
      index: true,
    },
    incidentType: { type: String, required: true },
    severity: { type: Number, default: 3 }, // 1: P0_SILENT, 2: P1_CRITICAL, 3: P2_URGENT, 4: P3_ASSIST
    severityLevel: {
      type: String,
      enum: ['P0_SILENT', 'P1_CRITICAL', 'P2_URGENT', 'P3_ASSIST', 'P0_CRITICAL_LIFE_THREAT'],
      default: 'P1_CRITICAL',
    },
    source: { type: String, default: 'SOS' },
    exactLat: { type: Number, required: true },
    exactLng: { type: Number, required: true },
    fuzzedLat: { type: Number, required: true },
    fuzzedLng: { type: Number, required: true },
    approxAddress: { type: String, default: null },
    batteryLevel: { type: Number, default: null },
    communityRequestedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },

    // Yêu cầu Năng lực Chuyên môn để Điều phối (Skill-Based Dispatch)
    requiredSkillTier: {
      type: String,
      enum: ['NONE', 'TIER_1_BLS', 'TIER_2_PHTLS', 'TIER_3_MEDIC'],
      default: 'TIER_1_BLS',
    },
    requiredSkills: [{ type: String }],

    // Thông tin Hiệp sĩ được giao nhiệm vụ
    assignedVolunteerId: { type: String, default: null, index: true },
    backupVolunteerIds: [{ type: String }],
    dispatchRadiusKm: { type: Number, default: 1.2 },

    // Kịch bản 15: Chống bẫy dàn cảnh cướp giật (Anti-Ambush & Buddy Dispatch)
    isBuddyDispatchRequired: { type: Boolean, default: false },
    buddyStatus: {
      type: String,
      enum: ['NOT_REQUIRED', 'WAITING_BUDDY', 'BUDDY_PAIRED'],
      default: 'NOT_REQUIRED',
    },
    rendezvousPoint: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      note: { type: String, default: null },
    },

    // Dữ liệu y tế của nạn nhân đóng băng tại thời điểm xảy ra sự cố (Medical Snapshot)
    medicalSnapshot: {
      bloodType: { type: String, default: 'UNKNOWN' },
      allergies: [{ type: String }],
      chronicConditions: [{ type: String }],
      emergencyNotes: { type: String, default: '' },
    },

    // Giám sát hành trình cứu hộ (Watchdog Telemetry)
    telemetry: {
      lastVictimUpdateAt: { type: Date, default: null },
      lastHeroMovementAt: { type: Date, default: null },
      heroSpeedKmh: { type: Number, default: 0 },
      distanceRemainingMeters: { type: Number, default: null },
    },

    // Lịch sử kiểm toán bất biến (Immutable Audit Trail) phục vụ pháp lý & tòa án
    auditTrail: [
      {
        action: { type: String, required: true },
        actorId: { type: String, default: null },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],

    // Biên bản bàn giao chuyên môn cho Đội ngũ Cấp cứu 115 / Cơ quan chức năng
    handoffRecord: {
      ambulancePlate: { type: String, default: null },
      paramedicName: { type: String, default: null },
      handedOverAt: { type: Date, default: null },
      qrVerificationHash: { type: String, default: null },
      notes: { type: String, default: '' },
      sbarSummary: {
        situation: { type: String, default: '' },
        background: { type: String, default: '' },
        assessment: { type: String, default: '' },
        recommendation: { type: String, default: '' },
      },
    },

    evidenceAudioUrl: { type: String, default: null },
    legalConsentSigned: { type: Boolean, default: true },
    legalConsentSignedAt: { type: Date, default: Date.now },

    // 1. Vi địa chỉ căn hộ / phòng trọ & Chỉ dẫn tiếp cận khẩn cấp
    microLocation: {
      buildingName: { type: String, default: '' },
      roomNumber: { type: String, default: '' },
      floorNumber: { type: String, default: '' },
      doorCode: { type: String, default: '' },
      landlordPhone: { type: String, default: '' },
      securityPhone: { type: String, default: '' },
      accessNotes: { type: String, default: '' },
    },

    // 2. Lệnh can thiệp cứu sinh cấp bách (Điều 23 BLHS - Tình thế cấp thiết)
    emergencyAccessPass: {
      passCode: { type: String, default: null },
      legalBasis: {
        type: String,
        default: 'Điều 23 Bộ luật Hình sự 2015 & Điều 87 Luật Khám bệnh, chữa bệnh 2023 - Tình thế cấp thiết',
      },
      authorizedAt: { type: Date, default: null },
      isUnlockedForHero: { type: Boolean, default: false },
    },

    // 3. Đánh giá An toàn hiện trường (Scene Safety & Hazard Assessment)
    sceneSafety: {
      isAssessed: { type: Boolean, default: false },
      assessedAt: { type: Date, default: null },
      hazardFlags: [{ type: String }], // 'ELECTRICAL_HAZARD', 'GAS_LEAK', 'STRUCTURAL_COLLAPSE', 'VIOLENCE_WEAPON', 'BIOHAZARD', 'SAFE_TO_ENTER'
      isSafeToEnter: { type: Boolean, default: true },
      escalatedToService: { type: String, default: 'NONE' }, // 'NONE', '113_POLICE', '114_FIRE_RESCUE', '115_AMBULANCE'
      safetyNotes: { type: String, default: '' },
    },

    // 4. Loa ngoài hướng dẫn sơ cứu 0-Giây cho người bên cạnh (Bystander Co-Pilot)
    bystanderGuidance: {
      isActive: { type: Boolean, default: true },
      guidanceType: { type: String, default: 'CPR_AIRWAY' }, // 'CPR_AIRWAY', 'RECOVERY_POSITION', 'SEVERE_BLEEDING', 'CHOKING'
      speakerphoneAutoOn: { type: Boolean, default: true },
      metronomeBpm: { type: Number, default: 110 },
    },

    // 5. Phân loại lâm sàng siêu tốc & Gợi ý phương tiện tiếp cận
    triageCategory: {
      category: {
        type: String,
        enum: ['CARDIAC_RESPIRATORY', 'FALL_TRAUMA', 'VIOLENCE_SECURITY', 'TRAFFIC_ACCIDENT', 'GENERAL_EMERGENCY'],
        default: 'CARDIAC_RESPIRATORY',
      },
      reportedByVoice: { type: Boolean, default: false },
      mobilityRecommendation: { type: String, default: 'MOTORBIKE' },
    },

    // 6. Đánh giá Lâm sàng Chuyên môn Ngoại viện (Clinical Assessment SOP)
    clinicalAssessment: {
      avpuLevel: {
        type: String,
        enum: ['ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE', 'A', 'V', 'P', 'U', null],
        default: null,
      },
      tourniquet: {
        isApplied: { type: Boolean, default: false },
        appliedAt: { type: Date, default: null },
        limbLocation: {
          type: String,
          enum: [
            'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG',
            'Cánh tay Trái', 'Cánh tay Phải', 'Đùi Trái', 'Đùi Phải',
            null,
          ],
          default: null,
        },
        maxSafeMinutes: { type: Number, default: 120 },
      },
      cSpineStabilized: { type: Boolean, default: false },
      cSpineStabilizedAt: { type: Date, default: null },
      fastStroke: {
        faceDroop: { type: Boolean, default: false },
        armWeakness: { type: Boolean, default: false },
        speechDifficulty: { type: Boolean, default: false },
        timeOnsetMinutes: { type: Number, default: null },
        isStrokeSuspected: { type: Boolean, default: false },
      },
      cprDetails: {
        cyclesCount: { type: Number, default: 0 },
        compressionsCount: { type: Number, default: 0 },
        aedShocksCount: { type: Number, default: 0 },
      },
      news2: {
        totalScore: { type: Number, default: 0 },
        riskLevel: { type: String, default: 'LOW_RISK' },
        urgencyTier: { type: Number, default: 1 },
        parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
        actionRecommendation: { type: String, default: '' },
        evaluatedAt: { type: Date, default: null },
        evaluator: { type: String, default: '' },
      },
      hypothermiaPrevention: {
        coreTemperatureCelsius: { type: Number, default: 37.0 },
        isSpaceBlanketApplied: { type: Boolean, default: false },
        spaceBlanketAppliedAt: { type: Date, default: null },
        shockPositionApplied: { type: Boolean, default: false },
        fluidWarmingRequired: { type: Boolean, default: false },
        traumaTriadRisk: {
          type: String,
          enum: ['LOW', 'MODERATE', 'CRITICAL_LETHAL'],
          default: 'LOW',
        },
      },
      lastEvaluatedAt: { type: Date, default: null },
    },

    // 7. Biên bản Đánh giá Hậu sự cố (After-Action Review - AAR) & Tích lũy CME
    afterActionReview: {
      isReviewed: { type: Boolean, default: false },
      reviewedAt: { type: Date, default: null },
      reviewerId: { type: String, default: null },
      overallScore: { type: Number, default: 0 },
      responseTimeSeconds: { type: Number, default: 0 },
      cprQualityScore: { type: Number, default: 100 },
      sbarQualityScore: { type: Number, default: 100 },
      cmeCreditsAwarded: { type: Number, default: 0 },
      notes: { type: String, default: '' },
    },

    // 8. Giao thức Thảm họa Hàng loạt (Mass Casualty Incident - MCI) & START Triage
    mciProtocol: {
      isMCI: { type: Boolean, default: false, index: true },
      mciDeclaredBy: { type: String, default: null },
      mciDeclaredAt: { type: Date, default: null },
      casualtyCounts: {
        red: { type: Number, default: 0 },
        yellow: { type: Number, default: 0 },
        green: { type: Number, default: 0 },
        black: { type: Number, default: 0 },
      },
      startTriageTag: {
        type: String,
        enum: ['RED', 'YELLOW', 'GREEN', 'BLACK', null],
        default: null,
      },
      triageDetails: {
        canWalk: { type: Boolean, default: null },
        respirationRate: { type: Number, default: null },
        capillaryRefillSeconds: { type: Number, default: null },
        mentalStatusFollowsCommands: { type: Boolean, default: null },
        tagAssignedAt: { type: Date, default: null },
        tagAssignedBy: { type: String, default: null },
      },
    },

    // 9. Phòng Hội Chẩn Cấp Cứu Trực Tuyến (Tele-FirstAid Live 115 Consultation)
    teleConsultation: {
      isActive: { type: Boolean, default: false },
      sessionId: { type: String, default: null },
      doctorId: { type: String, default: null },
      doctorName: { type: String, default: null },
      doctorHospital: { type: String, default: null },
      startedAt: { type: Date, default: null },
      endedAt: { type: Date, default: null },
      videoStreamUrl: { type: String, default: null },
      verbalMedicalOrders: [
        {
          orderText: { type: String, required: true },
          dosageOrAction: { type: String, default: '' },
          issuedBy: { type: String, default: 'Bác sĩ trực 115' },
          issuedAt: { type: Date, default: Date.now },
          executedByVolunteer: { type: Boolean, default: false },
          executedAt: { type: Date, default: null },
        },
      ],
    },

    // 10. Liệu Pháp Oxy Y Tế Dòng Cao Ngoại Viện (High-Flow Respiratory Oxygen Therapy)
    respiratoryCare: {
      oxygenAdministered: { type: Boolean, default: false },
      flowRateLpm: { type: Number, default: 0 }, // 2-15 L/min
      deliveryMethod: {
        type: String,
        enum: ['NASAL_CANNULA', 'SIMPLE_MASK', 'NON_REBREATHER_MASK', 'AMBU_BAG', null],
        default: null,
      },
      sourceSafePointId: { type: String, default: null },
      cylinderPressureBar: { type: Number, default: null },
      preSpo2: { type: Number, default: null },
      postSpo2: { type: Number, default: null },
      startedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 11. Can Thiệp Cấp Cứu Sốc Phản Vệ Bút Tiêm Epinephrine (Anaphylaxis Protocol)
    anaphylaxisCare: {
      adrenalineInjected: { type: Boolean, default: false },
      doseMg: { type: Number, default: 0 }, // 0.3mg adult, 0.15mg child
      injectionSite: { type: String, default: 'ANTERIOR_LATERAL_THIGH' },
      injectedAt: { type: Date, default: null },
      shockPositionApplied: { type: Boolean, default: false },
      patientResponse: { type: String, default: '' },
      sourceSafePointId: { type: String, default: null },
      administeredBy: { type: String, default: null },
    },

    // 12. Điều Phối Tiếp Nhận Bệnh Viện Đích & Báo Động Tiền Viện (Trauma Center Pre-Arrival)
    hospitalPreArrival: {
      targetHospitalCode: { type: String, default: null },
      targetHospitalName: { type: String, default: null },
      recommendedReason: { type: String, default: '' },
      etaMinutes: { type: Number, default: 0 },
      notifiedAt: { type: Date, default: null },
      acknowledgedByDoctor: { type: String, default: null },
      resuscitationBayAssigned: { type: String, default: null },
      doctorPreparationNotes: { type: String, default: '' },
      status: {
        type: String,
        enum: ['NOT_DISPATCHED', 'PRE_ARRIVAL_SENT', 'HOSPITAL_ACCEPTED_BAY_READY', 'REDIRECTED', null],
        default: null,
      },
    },

    // 13. Phác Đồ Cấp Cứu Đuối Nước & Ngạt Nước (Submersion & Drowning Life Support)
    drowningCare: {
      isSubmersion: { type: Boolean, default: false },
      submersionMinutes: { type: Number, default: 0 },
      waterType: {
        type: String,
        enum: ['FRESH_WATER', 'SALT_WATER', 'CHLORINATED_POOL', null],
        default: null,
      },
      fiveInitialRescueBreathsGiven: { type: Boolean, default: false },
      breathsGivenAt: { type: Date, default: null },
      secondaryDrowningMonitoring24h: {
        active: { type: Boolean, default: false },
        startedAt: { type: Date, default: null },
        spo2Checkpoints: [
          {
            checkedAt: { type: Date, default: Date.now },
            spo2Percent: { type: Number },
            respiratoryRateBpm: { type: Number },
            note: { type: String, default: '' },
          },
        ],
        pulmonaryEdemaAlert: { type: Boolean, default: false },
      },
      administeredBy: { type: String, default: null },
    },

    // 14. Ứng Phó Say Nắng, Sốc Nhiệt Đô Thị & Hạ Thân Nhiệt Tích Cực (Heatstroke & Hyperthermia)
    heatstrokeCare: {
      isHeatstroke: { type: Boolean, default: false },
      initialCoreTempCelsius: { type: Number, default: null },
      currentCoreTempCelsius: { type: Number, default: null },
      classification: {
        type: String,
        enum: ['HEAT_EXHAUSTION', 'CLASSIC_HEATSTROKE', 'EXERTIONAL_HEATSTROKE', null],
        default: null,
      },
      activeCoolingMethods: [{ type: String }],
      antipyreticsContraindicatedAcknowledged: { type: Boolean, default: true },
      targetTempReached: { type: Boolean, default: false },
      electrolytesRehydrated: { type: Boolean, default: false },
      startedAt: { type: Date, default: null },
      cooledAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 15. Đột Quỵ Não Cấp & Thang Điểm FAST-ED Tắc Mạch Lớn LVO (Acute Stroke Life Support)
    acuteStrokeCare: {
      isSuspectedStroke: { type: Boolean, default: false },
      lastKnownWellAt: { type: Date, default: null },
      goldenWindowRemainingMinutes: { type: Number, default: 270 },
      fastEdScore: {
        facialPalsy: { type: Number, default: 0 },
        armWeakness: { type: Number, default: 0 },
        speechChanges: { type: Number, default: 0 },
        eyeDeviation: { type: Number, default: 0 },
        denialNeglect: { type: Number, default: 0 },
        totalScore: { type: Number, default: 0 },
      },
      isLargeVesselOcclusionRisk: { type: Boolean, default: false },
      strokeCodeRedActive: { type: Boolean, default: false },
      designatedStrokeCenterCode: { type: String, default: null },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 16. Cấp Cứu Rắn Cắn Độc & Thần Kinh / Huyết Học Ngoại Viện (Snakebite Triage & Pressure Immobilization)
    snakebiteCare: {
      isSnakebite: { type: Boolean, default: false },
      biteLocation: { type: String, default: 'Chi dưới' },
      snakeFamily: {
        type: String,
        enum: ['ELAPIDAE_NEUROTOXIC', 'VIPERIDAE_HEMOTOXIC', 'UNKNOWN'],
        default: 'UNKNOWN',
      },
      pressureImmobilizationApplied: { type: Boolean, default: false },
      tourniquetContraindicatedAcknowledged: { type: Boolean, default: true },
      incisionAndSuctionStrictlyProhibited: { type: Boolean, default: true },
      systemicSymptoms: {
        ptosisEyes: { type: Boolean, default: false },
        dysphagia: { type: Boolean, default: false },
        dyspnea: { type: Boolean, default: false },
        activeBleeding: { type: Boolean, default: false },
        localSwellingSpread: { type: Boolean, default: false },
      },
      antivenomHospitalRecommended: { type: String, default: null },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 17. Sơ Cứu Bỏng Nhiệt, Bỏng Hóa Chất & Bỏng Điện Đô Thị (Burn Triage, Rule of Nines & Parkland Formula)
    burnCare: {
      isBurnInjury: { type: Boolean, default: false },
      burnEtiology: {
        type: String,
        default: 'THERMAL_FLAME',
      },
      tbsaPercentage: { type: Number, default: 0 },
      totalBodySurfaceAreaPercent: { type: Number, default: 0 },
      burnDegree: {
        type: String,
        default: 'SECOND_DEGREE_PARTIAL',
      },
      waterIrrigation20MinApplied: { type: Boolean, default: false },
      coolingWithTapWater20MinDone: { type: Boolean, default: false },
      iceDirectApplicationProhibited: { type: Boolean, default: true },
      folkRemediesProhibited: { type: Boolean, default: true },
      inhalationInjurySuspected: { type: Boolean, default: false },
      parklandFormula: {
        patientWeightKg: { type: Number, default: 60 },
        totalFluid24hMl: { type: Number, default: 0 },
        total24hFluidMl: { type: Number, default: 0 },
        first8hFluidMl: { type: Number, default: 0 },
        first8hFluidRateMlPerHour: { type: Number, default: 0 },
        hourlyRateFirst8hMlPerHour: { type: Number, default: 0 },
      },
      sterileCoverApplied: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 18. Cứu Hộ Động Đất, Sập Đổ Công Trình & Hội Chứng Vùi Lấp (USAR Crush Syndrome & Reperfusion Prevention)
    crushInjuryCare: {
      isCrushInjury: { type: Boolean, default: false },
      trappedStructure: { type: String, default: 'Dầm bê tông sập đổ' },
      trappedMuscleGroup: {
        type: String,
        default: 'SINGLE_LEG',
      },
      compressionDurationMinutes: { type: Number, default: 0 },
      crushSyndromeRisk: {
        type: String,
        default: 'LOW_UNDER_2_HOURS',
      },
      rhabdomyolysisRisk: { type: String, default: 'LOW' },
      urineOutputMonitored: { type: Boolean, default: false },
      myoglobinuriaDetected: { type: Boolean, default: false },
      ivHydrationPreExtricationStarted: { type: Boolean, default: false },
      ivFluidRateMlPerHour: { type: Number, default: 1000 },
      provisionalTourniquetAppliedBeforeLifting: { type: Boolean, default: false },
      reperfusionCardiacArrestPrevented: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 19. Cấp Cứu Tràn Khí Màng Phổi Áp Lực & Chấn Thương Ngực Hở (PHTLS Tension Pneumothorax & Vented Chest Seal)
    chestTraumaCare: {
      isChestTrauma: { type: Boolean, default: false },
      hasSuckingChestWound: { type: Boolean, default: false },
      ventedChestSealApplied: { type: Boolean, default: false },
      chestSealBurped: { type: Boolean, default: false },
      tensionPneumothoraxSuspected: { type: Boolean, default: false },
      needleDecompressionPerformed: { type: Boolean, default: false },
      needleInsertionSite: {
        type: String,
        enum: ['2ND_ICS_MIDCLAVICULAR', '5TH_ICS_ANTERIOR_AXILLARY', 'NONE'],
        default: 'NONE',
      },
      needleGauge: { type: String, default: '14G' },
      airHissDecompressionConfirmed: { type: Boolean, default: false },
      hemodynamicStabilized: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 20. Bất Động Cột Sống Cổ Ngoại Viện & Sốc Thần Kinh (Spinal Motion Restriction - SMR & Canadian C-Spine)
    spinalTraumaCare: {
      isSpinalTrauma: { type: Boolean, default: false },
      canadianCSpineRisk: {
        type: String,
        enum: ['HIGH_RISK_MANDATORY_COLLAR', 'LOW_RISK_ASSESS_RANGE', 'NO_SMR_NEEDED'],
        default: 'NO_SMR_NEEDED',
      },
      mechanismHighRisk: { type: Boolean, default: false },
      extremityParesthesia: { type: Boolean, default: false },
      cervicalCollarApplied: { type: Boolean, default: false },
      cervicalCollarSize: {
        type: String,
        enum: ['NO_NECK', 'SHORT', 'REGULAR', 'TALL', 'UNKNOWN'],
        default: 'REGULAR',
      },
      manualInLineStabilizationMaintained: { type: Boolean, default: false },
      logRollTechniqueUsed: { type: Boolean, default: false },
      vacuumMattressSecured: { type: Boolean, default: false },
      neurogenicShockSuspected: { type: Boolean, default: false },
      shockType: {
        type: String,
        enum: ['NEUROGENIC_WARM_BRADYCARDIC', 'HYPOVOLEMIC_COLD_TACHYCARDIC', 'NONE'],
        default: 'NONE',
      },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 21. Cấp Cứu Hạ Đường Huyết Nặng & Hôn Mê Tiểu Đường Ở Người Sống Đơn Thân (Severe Hypoglycemia & Glucagon)
    diabeticEmergencyCare: {
      isDiabeticEmergency: { type: Boolean, default: false },
      bloodGlucoseMmolL: { type: Number, default: 5.5 },
      bloodGlucoseMgDl: { type: Number, default: 100 },
      hypoglycemiaSeverity: {
        type: String,
        enum: ['NORMAL', 'MILD_MODERATE', 'SEVERE_COMA_NEUROGLYCOPENIC'],
        default: 'NORMAL',
      },
      ruleOf15Applied: { type: Boolean, default: false },
      oralIntakeContraindicated: { type: Boolean, default: false },
      glucagonOrIvDextroseAdministered: { type: Boolean, default: false },
      medicationType: {
        type: String,
        enum: ['GLUCAGON_1MG_IM', 'DEXTROSE_20_PERCENT_IV', 'ORAL_15G_CARBS', 'NONE'],
        default: 'NONE',
      },
      postTreatmentGlucoseMmolL: { type: Number, default: null },
      patientConsciousnessRegained: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 22. Cấp Cứu Trẻ Em Hóc Dị Vật Đường Thở (AHA/ERC Pediatric Choking & FBAO)
    pediatricChokingCare: {
      isPediatricChoking: { type: Boolean, default: false },
      patientAgeMonths: { type: Number, default: 24 },
      isInfantUnder1Year: { type: Boolean, default: false },
      backBlowsAndChestThrustsApplied: { type: Boolean, default: false },
      abdominalThrustsHeimlichApplied: { type: Boolean, default: false },
      abdominalThrustsContraindicatedInfant: { type: Boolean, default: false },
      blindFingerSweepProhibited: { type: Boolean, default: true },
      foreignBodyExpelled: { type: Boolean, default: false },
      airwayClear: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 23. Cấp Cứu Động Kinh & Trạng Thái Co Giật Liên Tục (ILAE Status Epilepticus Pre-Hospital)
    seizureCare: {
      isSeizureEpisode: { type: Boolean, default: false },
      seizureDurationMinutes: { type: Number, default: 2 },
      isStatusEpilepticus: { type: Boolean, default: false },
      oralObjectInsertionContraindicated: { type: Boolean, default: true },
      physicalRestraintContraindicated: { type: Boolean, default: true },
      headProtectedWithPadding: { type: Boolean, default: false },
      recoveryPositionPlacedPostIctal: { type: Boolean, default: false },
      midazolamOrDiazepamAdministered: { type: Boolean, default: false },
      convulsionCeased: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 24. Cấp Cứu Điện Giật Đô Thị & An Toàn Hiện Trường Cao Thế (Urban Electrical Injury & Arc Flash)
    electricalInjuryCare: {
      isElectricalInjury: { type: Boolean, default: false },
      voltageCategory: {
        type: String,
        enum: ['LOW_VOLTAGE_HOUSEHOLD_220V', 'HIGH_VOLTAGE_OVER_1000V', 'LIGHTNING_STRIKE'],
        default: 'LOW_VOLTAGE_HOUSEHOLD_220V',
      },
      scenePowerCutConfirmed: { type: Boolean, default: false },
      safetyCordonMaintained10Meters: { type: Boolean, default: false },
      stepPotentialHopExitUsed: { type: Boolean, default: false },
      cardiacRhythmAssessed: {
        type: String,
        enum: ['VENTRICULAR_FIBRILLATION', 'ASYSTOLE', 'SINUS_RHYTHM', 'UNKNOWN'],
        default: 'UNKNOWN',
      },
      aedShockDelivered: { type: Boolean, default: false },
      deepTissueBurnSuspected: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 25. Ngộ Độc Khí Carbon Monoxide (CO) & Khói Cháy Chung Cư Đô Thị (Cyanide / CO Poisoning & Hyperbaric Oxygen)
    coSmokeInhalationCare: {
      isCoSmokeInhalation: { type: Boolean, default: false },
      sourceCategory: {
        type: String,
        enum: ['BUILDING_FIRE_SMOKE', 'INDOOR_CHARCOAL_GENERATOR', 'VEHICLE_EXHAUST_ENCLOSED'],
        default: 'BUILDING_FIRE_SMOKE',
      },
      sootInNarisOrOralCavity: { type: Boolean, default: false },
      highFlowOxygen100Applied: { type: Boolean, default: false },
      oxygenFlowRateLpm: { type: Number, default: 15 },
      estimatedHbCoPercent: { type: Number, default: null },
      hyperbaricOxygenIndicated: { type: Boolean, default: false },
      cyanideAntidoteAdministered: { type: Boolean, default: false },
      antidoteType: {
        type: String,
        enum: ['HYDROXOCOBALAMIN_CYANOKIT_5G', 'SODIUM_THIOSULFATE', 'NONE'],
        default: 'NONE',
      },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 26. Cấp Cứu Chấn Thương Mắt & Bỏng Hóa Chất Vào Mắt (Ocular Chemical Burns & Eye Shield Protection)
    ocularTraumaCare: {
      isOcularTrauma: { type: Boolean, default: false },
      injuryCategory: {
        type: String,
        enum: ['CHEMICAL_ALKALI_BASE', 'CHEMICAL_ACID', 'PENETRATING_GLOBE_FOREIGN_BODY', 'BLUNT_HYPHEMA'],
        default: 'CHEMICAL_ALKALI_BASE',
      },
      immediateIrrigationPerformed: { type: Boolean, default: false },
      irrigationDurationMinutes: { type: Number, default: 20 },
      irrigationFluidVolumeMl: { type: Number, default: 1500 },
      targetPhNeutralized: { type: Boolean, default: false },
      measuredConjunctivalPh: { type: Number, default: 7.2 },
      rigidEyeShieldApplied: { type: Boolean, default: false },
      globePressureProhibited: { type: Boolean, default: true },
      foreignBodyRemovalProhibited: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 27. Sơ Cứu Bẫy Đứt Lìa Chi & Bảo Quản Phần Chi Đứt Rời Chuẩn Vi Phẫu (Traumatic Amputation & Replantation)
    amputationCare: {
      isAmputation: { type: Boolean, default: false },
      amputationType: {
        type: String,
        enum: ['COMPLETE_AMPUTATION', 'PARTIAL_INCOMPLETE_AMPUTATION', 'CRUSH_AVULSION'],
        default: 'COMPLETE_AMPUTATION',
      },
      anatomicalPart: {
        type: String,
        enum: ['DIGIT_FINGER_TOE', 'HAND_WRIST', 'FOREARM_ARM', 'FOOT_ANKLE', 'LEG_LOWER'],
        default: 'DIGIT_FINGER_TOE',
      },
      stumpHemostasisApplied: { type: Boolean, default: true },
      hemostasisMethod: {
        type: String,
        enum: ['PRESSURE_DRESSING', 'COMBAT_APPLICATION_TOURNIQUET'],
        default: 'PRESSURE_DRESSING',
      },
      amputatedPartRetrieved: { type: Boolean, default: false },
      threeTierPreservationApplied: { type: Boolean, default: false },
      directIceContactProhibited: { type: Boolean, default: true },
      directWaterImmersionProhibited: { type: Boolean, default: true },
      ischemiaType: {
        type: String,
        enum: ['COLD_ISCHEMIA_2_TO_4C', 'WARM_ISCHEMIA_ROOM_TEMP'],
        default: 'COLD_ISCHEMIA_2_TO_4C',
      },
      goldenWindowHours: { type: Number, default: 12 },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 28. Cấp Cứu Vỡ Phình ĐM Chủ Bụng & Thoát Vị Tạng Vùng Bụng (PHTLS Abdominal Trauma & Evisceration)
    abdominalTraumaCare: {
      isAbdominalTrauma: { type: Boolean, default: false },
      traumaType: {
        type: String,
        enum: ['EVISCERATION_OPEN_BOWEL', 'SUSPECTED_RUPTURED_AAA', 'BLUNT_SPLENIC_HEPATIC', 'NONE'],
        default: 'NONE',
      },
      organReinsertionProhibited: { type: Boolean, default: true },
      sterileMoistDressingApplied: { type: Boolean, default: false },
      occlusiveMoistureBarrierApplied: { type: Boolean, default: false },
      kneesFlexedPositionMaintained: { type: Boolean, default: false },
      permissiveHypotensionTargetSbp: { type: Number, default: 85 },
      actualSystolicBp: { type: Number, default: 85 },
      excessiveFluidAvoided: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 29. Cấp Cứu Ngộ Độc Thuốc Trừ Sâu Phospho Hữu Cơ & Kháng Cholinesterase (Organophosphate Poisoning)
    toxicologyPoisoningCare: {
      isToxicologyPoisoning: { type: Boolean, default: false },
      toxinCategory: {
        type: String,
        enum: ['ORGANOPHOSPHATE_INSECTICIDE', 'CARBAMATE', 'RODENTICIDE_WARFARIN', 'PARAQUAT', 'OTHER'],
        default: 'ORGANOPHOSPHATE_INSECTICIDE',
      },
      dermalDecontaminationPerformed: { type: Boolean, default: false },
      clothingSafelyDisposedInBags: { type: Boolean, default: false },
      pinpointPupilsObserved: { type: Boolean, default: false },
      bronchorrheaSecretionsSuctioned: { type: Boolean, default: false },
      atropineAdministeredMg: { type: Number, default: 0 },
      atropinizationAchieved: { type: Boolean, default: false },
      pralidoximePamAdministeredGrams: { type: Number, default: 0 },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 30. Cấp Cứu Chấn Thương Vỡ Khung Chậu Nặng & Sử Dụng Đai Kẹp Vùng Chậu (Pelvic Ring Fracture)
    pelvicTraumaCare: {
      isPelvicTrauma: { type: Boolean, default: false },
      fracturePattern: {
        type: String,
        enum: ['OPEN_BOOK_UNSTABLE', 'LATERAL_COMPRESSION', 'VERTICAL_SHEAR', 'SUSPECTED_PELVIC_RING'],
        default: 'OPEN_BOOK_UNSTABLE',
      },
      repeatedPelvicRockingProhibited: { type: Boolean, default: true },
      pelvicBinderApplied: { type: Boolean, default: false },
      pelvicBinderPlacementSite: {
        type: String,
        enum: ['GREATER_TROCHANTERS_SYMPHYSIS_PUBIS', 'ILIAC_CRESTS_INCORRECT', 'ABDOMEN_INCORRECT'],
        default: 'GREATER_TROCHANTERS_SYMPHYSIS_PUBIS',
      },
      kneesAndFeetTiedTogether: { type: Boolean, default: false },
      retroperitonealBleedingRisk: {
        type: String,
        enum: ['MASSIVE_LETHAL_3_TO_5_LITERS', 'MODERATE', 'LOW'],
        default: 'MASSIVE_LETHAL_3_TO_5_LITERS',
      },
      scoopStretcherUsed: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 31. Cấp Cứu Chấn Thương Sọ Não Nặng & Tụt Kẹt Não (Severe Traumatic Brain Injury & Herniation)
    traumaticBrainInjuryCare: {
      isSevereTbi: { type: Boolean, default: false },
      gcsScore: { type: Number, default: 15 },
      cushingsTriadObserved: { type: Boolean, default: false },
      systolicBloodPressure: { type: Number, default: 120 },
      heartRateBpm: { type: Number, default: 75 },
      respiratoryPattern: {
        type: String,
        enum: ['NORMAL', 'CHEYNE_STOKES', 'ATAXIC_IRREGULAR', 'APNEIC'],
        default: 'NORMAL',
      },
      anisocoriaPupilDilation: { type: Boolean, default: false },
      dilatedPupilDiameterMm: { type: Number, default: 3 },
      headElevated30Degrees: { type: Boolean, default: false },
      controlledHyperventilationApplied: { type: Boolean, default: false },
      targetEtCo2MmHg: { type: Number, default: 35 },
      prophylacticHyperventilationAvoided: { type: Boolean, default: true },
      hypotensionHypoxiaPrevented: { type: Boolean, default: true },
      neurosurgeryTransferInitiated: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 32. Cấp Cứu Sản Phụ Chấn Thương & Hồi Sức Ngừng Tuần Hoàn Thai Phụ (Maternal Trauma & PMCD)
    maternalResuscitationCare: {
      isMaternalEmergency: { type: Boolean, default: false },
      gestationalAgeWeeks: { type: Number, default: 0 },
      uterineFundusAboveUmbilicus: { type: Boolean, default: false },
      manualLeftUterineDisplacementApplied: { type: Boolean, default: false },
      tiltWholeBodyProhibited: { type: Boolean, default: true },
      aortocavalCompressionRelieved: { type: Boolean, default: false },
      cardiacArrestDurationMinutes: { type: Number, default: 0 },
      perimortemCesareanIndicated: { type: Boolean, default: false },
      targetDeliveryWithin5Minutes: { type: Boolean, default: false },
      maternalFetalSpecialtyHospitalNotified: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 33. Cấp Cứu Tai Biến Lặn Biển & Bệnh Giảm Áp Khí Nén Đô Thị (Decompression Sickness & Caisson Disease)
    decompressionSicknessCare: {
      isDecompressionSickness: { type: Boolean, default: false },
      exposureCategory: {
        type: String,
        enum: ['METRO_TUNNEL_CAISSON_WORKER', 'SCUBA_DIVING_TOURISM', 'UNDERWATER_COMMERCIAL_DIVER'],
        default: 'SCUBA_DIVING_TOURISM',
      },
      symptomType: {
        type: String,
        enum: ['TYPE_1_BENDS_JOINT_PAIN', 'TYPE_2_SPINAL_PARALYSIS_CHOKES', 'ARTERIAL_GAS_EMBOLISM_STROKE'],
        default: 'TYPE_1_BENDS_JOINT_PAIN',
      },
      highFlowOxygen100Applied: { type: Boolean, default: false },
      oxygenFlowRateLpm: { type: Number, default: 15 },
      inWaterRecompressionStrictlyProhibited: { type: Boolean, default: true },
      lowAltitudeEvacuationEnforced: { type: Boolean, default: true },
      maximumFlightAltitudeMeters: { type: Number, default: 300 },
      recompressionChamberIndicated: { type: Boolean, default: false },
      usNavyTable6ProtocolReady: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 34. Cấp Cứu Sốc Mất Máu Nặng & Hồi Sức Kiểm Soát Tổn Thương (Damage Control Resuscitation & TXA CRASH-2)
    hemorrhagicShockDcrCare: {
      isHemorrhagicShock: { type: Boolean, default: false },
      shockClass: {
        type: String,
        enum: ['CLASS_1_MILD', 'CLASS_2_MODERATE', 'CLASS_3_SEVERE', 'CLASS_4_LETHAL'],
        default: 'CLASS_3_SEVERE',
      },
      estimatedBloodLossMl: { type: Number, default: 1500 },
      systolicBp: { type: Number, default: 80 },
      heartRate: { type: Number, default: 125 },
      injuryToTxaIntervalMinutes: { type: Number, default: 45 },
      txaAdministeredWithin3Hours: { type: Boolean, default: true },
      txaContraindicatedAfter3Hours: { type: Boolean, default: false },
      txaDoseGrams: { type: Number, default: 1.0 },
      crystalloidLimitedUnder1000Ml: { type: Boolean, default: true },
      mtpProtocol111Activated: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 35. Cấp Cứu Hạ Thân Nhiệt Sâu & Kỹ Thuật Làm Ấm Tích Cực (Accidental Severe Hypothermia & Rewarming)
    severeHypothermiaCare: {
      isSevereHypothermia: { type: Boolean, default: false },
      coreTemperatureCelsius: { type: Number, default: 28.5 },
      hypothermiaStage: {
        type: String,
        enum: ['STAGE_1_MILD_32_35', 'STAGE_2_MODERATE_28_32', 'STAGE_3_SEVERE_24_28', 'STAGE_4_ARREST_UNDER_24'],
        default: 'STAGE_3_SEVERE_24_28',
      },
      gentleHandlingMaintained: { type: Boolean, default: true },
      activeExternalCoreRewarmingApplied: { type: Boolean, default: true },
      extremityRewarmingProhibitedBeforeCore: { type: Boolean, default: true },
      rewarmingAfterdropPrevented: { type: Boolean, default: true },
      activeInternalRewarmingApplied: { type: Boolean, default: true },
      noOneDeadUntilWarmAndDeadRule: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 36. Cấp Cứu Cơn Bão Giáp Trạng & Hôn Mê Suy Giáp (Endocrine Crises: Thyroid Storm & Myxedema Coma)
    endocrineCrisesCare: {
      isEndocrineCrisis: { type: Boolean, default: false },
      crisisType: {
        type: String,
        enum: ['THYROID_STORM', 'MYXEDEMA_COMA', 'NONE'],
        default: 'THYROID_STORM',
      },
      burchWartofskyScore: { type: Number, default: 55 },
      coreTemperatureCelsius: { type: Number, default: 40.5 },
      heartRateBpm: { type: Number, default: 155 },
      aspirinStrictlyProhibited: { type: Boolean, default: true },
      safeCoolingMethod: {
        type: String,
        default: 'PARACETAMOL_AND_ICE_PACKS',
      },
      betaBlockerAdministered: { type: Boolean, default: true },
      levothyroxineHydrocortisoneReady: { type: Boolean, default: false },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 37. Cấp Cứu Ngộ Độc Khí Độc Công Nghiệp & Đô Thị (H2S Knockdown & Khí Clo Cl2)
    industrialGasPoisoningCare: {
      isIndustrialGasPoisoning: { type: Boolean, default: false },
      gasType: {
        type: String,
        enum: ['HYDROGEN_SULFIDE_H2S', 'CHLORINE_CL2', 'AMMONIA_NH3', 'NONE'],
        default: 'HYDROGEN_SULFIDE_H2S',
      },
      scbaEntryRequired: { type: Boolean, default: true },
      rescuerEntryBlockedWithoutScba: { type: Boolean, default: true },
      olfactoryFatigueWarningIssued: { type: Boolean, default: true },
      highFlowOxygen100Administered: { type: Boolean, default: true },
      antidoteAdministered: {
        type: String,
        enum: ['SODIUM_NITRITE_300MG', 'HYDROXOCOBALAMIN_5G', 'NEBULIZED_SODIUM_BICARBONATE', 'NONE'],
        default: 'SODIUM_NITRITE_300MG',
      },
      upwindEvacuationMaintained: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 38. Cấp Cứu Sốc Tim Cấp & Phù Phổi Cấp Huyết Động (Cardiogenic Shock & Acute Pulmonary Edema)
    cardiogenicShockPulmonaryEdemaCare: {
      isCardiogenicEmergency: { type: Boolean, default: false },
      killipClass: {
        type: String,
        enum: ['KILLIP_1', 'KILLIP_2', 'KILLIP_3_PULMONARY_EDEMA', 'KILLIP_4_CARDIOGENIC_SHOCK'],
        default: 'KILLIP_3_PULMONARY_EDEMA',
      },
      patientPositioning: {
        type: String,
        enum: ['HIGH_FOWLER_LEGS_DANGLING', 'SUPINE_STRICTLY_PROHIBITED'],
        default: 'HIGH_FOWLER_LEGS_DANGLING',
      },
      cpapBiPapPositivePressureApplied: { type: Boolean, default: true },
      cpapPressureCmH2O: { type: Number, default: 10 },
      systolicBp: { type: Number, default: 160 },
      nitroglycerinAdministered: { type: Boolean, default: true },
      nitroglycerinContraindicated: { type: Boolean, default: false },
      pde5InhibitorOrRvInfarctionScreened: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 39. Cấp Cứu Sốc Nhiễm Khuẩn & Gói Giờ Vàng Sepsis (Septic Shock & Surviving Sepsis Campaign Hour-1 Bundle)
    septicShockSepsisBundleCare: {
      isSepticShock: { type: Boolean, default: false },
      qSofaScore: { type: Number, default: 3 },
      respiratoryRatePerMin: { type: Number, default: 28 },
      systolicBp: { type: Number, default: 85 },
      gcsScore: { type: Number, default: 13 },
      crystalloidBolusMlPerKg: { type: Number, default: 30 },
      totalCrystalloidInfusedMl: { type: Number, default: 1800 },
      lactateMmolL: { type: Number, default: 4.2 },
      vasopressorNoradrenalineStarted: { type: Boolean, default: true },
      targetMeanArterialPressureMmHg: { type: Number, default: 65 },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 40. Cấp Cứu Chấn Thương Mạch Máu Chi Nặng & Garô Giáp Ranh (Junctional Tourniquet & Compartment Syndrome)
    junctionalVascularTraumaCare: {
      isVascularTrauma: { type: Boolean, default: false },
      injuryLocation: {
        type: String,
        enum: [
          'GROIN_FEMORAL',
          'AXILLARY',
          'NECK_CAROTID',
          'EXTREMITY',
          'GROIN_FEMORAL_JUNCTION',
          'AXILLA_SUBCLAVIAN_JUNCTION',
          'MID_EXTREMITY',
          'NONE',
        ],
        default: 'GROIN_FEMORAL',
      },
      hemostaticWoundPackingApplied: { type: Boolean, default: true },
      junctionalTourniquetApplied: { type: Boolean, default: true },
      directPressureDurationMinutes: { type: Number, default: 3 },
      ischemiaTimeMinutes: { type: Number, default: 40 },
      compartmentSyndromeSuspected: { type: Boolean, default: false },
      passiveStretchPainPresent: { type: Boolean, default: false },
      elevationProhibitedIfCompartment: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 41. Cấp Cứu Tăng Thân Nhiệt Ác Tính & Hội Chứng Serotonin (Malignant Hyperthermia & Serotonin Syndrome)
    hyperthermiaSerotoninSyndromeCare: {
      isHyperthermicSyndrome: { type: Boolean, default: false },
      syndromeType: {
        type: String,
        enum: ['MALIGNANT_HYPERTHERMIA', 'SEROTONIN_SYNDROME', 'NEUROLEPTIC_MALIGNANT', 'NONE'],
        default: 'SEROTONIN_SYNDROME',
      },
      hunterCriteriaClonusPresent: { type: Boolean, default: true },
      leadPipeRigidityPresent: { type: Boolean, default: true },
      coreTemperatureCelsius: { type: Number, default: 41.2 },
      antidoteAdministered: {
        type: String,
        enum: ['DANTROLENE_2_5_MG_KG', 'CYPROHEPTADINE_12MG', 'BENZODIAZEPINE_ONLY', 'NONE'],
        default: 'CYPROHEPTADINE_12MG',
      },
      physicalRestraintsProhibited: { type: Boolean, default: true },
      activeExternalCoolingApplied: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 42. Giao Thức Hồi Sinh Tim Phổi Ngoài Cơ Thể Tiền Viện (ECPR Refractory Cardiac Arrest Protocol)
    ecprRefractoryArrestCare: {
      isEcprCandidate: { type: Boolean, default: false },
      witnessedArrest: { type: Boolean, default: true },
      bystanderCprStartedWithin5Min: { type: Boolean, default: true },
      initialRhythmShockable: { type: Boolean, default: true },
      refractoryShocksCount: { type: Number, default: 3 },
      mechanicalCprDeviceActive: { type: Boolean, default: true },
      estimatedTimeToCannulationMinutes: { type: Number, default: 42 },
      ecprPreAlertAcknowledged: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 43. Cấp Cứu Chấn Thương Cột Sống Ngực - Thắt Lưng & Liệt Tủy Cấp (Thoracolumbar Spine Trauma & ASIA Scale)
    thoracolumbarSpinalTraumaCare: {
      isSpinalTrauma: { type: Boolean, default: false },
      asiaImpairmentScale: {
        type: String,
        enum: [
          'ASIA_A_COMPLETE',
          'ASIA_B_INCOMPLETE_SENSORY',
          'ASIA_C_INCOMPLETE_MOTOR',
          'ASIA_D_INCOMPLETE_FUNCTIONAL',
          'ASIA_E_NORMAL',
        ],
        default: 'ASIA_A_COMPLETE',
      },
      logRoll4PersonTechniqueApplied: { type: Boolean, default: true },
      vacuumMattressApplied: { type: Boolean, default: true },
      rigidSpineBoardRemovedWithin30Min: { type: Boolean, default: true },
      priapismOrSphincterLossDetected: { type: Boolean, default: false },
      spinalShockWatchdogActive: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 44. Cấp Cứu Phù Não & Phù Phổi Độ Cao / Thiếu Khí (HACE & HAPE High Altitude Protocol)
    highAltitudeCerebralPulmonaryEdemaCare: {
      isAltitudeIllness: { type: Boolean, default: false },
      altitudeMeters: { type: Number, default: 3143 },
      lakeLouiseScore: { type: Number, default: 5 },
      immediateDescentStarted: { type: Boolean, default: true },
      descentAltitudeMeters: { type: Number, default: 1000 },
      gamowHyperbaricBagApplied: { type: Boolean, default: true },
      dexamethasoneAdministered: { type: Boolean, default: true },
      nifedipineAdministered: { type: Boolean, default: true },
      highFlowOxygenApplied: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 45. Sơ Cứu Bỏng Lạnh Đô Thị & Tổn Thương Khí Hóa Lỏng Nitơ/CO2 (Cryogenic Frostbite Injury)
    cryogenicFrostbiteCare: {
      isCryogenicInjury: { type: Boolean, default: false },
      frostbiteDegree: {
        type: String,
        enum: [
          'GRADE_1_ERYTHEMA',
          'GRADE_2_CLEAR_BLISTER',
          'GRADE_3_HEMORRHAGIC_BLISTER',
          'GRADE_4_BONE_NECROSIS',
        ],
        default: 'GRADE_2_CLEAR_BLISTER',
      },
      rapidRewarmingWaterTempCelsius: { type: Number, default: 38.5 },
      frictionRubbingStrictlyProhibited: { type: Boolean, default: true },
      refreezingRiskPrevented: { type: Boolean, default: true },
      thromboxaneInhibitorIbuprofenGiven: { type: Boolean, default: true },
      aloeVeraSterileDressingApplied: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 46. Cấp Cứu Sốc Độc Tố Vi Khuẩn & Viêm Cân Mạc Hoại Tử (Necrotizing Fasciitis & TSS LRINEC Score)
    necrotizingFasciitisCare: {
      isNecrotizingFasciitis: { type: Boolean, default: false },
      lrinecScore: { type: Number, default: 6 },
      painOutOfProportion: { type: Boolean, default: true },
      subcutaneousCrepitusPresent: { type: Boolean, default: false },
      clindamycinToxinInhibitionGiven: { type: Boolean, default: true },
      emergencySurgicalDebridementAlerted: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 47. Cấp Cứu Khối Máu Tụ Sau Nhãn Cầu & Mở Góc Mắt Giải Áp Ngoại Viện (Retrobulbar Hematoma & Lateral Canthotomy)
    retrobulbarHematomaCare: {
      isRetrobulbarHematoma: { type: Boolean, default: false },
      rockHardProptosis: { type: Boolean, default: true },
      relativeAfferentPupillaryDefect: { type: Boolean, default: true },
      intraocularPressureMmHg: { type: Number, default: 45 },
      ischemiaTimeMinutes: { type: Number, default: 35 },
      lateralCanthotomyCantholysisPrepared: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 48. Cấp Cứu Ngộ Độc Thuốc Tê Cục Bộ Toàn Thân (Local Anesthetic Systemic Toxicity - LAST & Lipid Emulsion 20%)
    lastToxicityLipidCare: {
      isLastToxicity: { type: Boolean, default: false },
      localAnestheticAgent: {
        type: String,
        enum: ['BUPIVACAINE', 'LIDOCAINE', 'ROPIVACAINE', 'MEPIVACAINE', 'UNKNOWN'],
        default: 'BUPIVACAINE',
      },
      perioralNumbnessMetallicTaste: { type: Boolean, default: true },
      seizuresOrRefractoryArrhythmia: { type: Boolean, default: true },
      lipidEmulsion20PercentBolusGiven: { type: Boolean, default: true },
      lipidInfusionRateMlKgMin: { type: Number, default: 0.25 },
      vasopressinAndCalciumBlockersProhibited: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 49. Cấp Cứu Thuyên Tắc Phổi Diện Rộng & Tắc Mạch Ối (Massive Pulmonary Embolism & AFE)
    massivePulmonaryEmbolismCare: {
      isMassivePulmonaryEmbolism: { type: Boolean, default: false },
      wellsScore: { type: Number, default: 6 },
      isAmnioticFluidEmbolism: { type: Boolean, default: false },
      acuteRightHeartStrainSigns: { type: Boolean, default: true },
      systemicThrombolysisIndicated: { type: Boolean, default: true },
      cautiousFluidsUnder500Ml: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 50. Cấp Cứu Vỡ Thực Quản Do Áp Lực & Tràn Khí Trung Thất (Boerhaave Syndrome & Mediastinitis)
    esophagealRuptureCare: {
      isEsophagealRupture: { type: Boolean, default: false },
      macklerTriadPresent: { type: Boolean, default: true },
      hammanSignCrunchPresent: { type: Boolean, default: false },
      strictNpoProhibitedOralIntake: { type: Boolean, default: true },
      blindNasogastricTubeProhibited: { type: Boolean, default: true },
      broadSpectrumAntibioticsGiven: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 51. Cấp Cứu Chấn Thương Vỡ Bàng Quang & Đứt Niệu Đạo Phức Tạp (Bladder & Urethral Trauma)
    bladderUrethralTraumaCare: {
      isBladderUrethralTrauma: { type: Boolean, default: false },
      bloodAtUrethralMeatus: { type: Boolean, default: true },
      butterflyPerinealHematoma: { type: Boolean, default: true },
      blindFoleyCatheterizationStrictlyProhibited: { type: Boolean, default: true },
      retrogradeUrethrographyIndicated: { type: Boolean, default: true },
      suprapubicCystostomyPrepared: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 52. Cấp Cứu Xuất Huyết Não Dưới Nhện Cấp (Aneurysmal Subarachnoid Hemorrhage - aSAH & Thunderclap Headache)
    subarachnoidHemorrhageCare: {
      isSubarachnoidHemorrhage: { type: Boolean, default: false },
      thunderclapHeadacheOnset: { type: Boolean, default: true },
      huntHessGrade: { type: Number, default: 2 }, // Độ 1 - 5
      meningealSignsKernigBrudzinski: { type: Boolean, default: true },
      targetSystolicBloodPressureStrictUnder140: { type: Boolean, default: true },
      nimodipineVasospasmProphylaxisIndicated: { type: Boolean, default: true },
      headOfBedElevated30Degrees: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 53. Cấp Cứu Vết Thương Xuyên Thấu Tim & Hở Lồng Ngực (Penetrating Cardiac Injury & EDT)
    penetratingCardiacTraumaCare: {
      isPenetratingCardiacTrauma: { type: Boolean, default: false },
      becksTriadPresent: { type: Boolean, default: true },
      cardiacTamponadeDiagnosed: { type: Boolean, default: true },
      impaledObjectNeverRemoved: { type: Boolean, default: true },
      threeSidedOcclusiveDressingApplied: { type: Boolean, default: true },
      resuscitativeThoracotomyPrepared: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 54. Cấp Cứu Hội Chứng Chùm Đuôi Ngựa Cấp (Cauda Equina Syndrome - CES Red Flags)
    caudaEquinaSyndromeCare: {
      isCaudaEquinaSyndrome: { type: Boolean, default: false },
      saddleAnesthesiaPresent: { type: Boolean, default: true },
      bladderSphincterDysfunctionRetention: { type: Boolean, default: true },
      lossOfAnalSphincterTone: { type: Boolean, default: true },
      cesStage: { type: String, enum: ['CES_I', 'CES_R'], default: 'CES_I' },
      urgentSurgicalDecompressionWindowUnder48h: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 55. Cấp Cứu Thuyên Tắc Khí & Thuyên Tắc Mỡ Sau Gãy Xương Dài (Fat & Air Embolism - FES & VAE)
    fatAirEmbolismCare: {
      isFatAirEmbolism: { type: Boolean, default: false },
      gurdsMajorCriteriaMet: { type: Boolean, default: true },
      petechialRashAxillaNeckConjunctiva: { type: Boolean, default: true },
      durantsPositionLeftLateralTrendelenburg: { type: Boolean, default: true },
      highFlowNormobaricOxygen100: { type: Boolean, default: true },
      longBoneFractureImmobilizedEarly: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 56. Cấp Cứu Cơn Tăng Huyết Áp Ác Tính & Tổn Thương Cơ Quan Đích Cấp (Hypertensive Emergency & TOD)
    hypertensiveEmergencyCare: {
      isHypertensiveEmergency: { type: Boolean, default: false },
      systolicBpOver180OrDiastolicOver120: { type: Boolean, default: true },
      acuteTargetOrganDamageIdentified: { type: Boolean, default: true },
      mapReductionLimitedTo20To25PercentFirstHour: { type: Boolean, default: true },
      sublingualNifedipineStrictlyProhibited: { type: Boolean, default: true },
      titratableIvAntihypertensiveNicardipineLabetalol: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 57. Cấp Cứu Cơn Bão Catecholamine Khối U Tủy Thượng Thận (Pheochromocytoma Hypertensive Crisis)
    pheochromocytomaCrisisCare: {
      isPheochromocytomaCrisis: { type: Boolean, default: false },
      paroxysmalTriadHeadacheSweatingTachycardia: { type: Boolean, default: true },
      alphaBlockadeBeforeBetaBlockadeEnforced: { type: Boolean, default: true },
      phentolamineOrPhenoxybenzamineAdministered: { type: Boolean, default: true },
      betaBlockerStrictlyProhibitedWithoutAlpha: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 58. Cấp Cứu Xuất Huyết Não Trong Nhu Mô & Kiểm Soát Thể Tích Khối Máu Tụ (Intracerebral Hemorrhage - ICH Hematoma Expansion)
    intracerebralHemorrhageCare: {
      isIntracerebralHemorrhage: { type: Boolean, default: false },
      ichScore: { type: Number, default: 2 }, // 0 - 6
      hematomaVolumeMl: { type: Number, default: 35 }, // Công thức ABC/2
      spotSignPositiveOnCta: { type: Boolean, default: true }, // Rò rỉ chất cản quang dự báo mở rộng máu tụ
      urgentAnticoagulantReversalApplied: { type: Boolean, default: true }, // PCC / Vitamin K / Idarucizumab / Andexanet
      targetSbpControlled140To180: { type: Boolean, default: true }, // Đích huyết áp AHA/ASA 130-140 hoặc < 140
      cerebellarHematomaSurgicalDecompressionIndicated: { type: Boolean, default: false }, // Máu tụ tiểu não >= 3cm mổ mở sọ khẩn
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 59. Cấp Cứu Tràn Máu Màng Ngoài Tim Do Bóc Tách Động Mạch Chủ Ngực Stanford Type A (Acute Stanford A Aortic Dissection)
    acuteAorticDissectionCare: {
      isAcuteAorticDissection: { type: Boolean, default: false },
      stanfordType: {
        type: String,
        enum: ['STANFORD_A_ASCENDING', 'STANFORD_B_DESCENDING'],
        default: 'STANFORD_A_ASCENDING',
      },
      tearingChestBackPainOnset: { type: Boolean, default: true },
      bloodPressureDifferentialArmsOver20: { type: Boolean, default: true },
      hemopericardiumTamponadePresent: { type: Boolean, default: true },
      routinePericardiocentesisStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo cấm chọc dò giải áp bừa bãi làm vỡ toác thành ĐMC
      antiImpulseTherapyTargetHeartRateUnder60: { type: Boolean, default: true }, // Esmolol/Labetalol giảm dP/dt
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 60. Cấp Cứu Hôn Mê Tăng Áp Lực Thẩm Thấu Do Đái Tháo Đường (Hyperosmolar Hyperglycemic State - HHS Severe Dehydration)
    hyperosmolarHyperglycemicStateCare: {
      isHyperosmolarHyperglycemicState: { type: Boolean, default: false },
      serumGlucoseOver600MgDl: { type: Boolean, default: true },
      effectiveSerumOsmolalityOver320: { type: Boolean, default: true },
      severeOsmoticDehydrationLitersLost: { type: Number, default: 10 },
      fluidResuscitationBeforeInsulinStrictlyEnforced: { type: Boolean, default: true }, // Bù dịch tinh thể trước, cấm tiêm Insulin khi chưa hồi phục thể tích
      potassiumLevelVerifiedAbove3Point3: { type: Boolean, default: true }, // K >= 3.3 mEq/L phòng ngừng tim hạ Kali
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 61. Cấp Cứu Cơn Hen Phế Quản Ác Tính & Lồng Ngực Im Lặng (Near-Fatal Asthma & Silent Chest)
    acuteSevereAsthmaCare: {
      isAcuteSevereAsthma: { type: Boolean, default: false },
      silentChestObserved: { type: Boolean, default: true }, // Nghe phổi mất hoàn toàn tiếng ran rít do kiệt cơ lưu thông khí cực thấp
      pulsusParadoxusOver20: { type: Boolean, default: true }, // Mạch nghịch thường > 20 mmHg
      nebulizedSabaSamaContinuous: { type: Boolean, default: true }, // Khí dung Salbutamol + Ipratropium liên tục
      ivMagnesiumSulfate2gAdministered: { type: Boolean, default: true }, // Magnesium Sulfate 2g IV chậm 20 phút
      imEpinephrineAdministeredIfExhausted: { type: Boolean, default: true }, // Epinephrine 0.3-0.5mg tiêm bắp khẩn cấp
      sedativesContraindicatedAvoided: { type: Boolean, default: true }, // Tuyệt đối cấm thuốc an thần gây ức chế trung tâm hô hấp
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 62. Cấp Cứu Thuyên Tắc Động Mạch Chi Cấp Tính & Hội Chứng 6P (Acute Limb Ischemia & 6P's)
    acuteLimbIschemiaCare: {
      isAcuteLimbIschemia: { type: Boolean, default: false },
      sixPsSignsPresent: { type: Boolean, default: true }, // Pain, Pallor, Pulselessness, Poikilothermia, Paresthesia, Paralysis
      rutherfordClassification: {
        type: String,
        enum: ['RUTHERFORD_I', 'RUTHERFORD_IIA', 'RUTHERFORD_IIB', 'RUTHERFORD_III'],
        default: 'RUTHERFORD_IIB',
      },
      goldenWindowUnder6h: { type: Boolean, default: true }, // Cửa sổ vàng 6 giờ tái thông mạch máu
      heatApplicationStrictlyProhibited: { type: Boolean, default: true }, // CẤM chườm nóng / sưởi đèn hồng ngoại gây hoại tử tế bào
      limbElevationStrictlyProhibited: { type: Boolean, default: true }, // CẤM kê cao chân làm giảm lưu lượng máu động mạch
      ivUnfractionatedHeparinBolusAdministered: { type: Boolean, default: true }, // Heparin 80 IU/kg IV bolus chống lan rộng huyết khối
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 63. Cấp Cứu Nhiễm Trùng Đường Mật Cấp & Ngũ Chứng Reynolds (Acute Cholangitis & Reynolds' Pentad)
    acuteCholangitisCare: {
      isAcuteCholangitis: { type: Boolean, default: false },
      charcotTriadPresent: { type: Boolean, default: true }, // Tam chứng Charcot: Đau HSP + Sốt rét run + Vàng da
      reynoldsPentadPresent: { type: Boolean, default: true }, // Ngũ chứng Reynolds: Charcot + Tụt HA sốc + Rối loạn tri giác
      urgentBiliaryDecompressionIndicated: { type: Boolean, default: true }, // Bắt buộc dẫn lưu giải áp đường mật ERCP < 12-24h
      earlyBroadSpectrumAntibioticsAdministered: { type: Boolean, default: true }, // Kháng sinh phổ rộng tĩnh mạch trong 1h đầu
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 64. Cấp Cứu Tràn Khí Màng Ngoài Tim Áp Lực & Rò Khí Trung Thất (Tension Pneumopericardium & Water-Wheel Sound)
    tensionPneumopericardiumCare: {
      isTensionPneumopericardium: { type: Boolean, default: false },
      waterWheelSoundBruitDeMoulinPresent: { type: Boolean, default: true }, // Tiếng bánh xe nước lạo xạo óc ách khi nghe tim
      hammanSignCrunchPresent: { type: Boolean, default: true }, // Dấu hiệu Hamman lạo xạo trung thất theo nhịp đập tim
      subxiphoidNeedleDecompressionPerformed: { type: Boolean, default: true }, // Chọc kim giải áp màng tim dưới mũi kiếm xương ức
      highPpvVentilationStrictlyProhibited: { type: Boolean, default: true }, // Tuyệt đối cấm bóp bóng áp lực cao gây trụy mạch tắc tuần hoàn
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 65. Cấp Cứu Ngộ Độc Cồn Công Nghiệp Methanol & Mù Võng Mạc Bão Tuyết (Acute Methanol Toxicity & Snowstorm Vision)
    acuteMethanolToxicityCare: {
      isAcuteMethanolToxicity: { type: Boolean, default: false },
      snowstormVisionDefectPresent: { type: Boolean, default: true }, // Dấu hiệu thị giác bão tuyết do Acid Formic phá hủy dây thần kinh thị
      severeAnionGapAcidosisPhUnder7: { type: Boolean, default: true }, // Toan chuyển hóa tăng Anion Gap cực nặng pH < 7.0
      fomepizoleOrEthanolAdministered: { type: Boolean, default: true }, // Thuốc ức chế cạnh tranh enzym ADH (Fomepizole hoặc Ethanol 40 độ)
      folicAcidLeucovorinGiven: { type: Boolean, default: true }, // Axit Folic 50mg IV thúc đẩy phân hủy Acid Formic
      urgentHemodialysisIndicatedUnder6h: { type: Boolean, default: true }, // Bắt buộc lọc máu ngắt quãng cấp cứu đào thải độc chất < 6h
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 66. Cấp Cứu Hội Chứng Chèn Ép Khoang Bụng Cấp & Tăng Áp Lực Ổ Bụng Nặng (Abdominal Compartment Syndrome - ACS & IAH)
    abdominalCompartmentSyndromeCare: {
      isAbdominalCompartmentSyndrome: { type: Boolean, default: false },
      bladderPressureIapOver20MmHg: { type: Boolean, default: true }, // Áp lực bàng quang IAP > 20-25 mmHg
      oliguriaAndPeakAirwayPressureSpike: { type: Boolean, default: true }, // Tam chứng: Vô niệu + Áp lực đỉnh thở tăng vọt + Bụng căng cứng
      excessiveFluidOverloadStrictlyProhibited: { type: Boolean, default: true }, // Tuyệt đối cấm bù dịch quá tải làm ruột phù nề đẩy IAP lên đỉnh
      decompressiveLaparotomyIndicated: { type: Boolean, default: true }, // Chỉ định mổ mở toang bụng giải áp cấp cứu
      gastricAndRectalDecompressionApplied: { type: Boolean, default: true }, // Sonde dạ dày và trực tràng giải áp xả dịch hơi
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 67. Cấp Cứu Chấn Thương Nhãn Cầu Thủng & Vỡ Nhãn Cầu Mở (Open Globe Injury - OGI & Seidel Test)
    openGlobeInjuryCare: {
      isOpenGlobeInjury: { type: Boolean, default: false },
      seidelTestPositive: { type: Boolean, default: true }, // Nghiệm pháp Seidel dương tính dòng thác thủy dịch rò rỉ buồng trước
      teardropPupilPresent: { type: Boolean, default: true }, // Đồng tử hình giọt nước chỉ về mép vết rách giác mạc
      rigidEyeShieldAppliedNoPressure: { type: Boolean, default: true }, // Khiên cứng bảo vệ mắt tựa bờ xương ổ mắt không tỳ đè
      pressureAndEyeRubbingStrictlyProhibited: { type: Boolean, default: true }, // Tuyệt đối CẤM đè ép, dụi mắt, băng ép làm phòi nội nhãn
      succinylcholineStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo CẤM dùng Succinylcholine làm tăng nhãn áp tống xuất phòi tạng mắt
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 68. Cấp Cứu Trụy Tuần Hoàn Do Ngộ Độc Kháng Đông Mới (Direct Oral Anticoagulants - DOACs Bleeding Crisis)
    doacBleedingCrisisCare: {
      isDoacBleedingCrisis: { type: Boolean, default: false },
      doacAgent: {
        type: String,
        enum: ['DABIGATRAN_IIA', 'RIVAROXABAN_XA', 'APIXABAN_XA', 'EDOXABAN_XA'],
        default: 'DABIGATRAN_IIA',
      },
      specificAntidoteAdministered: { type: Boolean, default: true }, // Idarucizumab 5g IV hoặc Andexanet Alfa / 4-Factor PCC 50 IU/kg
      ffpAloneStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM truyền FFP đơn thuần gây phù phổi quá tải TACO
      vitaminKProhibitedForDoacs: { type: Boolean, default: true }, // Cảnh báo Vitamin K hoàn toàn vô tác dụng trên thuốc chống đông DOACs
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 69. Cấp Cứu Vỡ Tim Do Chấn Thương Ngực Kín & Dập Cơ Tim (Blunt Cardiac Rupture & Myocardial Contusion)
    bluntCardiacRuptureCare: {
      isBluntCardiacRupture: { type: Boolean, default: false },
      swirlingHemopericardiumAfiEfast: { type: Boolean, default: true }, // E-FAST tràn máu màng tim có cục máu đông xoáy cuộn
      newCardiacMurmurOrArrhythmia: { type: Boolean, default: true }, // Tiếng thổi tim mới xuất hiện đứt van/thủng vách hoặc loạn nhịp thất
      thrombolyticsStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM tiêu sợi huyết tPA làm toác vỡ tim tức thì
      excessiveFluidOverloadRvProhibited: { type: Boolean, default: true }, // Hạn chế quá tải dịch trong dập thất phải tránh ép vách liên thất
      emergentCardiopulmonaryBypassCecIndicated: { type: Boolean, default: true }, // Chỉ định mổ tim hở chạy máy tim phổi nhân tạo CEC khẩn cấp
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 70. Cấp Cứu Thuyên Tắc Khí Áp Lực Hệ Tĩnh Mạch Trung Tâm & Tư Thế Durant (Venous Air Embolism & Durant Maneuver)
    venousAirEmbolismCare: {
      isVenousAirEmbolism: { type: Boolean, default: false },
      durantManeuverAppliedLeftLateralTrendelenburg: { type: Boolean, default: true }, // Tư thế Durant: Nằm nghiêng trái kết hợp Trendelenburg đầu dốc 15-30 độ
      highFlowOxygen100NitrogenWashout: { type: Boolean, default: true }, // Thở oxy 100% NRM tạo chênh lệch áp suất rửa trôi khí Nitơ hòa tan bọt khí
      uprightSittingPositionStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM ngồi dậy làm bọt khí bốc lên não gây đột quỵ
      highPeepVentilationStrictlyProhibited: { type: Boolean, default: true }, // Tuyệt đối CẤM thở máy PEEP cao đẩy khí qua lỗ PFO sang tuần hoàn tim trái
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 71. Cấp Cứu Cơn Tăng Áp Lực Tĩnh Mạch Cửa & Xuất Huyết Giãn Vỡ Tĩnh Mạch Thực Quản (Esophageal Variceal Bleeding & Sengstaken Tube)
    esophagealVaricealBleedingCare: {
      isEsophagealVaricealBleeding: { type: Boolean, default: false },
      massiveHematemesisCirrhosisPresent: { type: Boolean, default: true }, // Nôn ra máu đỏ tươi ồ ạt kèm tiền sử xơ gan tăng áp cửa
      vasoactiveTerlipressinOrOctreotideGiven: { type: Boolean, default: true }, // Thuốc co mạch tạng Terlipressin 2mg hoặc Octreotide giảm áp lực cửa
      restrictiveTransfusionEnforced: { type: Boolean, default: true }, // Chiến lược truyền máu hạn chế mục tiêu Hb 7-8 g/dL tránh tăng áp cửa dội ngược
      excessiveFluidResuscitationStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch quá mức làm bung nút cầm máu
      sengstakenBlakemoreTubeAvailable: { type: Boolean, default: true }, // Sẵn sàng bóng chèn Sengstaken-Blakemore hoặc Minnesota cầm máu cơ học khẩn cấp
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },

    // 72. Cấp Cứu Ngạt Khí Do Hít Khói Đám Cháy & Ngộ Độc Khí Cyanide / Phỏng Đường Thở (Smoke Inhalation, Cyanide & Inhalation Injury)
    smokeInhalationCyanideCare: {
      isSmokeInhalationCyanide: { type: Boolean, default: false },
      carbonaceousSputumAndFacialBurns: { type: Boolean, default: true }, // Đờm lẫn muội than bồ hóng, cháy sém lông mũi lông mi, khàn giọng thở rít
      severeLacticAcidosisOver8: { type: Boolean, default: true }, // Toan chuyển hóa Lactic nặng > 8 mmol/L do Cyanide ức chế hô hấp tế bào
      hydroxocobalaminCyanokitAdministered: { type: Boolean, default: true }, // Thuốc giải độc đặc hiệu Hydroxocobalamin (Cyanokit) 5g IV
      nitritesContraindicatedForCoStrictlyEnforced: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM Sodium Nitrite khi nghi ngờ có ngộ độc CO kèm theo
      prophylacticEarlyIntubationIndicated: { type: Boolean, default: true }, // Chỉ định đặt nội khí quản bảo vệ đường thở dự phòng sớm trước khi phù nề thanh môn
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    biphasicAnaphylaxisCare: {
      isBiphasicAnaphylaxis: { type: Boolean, default: false },
      biphasicRecurrenceAfterInitialStabilization: { type: Boolean, default: true }, // Sốc phản vệ pha hai tái phát đột ngột sau khi đã cắt cơn ban đầu 1-72h
      concurrentBetaBlockerTherapy: { type: Boolean, default: true }, // Bệnh nhân đang dùng thuốc chẹn Beta gây trơ/kháng trị Adrenaline
      glucagonIvAdministeredSlow5Min: { type: Boolean, default: true }, // Glucagon 1-5mg IV tiêm chậm >= 5 phút kích hoạt Adenylate Cyclase độc lập
      prematureDischargeStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM cho nạn nhân về sớm khi vừa dứt triệu chứng đợt 1
      rapidGlucagonBolusStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM tiêm bolus Glucagon nhanh tránh nôn mửa sặc tắc thở
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    torsadesDePointesCare: {
      isTorsadesDePointes: { type: Boolean, default: false },
      prolongedQtcIntervalOver500ms: { type: Boolean, default: true }, // Khoảng QTc kéo dài > 500ms do thuốc hoặc rối loạn điện giải
      magnesiumSulfateIvAdministered1to2g: { type: Boolean, default: true }, // Magnesium Sulfate 2g IV tiêm truyền tĩnh mạch 1-2 phút
      classIaAndIiiAntiarrhythmicsStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM thuốc chống loạn nhịp nhóm Ia và III (Amiodarone)
      synchronizedCardioversionProhibitedInTdp: { type: Boolean, default: true }, // Khóa cảnh báo cấm sốc điện đồng bộ trong nhịp xoắn đỉnh đa hình thái
      unsynchronizedDefibrillationReadyForVf: { type: Boolean, default: true }, // Sẵn sàng sốc điện khử rung không đồng bộ 200J ngay khi thoái triển sang Rung thất VF
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    massiveHemothoraxCare: {
      isMassiveHemothorax: { type: Boolean, default: false },
      initialChestDrainageOver1500mlOr200mlPerHour: { type: Boolean, default: true }, // Tràn máu màng phổi lượng lớn >= 1,500 mL hoặc > 200 mL/h trong 3 giờ
      largeBoreChestTubeInserted28to32Fr: { type: Boolean, default: true }, // Đặt ống dẫn lưu ngực kích thước lớn 28-32 Fr liên sườn 5 đường nách giữa
      clampingChestTubeStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM kẹp ống dẫn lưu gây tràn máu màng phổi áp lực ngừng tim
      smallNeedleAspirationStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM chọc hút bằng kim nhỏ tránh đông máu bít tắc
      emergentThoracotomyIndicated: { type: Boolean, default: true }, // Kích hoạt chỉ định phẫu thuật mở ngực cấp cứu khẩn cấp tại phòng mổ
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    postpartumHemorrhageCare: {
      isPostpartumHemorrhage: { type: Boolean, default: false },
      estimatedBloodLossOver1000mlOrShock: { type: Boolean, default: true }, // Lượng máu mất >= 1,000 mL hoặc có dấu hiệu sốc mất máu sau sinh
      oxytocinAndBimanualUterineMassageDone: { type: Boolean, default: true }, // Xoa đáy tử cung hai tay liên tục và tiêm bắp/truyền tĩnh mạch Oxytocin
      tranexamicAcid1gIvWithin3HoursGiven: { type: Boolean, default: true }, // Tranexamic Acid (TXA) 1g IV trong vòng 3 giờ đầu chuẩn thử nghiệm WOMAN Trial
      methylergometrineStrictlyProhibitedInHypertension: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM Methylergometrine ở sản phụ tăng HA/tiền sản giật
      bakriBalloonTamponadePrepared: { type: Boolean, default: true }, // Chuẩn bị sẵn bóng chèn lòng tử cung Bakri bơm 300-500 mL nước muối sinh lý ấm
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    massivePulmonaryEmbolismCare: {
      isMassivePulmonaryEmbolism: { type: Boolean, default: false },
      hemodynamicInstabilitySbpUnder90: { type: Boolean, default: true }, // Huyết động không ổn định SBP < 90 mmHg hoặc tụt > 40 mmHg do tắc mạch phổi
      mcconnellSignOrRvStrainEchoDetected: { type: Boolean, default: true }, // Siêu âm tim tại giường phát hiện dấu hiệu McConnell và dãn buồng thất phải cấp
      bedsideSystemicThrombolysisIndicated: { type: Boolean, default: true }, // Chỉ định tiêu sợi huyết Alteplase (rt-PA) 50-100 mg IV cấp cứu
      aggressiveFluidOverloadStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch quá tải (> 500 mL) gây đè ép thất trái ngừng tim
      vaEcmoSupportReadyForRefractoryShock: { type: Boolean, default: true }, // Kíp VA-ECMO bảo vệ tuần hoàn sẵn sàng nếu sốc tắc mạch phổi trơ với thuốc
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    pediatricEpiglottitisCare: {
      isPediatricEpiglottitis: { type: Boolean, default: false },
      tripodSniffingPositionAndDrooling: { type: Boolean, default: true }, // Trẻ ngồi chồm ngửa cổ (Sniffing/Tripod), chảy nước dãi, thở rít thì hít vào
      calmHumidifiedOxygenSupport: { type: Boolean, default: true }, // Giữ trẻ bình tĩnh trong lòng mẹ, thở oxy ẩm nhẹ nhàng tránh kích động khóc
      tongueDepressorOralExamStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng đè lưỡi khám họng gây co thắt tắc thở tử vong
      supinePositionStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM bắt trẻ nằm ngửa làm nắp thanh quản đổ sụp che kín đường thở
      emergencyEntAirwayTeamAlerted: { type: Boolean, default: true }, // Báo động kíp Tai Mũi Họng và Gây mê hồi sức Nhi mở màng nhẫn giáp vi phẫu khẩn
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    neurogenicShockCare: {
      isNeurogenicShock: { type: Boolean, default: false },
      bradycardiaAndHypotensionT6Above: { type: Boolean, default: true }, // Tổn thương tủy cổ/ngực cao >= T6 gây tụt HA SBP < 90 mmHg kèm nhịp chậm nghịch thường < 60 bpm và da ấm khô
      vasopressorMap85to90Maintained: { type: Boolean, default: true }, // Sử dụng sớm Norepinephrine/Dopamine duy trì MAP >= 85-90 mmHg liên tục 7 ngày chống thiếu máu hoại tử tủy
      fluidOverloadStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch quá mức (> 2,000 mL) gây phù phổi cấp chết đuối trên cạn và phù tủy sống
      phenylephrineAloneStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng Phenylephrine đơn thuần vì kích thích alpha1 gây nhịp chậm phản xạ vô tâm thu ngừng tim
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    penetratingNeckTraumaCare: {
      isPenetratingNeckTrauma: { type: Boolean, default: false },
      expandingPulsatileHematomaOrStridor: { type: Boolean, default: true }, // Dấu hiệu Hard Signs: Khối máu tụ đập theo nhịp lan nhanh, thở rít Stridor, khàn tiếng đe dọa nghẹt thở
      directManualPressureAppliedNoCircumferentialBandage: { type: Boolean, default: true }, // Ấn đè trực tiếp bằng tay liên tục lên vị trí vết thương xuyên thấu bằng gạc vô trùng
      circumferentialNeckBandageStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM băng ép vòng quanh cổ gây nghẹt thở cơ học và chèn ép động mạch cảnh ngừng tuần hoàn não
      blindClampingStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM kẹp Hemostat mò trong vết thương cổ gây đứt mạch cảnh hoặc liệt dây thần kinh X vĩnh viễn
      emergencyAirwayOrCricothyroidotomyReady: { type: Boolean, default: true }, // Sẵn sàng kíp đặt nội khí quản qua Video Laryngoscope hoặc mở màng nhẫn giáp vi phẫu khẩn cấp
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    deliriumTremensCare: {
      isDeliriumTremens: { type: Boolean, default: false },
      ciwaArScoreOver15AutonomicStorm: { type: Boolean, default: true }, // Cơn bão giao cảm cai rượu tối cấp 48-96h: CIWA-Ar >= 15-20, sốt cao > 38.5C, mạch nhanh > 120 bpm, ảo giác ghê rợn
      highDoseDiazepamIvTitrated: { type: Boolean, default: true }, // An thần liều cao Benzodiazepine: Diazepam 10-20mg IV tiêm chậm mỗi 5-15 phút chuẩn độ theo thang điểm CIWA-Ar
      thiamineGivenBeforeDextroseEnforced: { type: Boolean, default: true }, // Khóa bảo vệ não BẮT BUỘC tiêm Thiamine (Vitamin B1) 100-500mg IV TRƯỚC Glucose tránh Hội chứng não Wernicke hoại tử não
      haloperidolAloneStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng Haloperidol đơn độc không kèm Benzodiazepine do hạ ngưỡng co giật và kéo dài khoảng QT gây TdP
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    impaledThoracicTraumaCare: {
      isImpaledThoracicTrauma: { type: Boolean, default: false },
      impaledObjectInSituStabilizedWithBulkyDressing: { type: Boolean, default: true }, // Bất động dị vật tại chỗ bằng gạc cuộn hình bánh donut, chống xê dịch theo nhịp thở và nhịp tim
      removalOfImpaledObjectStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM rút dị vật tại hiện trường hoặc trên xe cấp cứu gây mất nút bít phụt máu ngừng tim tử vong trong 60s
      directPressureOnObjectStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM đè ép trực tiếp lên dị vật tránh đẩy dị vật cắm sâu xé toác buồng tim
      becksTriadTamponadeMonitored: { type: Boolean, default: true }, // Giám sát liên tục Tam chứng Beck (tụt HA, tĩnh mạch cổ nổi, tiếng tim mờ xa xăm) phát hiện sớm chèn ép tim cấp
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    severeCerebralMalariaCare: {
      isSevereCerebralMalaria: { type: Boolean, default: false },
      comaAndPlasmodiumFalciparumHighParasitemia: { type: Boolean, default: true }, // Nhiễm Plasmodium falciparum thể não: hôn mê sâu, co giật liên tục, toan lactic nặng và tan máu ồ ạt
      intravenousArtesunate2Point4MgPerKgAdministered: { type: Boolean, default: true }, // Phác đồ chuẩn WHO: Tiêm tĩnh mạch Artesunate 2.4 mg/kg IV chậm tại các mốc 0h, 12h, 24h
      corticosteroidsStrictlyProhibitedInCerebralMalaria: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng Corticosteroid Dexamethasone vì làm kéo dài hôn mê và tăng tỷ lệ tử vong
      fluidOverloadStrictlyProhibitedInMalaria: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch quá tải gây phù phổi cấp tổn thương ARDS chết đuối trên cạn
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    gradeVRenalAvulsionCare: {
      isGradeVRenalAvulsion: { type: Boolean, default: false },
      flankHematomaAndHematuriaWithShock: { type: Boolean, default: true }, // Khối máu tụ hông lưng lan nhanh Grey Turner, đái máu đại thể hoặc vô niệu một bên, tụt HA do vỡ thận độ V / đứt cuống mạch
      permissiveHypotensionSbp80to90Maintained: { type: Boolean, default: true }, // Hồi sức kiểm soát tổn thương DCR duy trì SBP 80-90 mmHg bảo tồn cục máu đông khoang sau phúc mạc
      aggressiveFlankPalpationStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM nắn ép mạnh hông lưng gây rách mạc Gerota làm máu tràn tự do ổ bụng ngừng tim tức thì
      aggressiveNormalSalineOverloadStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM nâng HA bình thường bằng dịch tinh thể gây loãng máu bục toác cuống mạch thận
      emergencyAngioembolizationOrSurgeryAlerted: { type: Boolean, default: true }, // Báo động kíp DSA nút mạch can thiệp khẩn hoặc phẫu thuật thắt cuống mạch thận cấp cứu
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 67. Cấp Cứu Sốc Nhiệt Ác Tính Khi Gắng Sức & Ngâm Nước Đá Lạnh Toàn Thân (Exertional Heat Stroke & CWI Golden 30 Mins)
    exertionalHeatStrokeCare: {
      isExertionalHeatStroke: { type: Boolean, default: false },
      coreTemperatureC: { type: Number, default: 40.5 }, // Thân nhiệt lõi (trực tràng) > 40.5°C kèm rối loạn chức năng hệ thần kinh trung ương (kích động, mê sảng, co giật, hôn mê)
      coldWaterImmersionInitiated: { type: Boolean, default: true }, // Tiêu chuẩn vàng: Ngâm nước đá lạnh toàn thân (CWI 1.5 - 15°C) từ cổ trở xuống, khuấy nước liên tục
      targetCoreTemp38Point8CReached: { type: Boolean, default: true }, // Hạ nhiệt độ lõi xuống dưới 39.0°C (mục tiêu 38.6 - 38.8°C) trong 30 phút vàng (Golden 30 Mins) chống hoại tử đa tạng
      antipyreticsStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng thuốc hạ sốt Paracetamol/Aspirin (vô hiệu do không đổi điểm đặt dưới đồi và gây hoại tử tế bào gan cấp/loét xuất huyết)
      transportBeforeCoolingStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM chuyển nạn nhân lên xe cấp cứu khi chưa hạ nhiệt độ lõi xuống < 39°C ("Cool First, Transport Second")
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 68. Cấp Cứu Bỏng Hóa Chất Công Nghiệp Diện Rộng & Dung Dịch Lưỡng Tính Diphoterine (Severe Chemical Burns & Decontamination)
    severeChemicalBurnsCare: {
      isSevereChemicalBurns: { type: Boolean, default: false },
      chemicalAgentType: { type: String, default: 'CONCENTRATED_ACID_OR_ALKALI' }, // Axit đặc (hoại tử đông Coagulation Necrosis) hoặc Kiềm mạnh (hoại tử hóa lỏng ăn sâu Liquefaction Necrosis)
      copiousDecontaminationSolutionUsed: { type: Boolean, default: true }, // Tưới rửa liên tục 30-60 phút bằng nước ấm sạch áp lực nhẹ hoặc dung dịch lưỡng tính Diphoterine
      neutralizingAgentsStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng hóa chất đối kháng trung hòa (đổ axit vào kiềm hoặc ngược lại sinh nhiệt Exothermic Heat thiêu đốt mô sống)
      highPressureWaterStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng vòi nước áp lực cao (gây xé rách da trợt loét và đẩy hóa chất ngấm sâu vào mô mạch máu)
      ocularIrrigationTargetPHReached: { type: Boolean, default: true }, // Nếu tổn thương mắt: Xối rửa từ góc trong ra góc ngoài mắt ít nhất 30 phút, kiểm tra pH cùng đồ đạt 7.0 - 7.4
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 69. Cấp Cứu Chấn Thương Vỡ Gan Độ V & Nghiệm Pháp Pringle / Chèn Gạc Quanh Gan (Grade V Hepatic Laceration & DCS)
    gradeVHepaticTraumaCare: {
      isGradeVHepaticTrauma: { type: Boolean, default: false },
      massiveHemoperitoneumWithShock: { type: Boolean, default: true }, // Vỡ gan độ V (AAST Grade V) rách nhu mô > 75% hoặc rách tĩnh mạch gan/tĩnh mạch chủ sau gan, tràn máu ổ bụng > 1,500 mL gây sốc mất máu nặng
      damageControlPringleManeuverClamped: { type: Boolean, default: true }, // Phẫu thuật kiểm soát tổn thương DCS: Nghiệm pháp Pringle kẹp cuống gan <= 15-20 phút (xả 5 phút)
      perihepaticPackingApplied: { type: Boolean, default: true }, // Chèn ép quanh gan bằng 6-10 miếng gạc lớn (Perihepatic Packing) cầm máu cơ học ép chặt nhu mô
      earlyUnpackingStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM lấy bỏ gạc chèn (unpacking) sớm trước 48-72 giờ (tránh bục toác tái xuất huyết dữ dội tử vong ngay trên bàn mổ)
      blindRetrohepaticSutureStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM khâu mò tĩnh mạch sau gan hoặc cố cắt gan rộng trong giai đoạn đầu sốc mất máu
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 70. Cấp Cứu Chấn Thương Vỡ Lách Độ V Mất Máu Ồ Ạt & Cắt Lách Cấp Cứu / Nút Mạch Can Thiệp DSA (Grade V Splenic Rupture & DCR)
    gradeVSplenicRuptureCare: {
      isGradeVSplenicRupture: { type: Boolean, default: false },
      shatteredSpleenOrVascularAvulsion: { type: Boolean, default: true }, // Lách dập nát vỡ vụn độ V (AAST Grade V) hoặc đứt toạc cuống động - tĩnh mạch lách, tràn máu ổ bụng > 1,500 mL, dấu hiệu Kehr đau nhói vai trái
      permissiveHypotensionSbp80to90Maintained: { type: Boolean, default: true }, // Hồi sức kiểm soát tổn thương DCR duy trì SBP 80-90 mmHg và kích hoạt MTP 1:1:1 bảo tồn cục máu đông cuống lách
      aggressiveFluidOverloadStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch muối tinh thể ồ ạt làm loãng máu hạ thân nhiệt và bục toác cuống lách tử vong
      ctScanDelayInUnstableShockStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM trì hoãn đưa bệnh nhân sốc mất máu không ổn định vào phòng chụp CT ("Donut of Death") mà phải mổ mở khẩn cấp
      postSplenectomyOpsivaccineAlerted: { type: Boolean, default: true }, // Báo động lịch tiêm phòng vắc xin phế cầu, não mô cầu, Hib sau cắt lách phòng ngừa nhiễm trùng huyết tối cấp OPSI
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 71. Cấp Cứu Ngộ Độc Cấp Thuốc Trừ Sâu Nhôm Photphua / Khí Độc Phosphine (Aluminium Phosphide Poisoning & Coconut Oil / NaHCO3)
    aluminiumPhosphidePoisoningCare: {
      isAluminiumPhosphidePoisoning: { type: Boolean, default: false },
      garlicFishyOdorAndShock: { type: Boolean, default: true }, // Hơi thở mùi cá ươn/tỏi thối nồng nặc đặc trưng của khí độc Phosphine (PH3), toan chuyển hóa lactic nặng và tụt HA kháng vận mạch
      coconutOilOrParaffinAdministered: { type: Boolean, default: true }, // Cho uống ngay 100-200 mL dầu dừa tinh khiết tạo màng lipid bọc kín hạt AlP ức chế phản ứng sinh khí Phosphine với dịch vị
      sodiumBicarbonateGastricLavage5Percent: { type: Boolean, default: true }, // Rửa dạ dày bằng dung dịch NaHCO3 5% kiềm hóa môi trường dạ dày triệt tiêu ion H+ dừng giải phóng PH3
      plainWaterGastricLavageStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM rửa dạ dày bằng nước lã thông thường (nước kích hoạt bùng nổ phản ứng sinh khí PH3 ồ ạt ngừng tim tức thì)
      unventilatedRescuerExposureStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM nhân viên sơ cứu tiếp xúc trong phòng kín không thông gió (tránh ngộ độc khí Phosphine hít vào)
      cardiacArrestEcmoAlerted: { type: Boolean, default: true }, // Báo động kíp Hồi sức Chống độc sẵn sàng can thiệp VA-ECMO và lọc máu hấp phụ than hoạt hemoperfusion
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 72. Cấp Cứu Tràn Khí Màng Phổi Do Hở Thành Ngực & Băng Van 3 Cạnh (Open Sucking Chest Wound & Three-Sided Flutter Valve)
    openSuckingChestWoundCare: {
      isOpenSuckingChestWound: { type: Boolean, default: false },
      suckingChestHissingSoundWithFlutter: { type: Boolean, default: true }, // Vết thương thấu ngực rít gió phì phò theo nhịp thở (Sucking Chest Wound), xẹp phổi và lắc lư trung thất cản trở máu về tim
      threeSidedFlutterValveDressingApplied: { type: Boolean, default: true }, // Đặt gạc vô trùng không thấm khí dán kín 3 CẠNH chừa 1 CẠNH TỰ DO phía dưới đóng vai trò van 1 chiều xả khí/máu ra ngoài khi thở ra
      fourSidedOcclusiveDressingStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM băng bịt kín cả 4 cạnh (biến thành tràn khí màng phổi áp lực cao Tension Pneumothorax tử vong trong vài phút)
      woundPackingStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM nhét gạc chèn sâu vào lỗ thủng ngực làm rách nhu mô phổi và nhiễm trùng trung thất
      chestTubeUnderwaterSealAlerted: { type: Boolean, default: true }, // Báo động kíp Ngoại Lồng ngực chuẩn bị đặt ống dẫn lưu khoang màng phổi kín (Chest Tube 28-32 Fr có van nước)
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 73. Cấp Cứu Đợt Bùng Phát Nhược Cơ Nặng & Cơn Bão Nhược Cơ Suy Hô Hấp Cấp (Myasthenic Crisis & Plasma Exchange / IVIG)
    myasthenicCrisisRespiratoryFailureCare: {
      isMyasthenicCrisis: { type: Boolean, default: false },
      vitalCapacityBelow15mLKgWithParalysis: { type: Boolean, default: true }, // Nhược cơ bùng phát liệt cơ hô hấp: Dung tích sống VC < 15 mL/kg, NIF < -20 cmH2O (Quy tắc 20/30/40), sụp mi, khó nuốt, kiệt cơ thở
      emergencyIntubationOrBiPapInitiated: { type: Boolean, default: true }, // Đặt nội khí quản thở máy sớm bảo vệ đường thở trước khi ngừng thở hoàn toàn
      plasmaExchangeOrIvigAlerted: { type: Boolean, default: true }, // Khởi động phác đồ thay huyết tương cấp cứu PLEX 5-6 chu kỳ hoặc Globulin miễn dịch IVIG 2 g/kg loại bỏ tự kháng thể kháng AChR
      contraindicatedDrugsStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM kháng sinh Aminoglycoside (Gentamicin, Amikacin), Macrolide, Quinolone, chẹn Beta, chẹn Canxi, Magnesium (gây liệt cơ bùng phát tử vong)
      unprotectedSedativesStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng thuốc an thần Morphine/Benzodiazepine khi chưa đặt nội khí quản kiểm soát thở máy
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 74. Cấp Cứu Sốc Mất Máu Do Vỡ Búi Giãn Tĩnh Mạch Phình Vị Dạ Dày & Tiêm Keo Sinh Học Histoacryl / TIPS (Gastric Variceal Bleeding Sarin IGV1 & Glue)
    gastricVaricealBleedingCare: {
      isGastricVaricealBleeding: { type: Boolean, default: false },
      sarinClassification: { type: String, default: 'IGV1_ISOLATED_GASTRIC_VARICES_1' }, // Phân loại Sarin IGV1/GOV2 búi phình vị khổng lồ vỡ xuất huyết ồ ạt tụt huyết áp
      cyanoacrylateGlueInjectionLipiodolRatio1to1: { type: Boolean, default: true }, // Tiêm keo sinh học Histoacryl (N-butyl-2-cyanoacrylate) pha Lipiodol tỷ lệ 1:1 hoặc can thiệp TIPS/BRTO
      vasoactiveTerlipressinAndCeftriaxoneAdministered: { type: Boolean, default: true }, // Dùng thuốc co mạch tạng Terlipressin 2mg IV bolus mỗi 4h và Ceftriaxone 1g/ngày chống nhiễm trùng báng SBP
      bandLigationStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM thắt vòng cao su EVL trên búi phình vị to IGV1/GOV2 làm rách toác chảy máu xối xả tử vong ngay trên bàn soi
      pureGlueWithoutLipiodolStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM tiêm keo nguyên chất không pha Lipiodol hoặc tiêm quá nhanh gây thuyên tắc phổi PE và não tối cấp
      permissiveHypotensionTargetSbp90to100: { type: Boolean, default: true }, // Chỉ duy trì huyết áp SBP 90-100 mmHg và Hb 7-8 g/dL tránh tăng áp lực cửa tái xuất huyết
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 75. Cấp Cứu Chấn Thương Đụng Dập Rách Khí Phế Quản Lớn & Tràn Khí Dưới Da Khổng Lồ (Tracheobronchial Rupture & Massive Subcutaneous Emphysema)
    tracheobronchialRuptureCare: {
      isTracheobronchialRupture: { type: Boolean, default: false },
      massiveSubcutaneousEmphysemaAndAirLeak: { type: Boolean, default: true }, // Tràn khí dưới da khổng lồ mặt cổ ngực, ho ra máu tươi, đặt ống dẫn lưu ngực nhưng khí xì bọt ồ ạt liên tục phổi không nở
      fiberopticBronchoscopyGuidedIntubation: { type: Boolean, default: true }, // Nội soi phế quản ống mềm khẩn cấp định vị vết rách và đặt ống NKQ chọn lọc qua chỗ rách vào phế quản bên lành
      highPositivePressureVentilationStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM thở máy áp lực dương cao PIP/PEEP cao trước khi kiểm soát chỗ rách tránh tràn khí trung thất áp lực cao đè bẹp tim
      blindIntubationStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM đặt nội khí quản mò chọc toác qua chỗ rách tạo đường dò giả khổng lồ vào trung thất tử vong
      thoracicSurgicalRepairAlerted: { type: Boolean, default: true }, // Báo động phòng mổ Ngoại Lồng ngực khẩn cấp mở ngực khâu nối phục hồi khí phế quản rách
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 76. Cấp Cứu Ngộ Độc Cấp Thuốc Chống Trầm Cảm 3 Vòng & Kiềm Hóa Natri Bicarbonate 8.4% (Tricyclic Antidepressant TCA Toxicity & NaHCO3)
    tcaToxicityCare: {
      isTcaToxicity: { type: Boolean, default: false },
      wideQrsAndAnticholinergicToxidrome: { type: Boolean, default: true }, // Quá liều Amitriptyline: QRS giãn rộng >= 100-160 ms, sóng R ở aVR >= 3 mm, mê sảng đồng tử giãn, tụt huyết áp nặng
      sodiumBicarbonateHypertonicAlkalinization: { type: Boolean, default: true }, // Tiêm bolus NaHCO3 8.4% 1-2 mEq/kg IV mỗi 3-5 phút kiềm hóa máu duy trì pH 7.45 - 7.55 và QRS hẹp lại < 100 ms
      classIaAndIcAndAmiodaroneStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM thuốc chống loạn nhịp nhóm IA, IC và Amiodarone nhóm III vì ức chế kênh Natri kéo dài QT gây ngừng tim trơ
      physostigmineStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng Physostigmine trong ngộ độc TCA vì gây nhịp chậm nặng và vô tâm thu Asystole đột ngột
      intralipid20PercentRescueAlerted: { type: Boolean, default: true }, // Sẵn sàng truyền nhũ dịch lipid Intralipid 20% khi tụt HA và loạn nhịp thất trơ với Bicarbonate và vận mạch
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 77. Cấp Cứu Hội Chứng Thuyên Tắc Ối Tối Cấp & Phác Đồ A-OK (Amniotic Fluid Embolism AFE & Atropine / Ondansetron / Ketorolac)
    amnioticFluidEmbolismCare: {
      isAmnioticFluidEmbolism: { type: Boolean, default: false },
      suddenHypoxiaCollapseAndDic: { type: Boolean, default: true }, // Tam chứng AFE: Suy hô hấp đột ngột + Tụt HA trụy mạch suy thất phải cấp + Đông máu nội mạch rải rác DIC bùng phát máu không đông
      aOkProtocolAdministered: { type: Boolean, default: true }, // Kích hoạt phác đồ A-OK: Atropine 0.2-1mg IV + Ondansetron 8mg IV + Ketorolac 15-30mg IV chặn phản xạ phế vị, co mạch phổi và bão Thromboxane A2
      fluidOverloadStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch tinh thể quá tải làm suy sụp hoàn toàn thất phải đang căng giãn quá mức và đè bẹp thất trái tử vong
      delayedPmcdStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM trì hoãn mổ bắt con cấp cứu cứu mẹ PMCD trong vòng 4-5 phút vàng khi mẹ ngừng tuần hoàn
      massiveTransfusionMtpWithCryoAlerted: { type: Boolean, default: true }, // Kích hoạt quy trình truyền máu khối lượng lớn MTP 1:1:1 kèm Fibrinogen cô đặc / Tủa lạnh Cryoprecipitate và Tranexamic Acid TXA 1g
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 78. Cấp Cứu Hội Chứng Hít Phân Su Sơ Sinh Tối Cấp & Thở Máy Rung Cao Tần / Surfactant (Meconium Aspiration Syndrome MAS & HFOV)
    meconiumAspirationCare: {
      isMeconiumAspiration: { type: Boolean, default: false },
      peaSoupMeconiumAndSevereDistress: { type: Boolean, default: true }, // Nước ối lẫn phân su sệt pea-soup, ngạt thở, bẫy khí phế nang, tăng áp phổi tồn tại sơ sinh PPHN
      surfactantAndHfovAdministered: { type: Boolean, default: true }, // Bơm Surfactant ngoại sinh 100-200 mg/kg nội khí quản và thở máy rung tần số cao HFOV bảo vệ phổi
      routineDeepSuctioningStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM hút đàm nhớt sâu qua khí quản thường quy khi trẻ đã khóc/thở gây phản xạ phế vị chậm nhịp ngừng thở
      uncontrolledHighPressureBaggingStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM bóp bóng áp lực cao bừa bãi khi chưa giải áp bẫy khí gây tràn khí màng phổi áp lực
      inhaledNitricOxideAndEcmoAlerted: { type: Boolean, default: true }, // Sẵn sàng khí thở giãn mạch phổi chọn lọc iNO 20 ppm và kích hoạt NICU Level IV sẵn sàng VA-ECMO sơ sinh
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 79. Cấp Cứu Ngộ Độc Methemoglobinemia Tối Cấp Do Hóa Chất Công Nghiệp & Phác Đồ Methylene Blue (Methemoglobinemia & Methylene Blue 1-2 mg/kg)
    methemoglobinemiaCare: {
      isMethemoglobinemia: { type: Boolean, default: false },
      refractoryCyanosisAndChocolateBlood: { type: Boolean, default: true }, // Tím tái không đáp ứng thở oxy 100%, máu rút ra màu socola sẫm không đổi màu, SpO2 xung mạch kẹt quanh mức 85%
      methyleneBlueAdministered: { type: Boolean, default: true }, // Tiêm tĩnh mạch chậm Xanh Methylen 1% liều 1-2 mg/kg (khử Fe3+ về Fe2+ qua NADPH-MetHb reductase)
      methyleneBlueInG6pdDeficiencyStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI Xanh Methylen ở bệnh nhân thiếu men G6PD vì gây tan máu nội mạch ồ ạt tử vong
      excessiveMethyleneBlueOver7mgStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM quá liều Xanh Methylen tích lũy > 7 mg/kg gây oxy hóa ngược tạo thêm MetHb
      ascorbicAcidAndExchangeTransfusionAlerted: { type: Boolean, default: true }, // Sẵn sàng Vitamin C Axit Ascorbic liều cao 1-2g IV hoặc thay máu cấp cứu khi thiếu men G6PD hoặc thất bại điều trị
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 80. Cấp Cứu Vỡ Túi Phình Động Mạch Tạng Tối Cấp & Can Thiệp Nút Mạch DSA / Stent-Graft (Visceral Artery Aneurysm Rupture & Coil Embolization)
    visceralAneurysmCare: {
      isVisceralAneurysm: { type: Boolean, default: false },
      doubleRupturePhenomenonIdentified: { type: Boolean, default: true }, // Nhận diện hiện tượng vỡ hai thì túi phình ĐM lách/gan: vỡ khu trú hậu cung mạc nối -> vỡ tự do vào ổ phúc mạc lớn
      permissiveHypotensionAndMtpActivated: { type: Boolean, default: true }, // Hồi sức kiểm soát tổn thương DCR: Hạ HA chỉ huy SBP 80-90 mmHg, kích hoạt MTP 1:1:1 và Tranexamic Acid TXA 1g
      forcefulEpigastricPalpationStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM ấn nắn thô bạo thượng vị hoặc chọc hút mò phá vỡ khối máu tụ mạc nối xả máu thì hai tử vong
      fluidOverloadSbpOver100StrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM bù dịch quá tải nâng SBP > 100 mmHg trước can thiệp làm bung nút đông máu tại chỗ vỡ
      dsaCoilEmbolizationOrStentAlerted: { type: Boolean, default: true }, // Báo động khẩn cấp phòng can thiệp mạch DSA / Hybrid OR nút mạch sandwich coils hoặc đặt covered stent-graft
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 81. Cấp Cứu Cơn Hạ Canxi Máu Tối Cấp Kèm Co Thắt Thanh Quản & Dấu Hiệu Trousseau (Acute Hypocalcemia & Calcium Gluconate 10% IV)
    acuteHypocalcemiaCare: {
      isAcuteHypocalcemia: { type: Boolean, default: false },
      tetanyStridorAndProlongedQtc: { type: Boolean, default: true }, // Dấu hiệu Trousseau bàn tay đỡ đẻ, co thắt thanh quản Stridor nguy kịch, QTc kéo dài nguy cơ xoắn đỉnh TdP và rung thất
      slowIvCalciumGluconateAdministered: { type: Boolean, default: true }, // Tiêm truyền tĩnh mạch chậm Calcium Gluconate 10% (10-20 mL trong 10-20 phút) dưới monitor ECG liên tục
      rapidPeripheralCalciumChlorideStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo CHỐNG CHỈ ĐỊNH tiêm tĩnh mạch nhanh Calcium Chloride ngoại vi vì hoại tử mô sâu và ngừng tim asystole
      coInfusionWithPhosphateOrBicarbonateStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM tiêm chung Calci với Bicarbonate hoặc Phosphat vì tạo kết tủa gây tắc mạch phổi
      concurrentMagnesiumSulfateAlerted: { type: Boolean, default: true }, // Bù đồng thời Magnesium Sulfate 1-2g IV chống trơ thụ thể PTH và duy trì truyền Canxi 0.5-1.5 mg/kg/h
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 82. Cấp Cứu Sốc Phản Vệ Tối Cấp Do Thuốc Cản Quang Chứa Iod & Phác Đồ Adrenaline IM (Severe Contrast-Induced Anaphylaxis & Adrenaline IM)
    severeContrastAnaphylaxisCare: {
      isSevereContrastAnaphylaxis: { type: Boolean, default: false },
      iodinatedContrastAdministeredWithCirculatoryCollapse: { type: Boolean, default: true }, // Sốc phản vệ độ III/IV xảy ra tức thì sau tiêm cản quang iod CT/DSA: SBP < 70, trụy mạch, phù Quincke thanh quản tắc thở
      adrenalineImAnterolateralThighAdministered: { type: Boolean, default: true }, // Tiêm bắp Adrenaline 1:1,000 liều 0.5mg ngay mặt trước ngoài đùi, lặp lại mỗi 5-10 phút
      unalteredPureAdrenalineIvStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM tiêm tĩnh mạch trực tiếp Adrenaline ống nguyên chất 1:1,000 không pha loãng (gây rung thất, tai biến xuất huyết não tử vong)
      antihistamineSteroidDelayStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng kháng Histamin/Corticoid thay thế Adrenaline làm mất thời gian vàng cấp cứu phản vệ
      massiveIsotonicVolumeExpansionAlerted: { type: Boolean, default: true }, // Bolus dịch tinh thể mảng lớn 1-2L giải quyết thoát mạch tuần hoàn và khí dung Budesonide/Salbutamol
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 83. Cấp Cứu Chấn Thương Vỡ Toác Khung Chậu Mất Vững & Cố Định Khẩn Cấp Pelvic Binder (Unstable Pelvic Fracture & SAM Pelvic Sling II)
    unstablePelvicFractureCare: {
      isUnstablePelvicFracture: { type: Boolean, default: false },
      openBookOrVerticalShearFractureIdentified: { type: Boolean, default: true }, // Vỡ toác cuốn sách mở hoặc trượt đứng, xuất huyết ồ ạt sau phúc mạc 2-3 lít máu
      pelvicBinderAtGreaterTrochantersApplied: { type: Boolean, default: true }, // Đặt đai nẹp chậu chuyên dụng (SAM Pelvic Sling II) chuẩn xác ngang Mấu chuyển lớn (Greater Trochanters)
      highPlacementAtIliacCrestsStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM đặt đai nẹp chậu cao ở mào chậu (Iliac Crests) vì tạo lực đòn bẩy mở toác thêm khung chậu xả máu tử vong
      repetitiveLogRollPelvicSpringingStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM lật trở bệnh nhân nhiều lần hoặc ấn lắc kiểm tra khung chậu liên tục làm vỡ nút đông máu non khoang sau phúc mạc
      damageControlResuscitationAndAngioAlerted: { type: Boolean, default: true }, // Hồi sức kiểm soát tổn thương DCR duy trì SBP 80-90 mmHg, MTP 1:1:1 + TXA 1g và báo động DSA can thiệp nút mạch ĐM chậu trong
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 84. Cấp Cứu Ngộ Độc Vũ Khí Hóa Học Thần Kinh Ức Chế Cholinesterase & DuoDote Mark I (Cholinesterase Inhibitor Chemical Threat & Atropine / Pralidoxime)
    cholinesteraseInhibitorToxicityCare: {
      isCholinesteraseInhibitorToxicity: { type: Boolean, default: false },
      cholinergicCrisisKillerBsIdentified: { type: Boolean, default: true }, // Tam chứng nguy tử Killer B's (Bronchorrhea, Bronchospasm, Bradycardia) kèm SLUDGE, co đồng tử kim chọc và giật rung bó cơ
      duoDoteAtropineAndPralidoximeAdministered: { type: Boolean, default: true }, // Tiêm Atropine liều tăng gấp đôi mỗi 5-10 phút tới khi khô đàm phổi kết hợp Pralidoxime (2-PAM) 1-2g IV tái hoạt hóa AChE trước khi enzym bị lão hóa
      pralidoximeAloneWithoutAtropineStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM dùng Pralidoxime (2-PAM) đơn độc mà không có Atropine (gây tăng huyết áp kịch phát, co thắt tử vong)
      entryWithoutLevelAbPpeStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM nhân viên cứu hộ tiếp cận hiện trường khi chưa mang đồ bảo hộ chống độc cấp A/B (tránh ngộ độc chéo tử vong tập thể)
      decontaminationAndBenzodiazepineAlerted: { type: Boolean, default: true }, // Tiêu tẩy khẩn cấp cởi bỏ quần áo ngoài xịt rửa kiềm nhẹ và dùng Diazepam/Midazolam cắt cơn co giật
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 85. Cấp Cứu Ngưng Tim Do Hạ Thân Nhiệt Sâu Dưới 30°C & Quy Trình Gentle Handling / Làm Ấm Tuần Hoàn Ngoài Cơ Thể ECLS (Severe Accidental Hypothermia & ECLS Rewarming)
    severeHypothermicCardiacArrestCare: {
      isSevereHypothermicCardiacArrest: { type: Boolean, default: false },
      coreTemperatureBelow30WithArrest: { type: Boolean, default: true }, // Thân nhiệt trung tâm < 30°C kèm ngừng tuần hoàn rung thất trơ hoặc vô tâm thu giả định
      gentleHandlingAndContinuousCprEnforced: { type: Boolean, default: true }, // Quy trình Gentle Handling di chuyển cực nhẹ nhàng chống rung thất và duy trì CPR liên tục không gián đoạn
      declarationOfDeathBeforeRewarming35StrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM công bố tử vong khi nạn nhân chưa được làm ấm lên trên 32-35°C ("No one is dead until warm and dead")
      peripheralActiveRewarmingBeforeCoreStrictlyProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM sưởi ấm tứ chi trước bằng nước nóng/chăn nhiệt vì gây hiện tượng hạ nhiệt thứ phát Afterdrop và sốc trụy mạch tử vong
      eclsVaEcmoRewarmingAlerted: { type: Boolean, default: true }, // Kích hoạt hệ thống tuần hoàn ngoài cơ thể VA-ECMO / ECLS làm ấm máu trung tâm tốc độ 2-3°C/giờ và hoãn thuốc vận mạch liều cao khi T < 30°C
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 86. Cấp Cứu Sốc Phản Vệ Ngừng Tim Do Ong Vò Vẽ Đốt Hàng Chục Nốt & Phác Đồ Vasopressin / Methylene Blue (Bee Sting Anaphylactic Cardiac Arrest)
    beeStingAnaphylacticArrestCare: {
      isBeeStingAnaphylacticArrest: { type: Boolean, default: false },
      multipleHornetStingsAndRefractoryArrest: { type: Boolean, default: true },
      vasopressinAndMethyleneBlueAdministered: { type: Boolean, default: true },
      squeezingVenomSacStrictlyProhibited: { type: Boolean, default: true },
      hotCompressApplicationStrictlyProhibited: { type: Boolean, default: true },
      crrtPlasmaExchangeToxicologyAlerted: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 87. Cứu Hộ Không Gian Kín Khí Độc Đô Thị / Cống Ngầm / Bể Biogas & SCBA Buddy System (Confined Space Atmospheric Rescue)
    confinedSpaceAtmosphericRescueCare: {
      isConfinedSpaceAtmosphericRescue: { type: Boolean, default: false },
      toxicGasAtmosphereKnockdownIdentified: { type: Boolean, default: true },
      positivePressureScbaBuddySystemEnforced: { type: Boolean, default: true },
      entryWithoutPositivePressureScbaProhibited: { type: Boolean, default: true },
      nonExplosionProofIgnitionSourceProhibited: { type: Boolean, default: true },
      hyperbaricOxygenToxicologyAlerted: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 88. Cấp Cứu Nhiễm Khuẩn Thủy Sản Ăn Thịt Người Vibrio vulnificus & Phác Đồ Doxycycline Giờ Vàng (Vibrio vulnificus Necrotizing Fasciitis)
    vibrioVulnificusInfectionCare: {
      isVibrioVulnificusInfection: { type: Boolean, default: false },
      seafoodExposureBullaeShockPresent: { type: Boolean, default: true },
      doxycyclineCeftriaxoneGoldenHourEnforced: { type: Boolean, default: true },
      saltwaterImmersionOrHerbalPoulticeProhibited: { type: Boolean, default: true },
      delayingFasciotomyForCulturesProhibited: { type: Boolean, default: true },
      emergentFasciotomySurgicalAlerted: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 89. Cấp Cứu Cơn Toan Ceton Nặng DKA & HHS Người Độc Thân Kèm Khóa Potassium Guard (Severe DKA & HHS Metabolic Crisis)
    severeDkaMetabolicCrisisCare: {
      isSevereDkaMetabolicCrisis: { type: Boolean, default: false },
      severeDkaCrisisAndDehydrationPresent: { type: Boolean, default: true },
      normalSalineFluidResuscitationEnforced: { type: Boolean, default: true },
      highDoseInsulinWithoutPotassiumProhibited: { type: Boolean, default: true },
      rapidHypotonicInfusionInHour1Prohibited: { type: Boolean, default: true },
      endocrineIcuContinuousInfusionAlerted: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 90. Cấp Cứu Hội Chứng Kích Thích Thần Kinh Giao Cảm Cấp / Sốc Quá Liều Ma Túy Đá MDMA (Sympathomimetic Toxidrome Crisis & Excited Delirium)
    sympathomimeticToxidromeCrisisCare: {
      isSympathomimeticToxidromeCrisis: { type: Boolean, default: false },
      hyperthermiaAgitationTachycardiaPresent: { type: Boolean, default: true },
      benzodiazepineAndActiveCoolingEnforced: { type: Boolean, default: true },
      unopposedAlphaBetaBlockerStrictlyProhibited: { type: Boolean, default: true },
      antipsychoticHaloperidolStrictlyProhibited: { type: Boolean, default: true },
      rhabdomyolysisRenalProtectionAlerted: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 91. Cứu Hộ Kẹt Thang Máy Cao Ốc & Sập Đổ Đô Thị Solo (High-Rise Elevator Collapse Entrapment)
    highRiseElevatorCollapseCare: {
      isHighRiseElevatorCollapse: { type: Boolean, default: false },
      elevatorEntrapmentConfirmed: { type: Boolean, default: true },
      acousticBeaconAndBarometerLocationActive: { type: Boolean, default: true },
      pryingElevatorDoorEscapeProhibited: { type: Boolean, default: true },
      openFlameInElevatorShaftProhibited: { type: Boolean, default: true },
      usarHydraulicJawsDeploymentAlerted: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 92. Cấp Cứu Tăng Kali Máu Tối Cấp Đe Dọa Ngừng Tim Bệnh Nhân Chạy Thận Solo & Canxi Gluconate (Severe Hyperkalemia Cardiac Emergency)
    hyperkalemiaCardiacEmergencyCare: {
      isHyperkalemiaCardiacEmergency: { type: Boolean, default: false },
      hyperkalemiaSevereArrhythmiaPresent: { type: Boolean, default: true },
      calciumGluconateMembraneStabilizationEnforced: { type: Boolean, default: true },
      delayingCalciumWithoutEkgProhibited: { type: Boolean, default: true },
      oralResinMonotherapyProhibited: { type: Boolean, default: true },
      insulinGlucoseShiftAndHemodialysisAlerted: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 93. Cấp Cứu Co Thắt Khí Quản Ác Tính / Phù Mạch Quinke Thanh Quản CICO & Mở Màng Nhẫn Giáp (Acute Angioedema Cricothyroidotomy)
    acuteAngioedemaCricothyroidotomyCare: {
      isAcuteAngioedemaCricothyroidotomy: { type: Boolean, default: false },
      acuteStridorAndAngioedemaAirwayCrisis: { type: Boolean, default: true },
      emergencyNeedleCricothyroidotomyEnforced: { type: Boolean, default: true },
      repeatedBlindIntubationAttemptsProhibited: { type: Boolean, default: true },
      paralyticAgentWithoutAirwayPlanProhibited: { type: Boolean, default: true },
      adrenalineImAndNebulizedEnforced: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 94. Hộ Tống Thông Minh Chống Đuối Nước Trẻ Em & Thợ Lặn Solo (Hydrostatic Submersion Rescue & Geofencing)
    hydrostaticSubmersionRescueCare: {
      isHydrostaticSubmersionRescue: { type: Boolean, default: false },
      submersionDepthAndDurationAlarm: { type: Boolean, default: true },
      inflatableSafetyBuoyTriggered: { type: Boolean, default: true },
      inversionShoulderWaterDrainageProhibited: { type: Boolean, default: true },
      fiveRescueBreathsFirstEnforced: { type: Boolean, default: true },
      waterGeofencePerimeterAlerted: { type: Boolean, default: true },
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 95. Cấp Cứu Hội Chứng Bão Cytokine & Sốc Phản Phệ Do Ong Bắp Cày Khổng Lồ Đốt Hàng Chục Nốt (Giant Hornet Cytokine Storm & DIC)
    giantHornetCytokineStormCare: {
      isGiantHornetCytokineStorm: { type: Boolean, default: false },
      multipleStingsAndDarkUrineIdentified: { type: Boolean, default: true }, // Hơn 30-50 nốt đốt, nước tiểu màu nước vối/nâu đen báo động Myoglobin phá hủy thận cấp
      earlyHemoperfusionAndCrrtEnforced: { type: Boolean, default: true }, // Chỉ định lọc máu hấp phụ than hoạt HA330 + CRRT trong 6-12h đầu
      delayingHemoperfusionUntilAnuriaProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM trì hoãn lọc máu chờ vô niệu
      hotLimeOrHerbalPoulticeProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM đắp vôi tôi nóng hoặc lá cây tránh bỏng kiềm và nhiễm uốn ván Clostridium
      methylprednisoloneAndFluidExpansionAlerted: { type: Boolean, default: true }, // Methylprednisolone 1-2 mg/kg chống bão cytokine + NaCl 0.9% kiềm hóa
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 96. Cứu Hộ Đắm Thuyền / Rơi Xuống Biển Đêm Solo & Phác Đồ H.E.L.P + Đèn Chớp Strobe SOS (Maritime Immersion Survival & H.E.L.P Protocol)
    maritimeImmersionSurvivalCare: {
      isMaritimeImmersionSurvival: { type: Boolean, default: false },
      offshoreDriftAndNightfallIdentified: { type: Boolean, default: true }, // Rơi xuống biển sâu ban đêm, trôi dạt một mình
      heatEscapeLesseningPostureAndStrobeEnforced: { type: Boolean, default: true }, // Tư thế H.E.L.P co gối ép ngực + Đèn chớp Strobe SOS OLED 100% độ sáng
      sheddingClothesToSwimLightProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM cởi bỏ quần áo để bơi cho nhẹ tránh mất nhiệt tử vong sau 45p
      drinkingSeawaterThirstProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM uống nước biển mặn 3.5% tránh mê sảng co giật phù não cấp
      maritimeSarHelicopterBeaconAlerted: { type: Boolean, default: true }, // Báo động Trung tâm Phối hợp Tìm kiếm Cứu nạn Hàng hải MRCC & tàu cá lân cận
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 97. Cấp Cứu Cơn Hạ Thân Nhiệt Nghịch Lý "Cởi Bỏ Quần Áo Tử Thần" (Paradoxical Undressing Hypothermia & Terminal Burrowing)
    paradoxicalUndressingHypothermiaCare: {
      isParadoxicalUndressingHypothermia: { type: Boolean, default: false },
      terminalBurrowingAndDeliriumIdentified: { type: Boolean, default: true }, // Thân nhiệt < 30°C, ảo giác nóng bừng như lửa đốt do liệt vận mạch ngoại vi
      voiceEmergencyLoudspeakerAlertEnforced: { type: Boolean, default: true }, // Phát loa âm lượng cực đại ngăn cản hành vi cởi đồ và chỉ đạo tìm nơi tránh gió
      drinkingAlcoholToWarmUpProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM uống rượu để sưởi ấm vì làm giãn mạch hạ nhiệt nhanh gấp 3 lần
      snowFrictionOrVigorousMassageProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM cọ xát bằng tuyết hoặc xoa bóp mạnh tứ chi tránh hoại tử và rung thất
      gradualCoreRewarmingAndVacuumMattressAlerted: { type: Boolean, default: true }, // Ủ ấm trung tâm thụ động và vận chuyển nhẹ nhàng tránh afterdrop
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 98. Cấp Cứu Ngộ Độc Cấp Thuốc Diệt Cỏ Paraquat / Diquat & Phác Đồ Lọc Máu Hấp Phụ Sớm Cửa Sổ Vàng (Paraquat Poisoning Hemoperfusion)
    paraquatPoisoningHemoperfusionCare: {
      isParaquatPoisoning: { type: Boolean, default: false },
      paraquatHerbicideIngestionIdentified: { type: Boolean, default: true }, // Uống hoặc phơi nhiễm thuốc diệt cỏ Paraquat/Diquat độc lực cao
      fullersEarthAndHemoperfusionEnforced: { type: Boolean, default: true }, // Uống đất sét Fuller's Earth / than hoạt tính + Lọc máu hấp phụ kép trong cửa sổ vàng 2-4h
      highFlowOxygenWhenSpO2Above85Prohibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM thở oxy liều cao khi SpO2 >= 85% tránh gốc tự do superoxide phá hủy xơ hóa phổi
      delayingHemoperfusionBeyondGoldenWindowProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM trì hoãn lọc máu qua cửa sổ vàng 4 giờ đầu
      nacAntioxidantAndCrrtCenterAlerted: { type: Boolean, default: true }, // Truyền tĩnh mạch NAC liều cao + Vitamin C và chuyển ICU Chống độc
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 99. Cấp Cứu Xoắn Tinh Hoàn Cấp Tính & Phục Hồi Tưới Máu Cửa Sổ Vàng Dưới 6 Giờ (Acute Testicular Torsion Golden Window < 6h)
    acuteTesticularTorsionCare: {
      isAcuteTesticularTorsion: { type: Boolean, default: false },
      scrotalPainAndBellClapperDeformityIdentified: { type: Boolean, default: true }, // Đau dữ dội vùng bẹn bìu một bên, tinh hoàn treo cao nằm ngang, mất phản xạ cơ bìu
      openBookManualDetorsionAndUrgentEchoEnforced: { type: Boolean, default: true }, // Siêu âm Doppler mạch máu khẩn cấp + Nghiệm pháp tháo xoắn thủ công Open-Book từ trong ra ngoài
      hotCompressAndStrongAnalgesicBeforeExamProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM chườm nóng và cấm dùng giảm đau mạnh làm lu mờ triệu chứng qua cửa sổ vàng 6h
      inwardRotationAndDelayedSurgeryProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM xoay vặn sai chiều vào trong và cấm trì hoãn phẫu thuật cấp cứu
      emergencyUrologicOrchiopexyAlerted: { type: Boolean, default: true }, // Báo động phòng mổ Ngoại Tiết niệu tháo xoắn và cố định 2 bên tinh hoàn trước 6h
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 100. Cấp Cứu Ngộ Độc Khí Carbon Monoxide (CO) Phòng Kín & Buồng Oxy Cao Áp HBOT (Phân hệ 129)
    carbonMonoxidePoisoningHbotCare: {
      isCarbonMonoxidePoisoning: { type: Boolean, default: false },
      enclosedSpaceCoExposureIdentified: { type: Boolean, default: true }, // Hôn mê / đau đầu dữ dội trong phòng kín đốt than, phòng xông hơi, xe ô tô nổ máy
      highFlowNormobaricO2NonRebreatherEnforced: { type: Boolean, default: true }, // Thở Oxy 100% qua mặt nạ túi không thở lại 15 L/phút rút ngắn t1/2 HbCO
      relyingSolelyOnPulseOximetryProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM tin vào SpO2 xung thông thường đọc sai 100% giả tạo
      delayingTransferToHyperbaricChamberProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM trì hoãn chuyển viện buồng Oxy cao áp qua cửa sổ vàng 6h
      hyperbaricOxygenTherapyHbotAlerted: { type: Boolean, default: true }, // Điều phối khẩn cấp tới Trung tâm Buồng Oxy Cao Áp HBOT 2.5-3.0 ATA
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 101. Cấp Cứu Vết Thương Đứt Rách Động Mạch Cảnh & Mạch Máu Cổ Ngoại Viện (Phân hệ 130)
    penetratingCarotidNeckHemorrhageCare: {
      isPenetratingCarotidNeckHemorrhage: { type: Boolean, default: false },
      pulsatileCarotidHemorrhageIdentified: { type: Boolean, default: true }, // Máu đỏ tươi phun thành vòi từ vết cắt tôn, kính vỡ vùng tam giác cảnh
      directDigitalPressureAndWoundPackingEnforced: { type: Boolean, default: true }, // Ấn chèn ngón tay trực tiếp hoặc nhét gạc cầm máu wound packing + băng chéo nách đối diện
      circumferentialNeckTourniquetProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM quấn dây garrot siết vòng quanh cổ gây nghẹt thở tử vong tức thì
      bilateralCarotidCompressionProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM chèn ép đồng thời cả 2 bên động mạch cảnh gây thiếu máu não và ngưng tim phản xạ
      cardiovascularSurgeryCenterAlerted: { type: Boolean, default: true }, // Báo động phòng mổ Phẫu thuật Mạch máu Ngoại khoa tuyến cuối
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 102. Cấp Cứu Tổn Thương Do Điện Cao Thế Phóng Trực Tiếp & Rung Thất Muộn Kèm Tiêu Cơ Vân (Phân hệ 131)
    highVoltageElectricalShockCare: {
      isHighVoltageElectricalShock: { type: Boolean, default: false },
      highVoltageArcFlashContactIdentified: { type: Boolean, default: true }, // Điện giật cao thế > 1000V, phóng hồ quang, bỏng sâu cơ tảng băng chìm
      highRateRingerLactateAndUrineOutputEnforced: { type: Boolean, default: true }, // Bù Ringer Lactate duy trì nước tiểu >= 1.5-2.0 mL/kg/h + NaHCO3 kiềm hóa nước tiểu
      approachingVictimBeforePowerCutoffProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM tiếp cận khi nguồn điện chưa ngắt (điện thế bước)
      dischargingPatientWithout24hEcgMonitoringProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM xuất viện sớm khi chưa theo dõi monitor ECG đủ 24 giờ
      burnAndNephrologyIcuCenterAlerted: { type: Boolean, default: true }, // Chuyển Trung tâm Bỏng & Hồi sức Thận Lọc Máu Tuyến Cuối
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 103. Cấp Cứu Trẻ Em Hóc Dị Vật Đường Thở Tắc Nghẽn Hoàn Toàn Dưới 1 Tuổi (Phân hệ 132)
    pediatricCompleteFbaoAirwayCare: {
      isPediatricCompleteFbao: { type: Boolean, default: false },
      infantCompleteAirwayObstructionIdentified: { type: Boolean, default: true }, // Trẻ < 1 tuổi tắc thở hoàn toàn, tím tái, không khóc, không ho thành tiếng
      backBlowsAndChestThrustsCycleEnforced: { type: Boolean, default: true }, // Chu kỳ 5 Vỗ lưng (đầu dốc) + 5 Ấn ngực 2 ngón tay; CPR khi bất tỉnh
      blindFingerSweepProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM móc họng mù đẩy dị vật tụt sâu bít thanh môn
      abdominalHeimlichUnderOneYearProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM ép bụng Heimlich cho trẻ dưới 1 tuổi vì vỡ tạng bụng
      pediatricEmergencyIcuCenterAlerted: { type: Boolean, default: true }, // Báo động Hồi sức Cấp cứu Nhi Tuyến Cuối nội soi phế quản khẩn
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
    // 104. Cấp Cứu Vết Thương Xuyên Thấu Mắt & Chống Chỉ Định Tụt Thể Pha Lê (Phân hệ 133)
    penetratingOpenGlobeEyeTraumaCare: {
      isPenetratingOpenGlobeEyeTrauma: { type: Boolean, default: false },
      openGlobePenetratingInjuryIdentified: { type: Boolean, default: true }, // Rách giác mạc/củng mạc xuyên thấu, rỉ dịch tiền phòng, phòi màng bồ đào
      rigidEyeShieldAndBilateralPatchingEnforced: { type: Boolean, default: true }, // Úp vỏ cứng Eye Shield bảo vệ ổ mắt + Băng che 2 mắt triệt tiêu chuyển động liên hợp
      directPressureOrCompressToEyeProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM tì đè ép trực tiếp lên mắt hở làm phụt thể pha lê mù vĩnh viễn
      removingImpaledObjectOrTopicalOintmentProhibited: { type: Boolean, default: true }, // Khóa cảnh báo TUYỆT ĐỐI CẤM rút dị vật cắm trong mắt và CẤM tra thuốc mỡ bừa bãi
      ophthalmicMicrosurgeryCenterAlerted: { type: Boolean, default: true }, // Báo động Vi phẫu Mắt khâu phục hồi nhãn cầu trong 12-24h
      evaluatedAt: { type: Date, default: null },
      administeredBy: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

RescueIncidentSchema.statics.ACTIVE_STATUSES = ACTIVE_STATUSES;

module.exports =
  mongoose.models.RescueIncident || mongoose.model('RescueIncident', RescueIncidentSchema);

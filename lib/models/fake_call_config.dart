enum FakeCallScenario {
  fatherWaiting,
  policeNearby,
  taxiArrived,
}

class FakeCallConfig {
  const FakeCallConfig({
    this.callerName = 'Bố',
    this.callerNumber = '+84 912 345 678',
    this.scenario = FakeCallScenario.fatherWaiting,
    this.delaySeconds = 0,
  });

  final String callerName;
  final String callerNumber;
  final FakeCallScenario scenario;
  final int delaySeconds;

  String get scenarioDialogue {
    switch (scenario) {
      case FakeCallScenario.fatherWaiting:
        return 'Alo con à! Bố với mấy anh công an đang đứng ngay đầu ngõ chờ con đây, con đi nhanh ra ngay nhé, bố thấy con rồi!';
      case FakeCallScenario.policeNearby:
        return 'Alo! Chúng tôi là lực lượng tuần tra khu vực đây, hệ thống định vị SafeSolo báo bạn đang ở vị trí này. Bạn đứng yên chỗ sáng, chúng tôi tới ngay!';
      case FakeCallScenario.taxiArrived:
        return 'Alo bạn ơi, tài xế bảo hộ SafeSolo biển số 51A-888.99 đã dừng ngay trước mặt bạn rồi nhé, mời bạn bước lên xe ngay!';
    }
  }

  FakeCallConfig copyWith({
    String? callerName,
    String? callerNumber,
    FakeCallScenario? scenario,
    int? delaySeconds,
  }) {
    return FakeCallConfig(
      callerName: callerName ?? this.callerName,
      callerNumber: callerNumber ?? this.callerNumber,
      scenario: scenario ?? this.scenario,
      delaySeconds: delaySeconds ?? this.delaySeconds,
    );
  }
}

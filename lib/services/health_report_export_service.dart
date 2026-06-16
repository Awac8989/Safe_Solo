import 'dart:io';

import 'package:excel/excel.dart' as xls;
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/health_report_model.dart';

class HealthReportExportService {
  HealthReportExportService._();

  static final HealthReportExportService instance =
      HealthReportExportService._();

  final DateFormat _fileStamp = DateFormat('yyyyMMdd_HHmm');
  final DateFormat _humanDateTime = DateFormat('dd/MM/yyyy HH:mm');

  Future<Directory> _ensureOutputDir() async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory(
      '${base.path}${Platform.pathSeparator}SafeSolo${Platform.pathSeparator}reports',
    );
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  String _safeLabel(String value) {
    return value
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
        .replaceAll(RegExp(r'_+'), '_')
        .replaceAll(RegExp(r'^_|_$'), '');
  }

  String _humanizeMood(String mood) {
    switch (mood) {
      case 'calm':
        return 'Bình an';
      case 'happy':
        return 'Tích cực';
      case 'tired':
        return 'Hơi mệt';
      case 'sick':
        return 'Cần lưu ý';
      case 'focused':
        return 'Đang tập trung';
      default:
        return mood;
    }
  }

  xls.CellValue _textCell(String value) => xls.TextCellValue(value);
  xls.CellValue _intCell(int value) => xls.IntCellValue(value);
  xls.CellValue _numCell(num value) =>
      value is int ? xls.IntCellValue(value) : xls.DoubleCellValue(value.toDouble());

  List<xls.CellValue?> _toTextRow(List<Object?> values) {
    return values.map((value) {
      if (value == null) {
        return null;
      }
      if (value is xls.CellValue) {
        return value;
      }
      if (value is int) {
        return _intCell(value);
      }
      if (value is num) {
        return _numCell(value);
      }
      if (value is bool) {
        return xls.BoolCellValue(value);
      }
      return _textCell(value.toString());
    }).toList();
  }

  Future<File> exportPdf({
    required String userName,
    required HealthReportModel report,
  }) async {
    final dir = await _ensureOutputDir();
    final file = File(
      '${dir.path}${Platform.pathSeparator}health_report_${_safeLabel(userName)}_${_fileStamp.format(DateTime.now())}.pdf',
    );

    final document = pw.Document();
    final moodEntries = report.moodCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    document.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        build: (context) => [
          pw.Text(
            'SafeSolo - Báo cáo sức khỏe và check-in',
            style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 6),
          pw.Text('Người dùng: $userName'),
          pw.Text('Chu kỳ: ${report.period}'),
          pw.Text('Khoảng thời gian: ${report.rangeStart} - ${report.rangeEnd}'),
          pw.SizedBox(height: 16),
          pw.TableHelper.fromTextArray(
            headers: const ['Chỉ số', 'Giá trị'],
            data: [
              ['Tổng check-in', report.totalCheckIns.toString()],
              ['Tự động check-in', report.autoCheckIns.toString()],
              ['Quá hạn', report.overdueCount.toString()],
              ['SOS', report.sosCount.toString()],
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Text(
            'Thống kê tâm trạng',
            style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),
          pw.TableHelper.fromTextArray(
            headers: const ['Tâm trạng', 'Số lần'],
            data: moodEntries
                .map((entry) => [_humanizeMood(entry.key), entry.value.toString()])
                .toList(),
          ),
          pw.SizedBox(height: 16),
          pw.Text(
            'Check-in gần đây',
            style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),
          pw.TableHelper.fromTextArray(
            headers: const ['Thời gian', 'Trạng thái', 'Vị trí'],
            data: report.recentCheckins
                .map(
                  (item) => [
                    _humanDateTime.format(DateTime.parse(item.createdAt)),
                    item.autoTriggered ? 'Tự động' : 'Thủ công',
                    item.location == null
                        ? '-'
                        : '${item.location?['lat']}, ${item.location?['lng']}',
                  ],
                )
                .toList(),
          ),
          pw.SizedBox(height: 16),
          pw.Text(
            'Cảnh báo gần đây',
            style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),
          pw.TableHelper.fromTextArray(
            headers: const ['Thời gian', 'Mức', 'Nội dung'],
            data: report.recentAlerts
                .map(
                  (item) => [
                    _humanDateTime.format(DateTime.parse(item.createdAt)),
                    item.level ?? item.status ?? '-',
                    item.message,
                  ],
                )
                .toList(),
          ),
        ],
      ),
    );

    await file.writeAsBytes(await document.save(), flush: true);
    return file;
  }

  Future<File> exportExcel({
    required String userName,
    required HealthReportModel report,
  }) async {
    final dir = await _ensureOutputDir();
    final file = File(
      '${dir.path}${Platform.pathSeparator}health_report_${_safeLabel(userName)}_${_fileStamp.format(DateTime.now())}.xlsx',
    );

    final workbook = xls.Excel.createExcel();
    workbook.rename('Sheet1', 'Tong quan');

    final summarySheet = workbook['Tong quan'];
    summarySheet.appendRow(
      _toTextRow(['SafeSolo - Báo cáo sức khỏe và check-in']),
    );
    summarySheet.appendRow(_toTextRow(['Người dùng', userName]));
    summarySheet.appendRow(_toTextRow(['Chu kỳ', report.period]));
    summarySheet.appendRow(
      _toTextRow(['Khoảng thời gian', '${report.rangeStart} - ${report.rangeEnd}']),
    );
    summarySheet.appendRow(_toTextRow(['Tổng check-in', report.totalCheckIns]));
    summarySheet.appendRow(_toTextRow(['Tự động check-in', report.autoCheckIns]));
    summarySheet.appendRow(_toTextRow(['Quá hạn', report.overdueCount]));
    summarySheet.appendRow(_toTextRow(['SOS', report.sosCount]));
    summarySheet.appendRow(_toTextRow(const []));

    summarySheet.appendRow(_toTextRow(['Tâm trạng', 'Số lần']));
    final moodEntries = report.moodCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    for (final entry in moodEntries) {
      summarySheet.appendRow(_toTextRow([_humanizeMood(entry.key), entry.value]));
    }

    final chartSheet = workbook['Check-in'];
    chartSheet.appendRow(_toTextRow(['Ngày', 'Check-in', 'Tự động', 'Cảnh báo', 'SOS']));
    for (final bucket in report.dailySeries) {
      chartSheet.appendRow(
        _toTextRow([
          bucket.label,
          bucket.checkIns,
          bucket.autoCheckIns,
          bucket.alertCount,
          bucket.sosCount,
        ]),
      );
    }

    final recentCheckinSheet = workbook['Check-in gan day'];
    recentCheckinSheet.appendRow(_toTextRow(['Thời gian', 'Tự động', 'Vị trí']));
    for (final item in report.recentCheckins) {
      recentCheckinSheet.appendRow(
        _toTextRow([
          _humanDateTime.format(DateTime.parse(item.createdAt)),
          item.autoTriggered ? 'Có' : 'Không',
          item.location == null
              ? '-'
              : '${item.location?['lat']}, ${item.location?['lng']}',
        ]),
      );
    }

    final alertsSheet = workbook['Canh bao'];
    alertsSheet.appendRow(_toTextRow(['Thời gian', 'Mức', 'Trạng thái', 'Nội dung']));
    for (final item in report.recentAlerts) {
      alertsSheet.appendRow(
        _toTextRow([
          _humanDateTime.format(DateTime.parse(item.createdAt)),
          item.level ?? '-',
          item.status ?? '-',
          item.message,
        ]),
      );
    }

    final bytes = workbook.save();
    if (bytes == null) {
      throw Exception('Không thể tạo file Excel');
    }
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }
}

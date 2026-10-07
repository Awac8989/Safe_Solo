package com.example.safesolo

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetProvider

class SafeSoloWidgetProvider : HomeWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.safesolo_widget).apply {

                // 1. Đọc dữ liệu từ Flutter WidgetService
                val isOkay = widgetData.getBoolean("widget_is_okay", true)
                val title = widgetData.getString("widget_title", if (isOkay) "CHECK-IN SAU" else "ĐÃ QUÁ HẠN")
                val countdown = widgetData.getString("widget_countdown", if (isOkay) "12h : 00m" else "Chạm điểm danh")
                val statusBadge = widgetData.getString("widget_status_badge", if (isOkay) "● AN TOÀN" else "● NGUY CẤP")
                val badgeColor = widgetData.getString("widget_badge_color", if (isOkay) "#34D399" else "#EF4444")
                val vitals = widgetData.getString("widget_vitals", "❤️ -- BPM • 👟 An toàn sinh tồn")

                // 2. Cập nhật nội dung hiển thị
                setTextViewText(R.id.widget_title, title)
                setTextViewText(R.id.widget_countdown, countdown)
                setTextViewText(R.id.widget_status_badge, statusBadge)
                setTextViewText(R.id.widget_vitals, vitals)

                // Đổi màu badge trạng thái
                try {
                    setTextColor(R.id.widget_status_badge, Color.parseColor(badgeColor))
                } catch (_: Exception) {
                    setTextColor(R.id.widget_status_badge, Color.parseColor(if (isOkay) "#34D399" else "#EF4444"))
                }

                // Đổi nền bo góc Widget (An toàn: Xanh lục đậm; Báo động: Đỏ đậm)
                setInt(
                    R.id.widget_root,
                    "setBackgroundResource",
                    if (isOkay) R.drawable.widget_bg_safe else R.drawable.widget_bg_danger
                )

                // 3. Cấu hình các nút bấm tương tác đa điểm (Multi-action PendingIntents)

                // A. Chạm thân Widget -> Mở màn hình chính SafeSolo
                val homeIntent = Intent(Intent.ACTION_VIEW, Uri.parse("safesolo://home")).apply {
                    `package` = context.packageName
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val homePendingIntent = PendingIntent.getActivity(
                    context,
                    100,
                    homeIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widget_content_body, homePendingIntent)

                // B. Chạm nút "Tôi ổn" -> Điểm danh 1 chạm
                val checkinIntent = Intent(Intent.ACTION_VIEW, Uri.parse("safesolo://checkin")).apply {
                    `package` = context.packageName
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val checkinPendingIntent = PendingIntent.getActivity(
                    context,
                    101,
                    checkinIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widget_btn_checkin, checkinPendingIntent)

                // C. Chạm nút "SOS" -> Kích hoạt cứu hộ khẩn cấp
                val sosIntent = Intent(Intent.ACTION_VIEW, Uri.parse("safesolo://sos")).apply {
                    `package` = context.packageName
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val sosPendingIntent = PendingIntent.getActivity(
                    context,
                    102,
                    sosIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widget_btn_sos, sosPendingIntent)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}

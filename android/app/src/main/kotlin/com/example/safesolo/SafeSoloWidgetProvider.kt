package com.example.safesolo

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
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
                val title = widgetData.getString("widget_title", if (isOkay) "DEAD-MAN SWITCH" else "ĐÃ QUÁ HẠN")
                val countdown = widgetData.getString("widget_countdown", if (isOkay) "71h 48m" else "Chạm điểm danh")
                val statusBadge = widgetData.getString("widget_status_badge", if (isOkay) "● AN TOÀN" else "● NGUY CẤP")
                val badgeColor = widgetData.getString("widget_badge_color", if (isOkay) "#34D399" else "#EF4444")
                val vitals = widgetData.getString("widget_vitals", "❤️ 78 BPM • 🫁 98% • ⌚ 100%")
                val userInfo = widgetData.getString("widget_user_info", "BS. CKII Lê Hoàng Nam")
                val guardiansHeader = widgetData.getString("widget_guardians_header", "🛡️ BẢO HỘ ONLINE (2)")
                val guardian1 = widgetData.getString("widget_guardian_1", "🟢 Mẹ Lan: 88% 🔋 Ở nhà")
                val guardian2 = widgetData.getString("widget_guardian_2", "🟢 Ba Hùng: 94% ⚡ Phòng ngủ")
                val guardian3 = widgetData.getString("widget_guardian_3", "")

                // 2. Cập nhật nội dung hiển thị
                setTextViewText(R.id.widget_title, title)
                setTextViewText(R.id.widget_countdown, countdown)
                setTextViewText(R.id.widget_status_badge, statusBadge)
                setTextViewText(R.id.widget_vitals, vitals)
                setTextViewText(R.id.widget_user_info, userInfo)
                setTextViewText(R.id.widget_guardians_header, guardiansHeader)
                setTextViewText(R.id.widget_guardian_1, guardian1)
                setTextViewText(R.id.widget_guardian_2, guardian2)

                if (!guardian3.isNullOrEmpty()) {
                    setViewVisibility(R.id.widget_guardian_3, View.VISIBLE)
                    setTextViewText(R.id.widget_guardian_3, guardian3)
                } else {
                    setViewVisibility(R.id.widget_guardian_3, View.GONE)
                }

                // Đổi màu badge trạng thái
                try {
                    setTextColor(R.id.widget_status_badge, Color.parseColor(badgeColor))
                } catch (_: Exception) {
                    setTextColor(R.id.widget_status_badge, Color.parseColor(if (isOkay) "#34D399" else "#EF4444"))
                }

                // Đổi nền bo góc Widget (An toàn: Midnight gradient; Báo động: Crimson gradient)
                setInt(
                    R.id.widget_root,
                    "setBackgroundResource",
                    if (isOkay) R.drawable.widget_bg_safe else R.drawable.widget_bg_danger
                )

                // 3. Cấu hình các nút bấm tương tác đa điểm (Multi-action PendingIntents)
                // A. Chạm thân Widget / Countdown -> Mở màn hình chính SafeSolo
                val homePendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://home")
                )
                setOnClickPendingIntent(R.id.widget_content_body, homePendingIntent)
                setOnClickPendingIntent(R.id.widget_root, homePendingIntent)

                // B. Chạm thẻ Người thân / Guardians -> Mở tab Vòng tròn an toàn (Circle Orbit)
                val circlePendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://circle")
                )
                setOnClickPendingIntent(R.id.widget_guardians_card, circlePendingIntent)

                // C. Chạm nút "Tôi ổn" -> Điểm danh 1 chạm
                val checkinPendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://checkin")
                )
                setOnClickPendingIntent(R.id.widget_btn_checkin, checkinPendingIntent)

                // D. Chạm nút "SOS" -> Kích hoạt cứu hộ khẩn cấp
                val sosPendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://sos")
                )
                setOnClickPendingIntent(R.id.widget_btn_sos, sosPendingIntent)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}

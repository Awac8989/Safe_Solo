package com.example.safesolo

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

class SafeSoloCircleWidgetProvider : HomeWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.safesolo_widget_circle).apply {
                val userInfo = widgetData.getString("widget_user_info", "BS. CKII Lê Hoàng Nam")
                val statusBadge = widgetData.getString("widget_circle_badge", "🛡️ 4 AN TOÀN")

                val m1Name = widgetData.getString("circle_m1_name", "👩 Mẹ Lan • Mẹ")
                val m1Status = widgetData.getString("circle_m1_status", "🟢 Ở nhà • 🔋 88%")
                val m2Name = widgetData.getString("circle_m2_name", "👨 Ba Hùng • Ba")
                val m2Status = widgetData.getString("circle_m2_status", "🟢 Phòng ngủ • ⚡ 94%")
                val m3Name = widgetData.getString("circle_m3_name", "👧 Linh • Bạn thân")
                val m3Status = widgetData.getString("circle_m3_status", "🟡 Đi xe về • 🔋 38%")
                val m4Name = widgetData.getString("circle_m4_name", "👦 Anh Hai • Anh")
                val m4Status = widgetData.getString("circle_m4_status", "🟢 Khu CNC • 🔋 75%")

                setTextViewText(R.id.widget_circle_user_info, userInfo)
                setTextViewText(R.id.widget_circle_status_badge, statusBadge)

                setTextViewText(R.id.widget_member_1_name, m1Name)
                setTextViewText(R.id.widget_member_1_status, m1Status)
                setTextViewText(R.id.widget_member_2_name, m2Name)
                setTextViewText(R.id.widget_member_2_status, m2Status)
                setTextViewText(R.id.widget_member_3_name, m3Name)
                setTextViewText(R.id.widget_member_3_status, m3Status)
                setTextViewText(R.id.widget_member_4_name, m4Name)
                setTextViewText(R.id.widget_member_4_status, m4Status)

                val circlePendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://circle")
                )
                setOnClickPendingIntent(R.id.widget_circle_body, circlePendingIntent)
                setOnClickPendingIntent(R.id.widget_circle_root, circlePendingIntent)

                val pingPendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://ping_circle")
                )
                setOnClickPendingIntent(R.id.widget_circle_btn_ping, pingPendingIntent)

                val sharePendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://share_location")
                )
                setOnClickPendingIntent(R.id.widget_circle_btn_share, sharePendingIntent)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}

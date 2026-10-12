package com.example.safesolo

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

class SafeSoloMiniWidgetProvider : HomeWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.safesolo_widget_mini).apply {
                val isOkay = widgetData.getBoolean("widget_is_okay", true)
                val countdown = widgetData.getString("widget_countdown", if (isOkay) "71h 06m" else "Quá hạn")
                val statusBadge = widgetData.getString("widget_status_badge", if (isOkay) "● AN TOÀN" else "● NGUY CẤP")
                val badgeColor = widgetData.getString("widget_badge_color", if (isOkay) "#34D399" else "#EF4444")
                val vitals = widgetData.getString("widget_vitals", "❤️ 78 BPM • ⌚ 100%")
                val guardiansCount = widgetData.getString("widget_guardians_header", "🛡️ 4 người bảo hộ online")

                setTextViewText(R.id.widget_mini_countdown, countdown)
                setTextViewText(R.id.widget_mini_status_badge, statusBadge)
                setTextViewText(R.id.widget_mini_vitals, vitals)
                setTextViewText(R.id.widget_mini_guardians, guardiansCount)

                try {
                    setTextColor(R.id.widget_mini_status_badge, Color.parseColor(badgeColor))
                } catch (_: Exception) {
                    setTextColor(R.id.widget_mini_status_badge, Color.parseColor(if (isOkay) "#34D399" else "#EF4444"))
                }

                setInt(
                    R.id.widget_mini_root,
                    "setBackgroundResource",
                    if (isOkay) R.drawable.widget_bg_safe else R.drawable.widget_bg_danger
                )

                val homePendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://home")
                )
                setOnClickPendingIntent(R.id.widget_mini_body, homePendingIntent)
                setOnClickPendingIntent(R.id.widget_mini_root, homePendingIntent)

                val checkinPendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://checkin")
                )
                setOnClickPendingIntent(R.id.widget_mini_btn_checkin, checkinPendingIntent)

                val sosPendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://sos")
                )
                setOnClickPendingIntent(R.id.widget_mini_btn_sos, sosPendingIntent)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}

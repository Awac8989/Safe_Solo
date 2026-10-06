package com.example.safesolo

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetProvider
import android.graphics.Color

class SafeSoloWidgetProvider : HomeWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.safesolo_widget).apply {

                // Get data saved from Flutter
                val title = widgetData.getString("widget_title", "Tôi ổn")
                val countdown = widgetData.getString("widget_countdown", "Chạm để check-in")
                val statusColor = widgetData.getString("widget_color", "#2E7D32")

                setTextViewText(R.id.widget_title, title)
                setTextViewText(R.id.widget_countdown, countdown)
                
                try {
                    setInt(R.id.widget_root, "setBackgroundColor", Color.parseColor(statusColor))
                } catch (e: Exception) {
                    setInt(R.id.widget_root, "setBackgroundColor", Color.parseColor("#2E7D32"))
                }

                // Setup click intent using standard Android PendingIntent
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("safesolo://checkin")).apply {
                    `package` = context.packageName
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                val pendingIntentWithData = PendingIntent.getActivity(
                    context,
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widget_root, pendingIntentWithData)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}

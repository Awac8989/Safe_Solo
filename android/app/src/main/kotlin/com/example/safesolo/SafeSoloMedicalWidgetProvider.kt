package com.example.safesolo

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

class SafeSoloMedicalWidgetProvider : HomeWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.safesolo_widget_medical).apply {
                val userInfo = widgetData.getString("widget_user_info", "BS. CKII Lê Hoàng Nam")
                val bloodBadge = widgetData.getString("widget_medical_blood", "🩸 NHÓM O+")
                val allergies = widgetData.getString("widget_medical_allergies", "⚠️ Dị ứng: Penicillin")
                val conditions = widgetData.getString("widget_medical_conditions", "🩺 Bệnh nền: Tăng HA")
                val vitals = widgetData.getString("widget_vitals", "🫁 98% SpO2 • ❤️ 78 BPM")
                val guardianName = widgetData.getString("widget_medical_guardian_name", "👤 Guardian 21A")
                val guardianPhone = widgetData.getString("widget_medical_guardian_phone", "📞 0911002021")
                val hospital = widgetData.getString("widget_medical_hospital", "🏥 BV: Chợ Rẫy")

                setTextViewText(R.id.widget_medical_user_info, userInfo)
                setTextViewText(R.id.widget_medical_blood_badge, bloodBadge)
                setTextViewText(R.id.widget_medical_allergies, allergies)
                setTextViewText(R.id.widget_medical_conditions, conditions)
                setTextViewText(R.id.widget_medical_vitals, vitals)
                setTextViewText(R.id.widget_medical_guardian_name, guardianName)
                setTextViewText(R.id.widget_medical_guardian_phone, guardianPhone)
                setTextViewText(R.id.widget_medical_hospital, hospital)

                val medicalPendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                    Uri.parse("safesolo://medical")
                )
                setOnClickPendingIntent(R.id.widget_medical_body, medicalPendingIntent)
                setOnClickPendingIntent(R.id.widget_medical_root, medicalPendingIntent)

                // Call Guardian
                val cleanPhone = guardianPhone?.replace("[^0-9+]".toRegex(), "") ?: "0911002021"
                val dialGuardianIntent = Intent(Intent.ACTION_DIAL).apply {
                    data = Uri.parse("tel:$cleanPhone")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                val dialPendingIntent = android.app.PendingIntent.getActivity(
                    context,
                    201,
                    dialGuardianIntent,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widget_medical_btn_guardian, dialPendingIntent)

                // Call 115 Emergency
                val dial115Intent = Intent(Intent.ACTION_DIAL).apply {
                    data = Uri.parse("tel:115")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                val dial115Pending = android.app.PendingIntent.getActivity(
                    context,
                    202,
                    dial115Intent,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                )
                setOnClickPendingIntent(R.id.widget_medical_btn_115, dial115Pending)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}

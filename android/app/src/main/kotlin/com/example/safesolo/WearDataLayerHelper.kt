package com.example.safesolo

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import java.nio.charset.StandardCharsets

/**
 * Wear OS Data Layer bridge (MessageClient / DataClient / NodeClient) over Bluetooth.
 * Enables < 100ms direct Watch <-> Phone SSWP packet exchange without Wi-Fi/adb reverse,
 * plus persistent DataItem state sync for offline recovery and Watch Tile updates.
 */
object WearDataLayerHelper {
    private const val TAG = "WearDataLayerHelper"
    const val PATH_PACKET = "/safesolo/packet"
    const val PATH_COMMAND = "/safesolo/cmd"
    const val PATH_TILE_ACTION = "/safesolo/tile_action"
    const val PATH_VITALS_DATA = "/safesolo/vitals_state"

    fun getConnectedNodes(context: Context, callback: (List<Map<String, Any>>) -> Unit) {
        try {
            Wearable.getNodeClient(context).connectedNodes
                .addOnSuccessListener { nodes: List<Node> ->
                    val mapped = nodes.map { node ->
                        mapOf(
                            "id" to node.id,
                            "displayName" to node.displayName,
                            "isNearby" to node.isNearby
                        )
                    }
                    callback(mapped)
                }
                .addOnFailureListener { e ->
                    Log.d(TAG, "Wearable NodeClient unavailable: ${e.message}")
                    callback(emptyList())
                }
        } catch (e: Exception) {
            Log.d(TAG, "Wearable NodeClient exception: ${e.message}")
            callback(emptyList())
        }
    }

    fun sendPacket(
        context: Context,
        path: String = PATH_PACKET,
        jsonPayload: String,
        callback: ((Map<String, Any>) -> Unit)? = null
    ) {
        val bytes = jsonPayload.toByteArray(StandardCharsets.UTF_8)
        val startedAt = System.currentTimeMillis()
        try {
            Wearable.getNodeClient(context).connectedNodes
                .addOnSuccessListener { nodes: List<Node> ->
                    if (nodes.isEmpty()) {
                        callback?.invoke(
                            mapOf(
                                "sent" to false,
                                "nodeCount" to 0,
                                "reason" to "NO_CONNECTED_WEAR_NODES"
                            )
                        )
                        return@addOnSuccessListener
                    }

                    val msgClient = Wearable.getMessageClient(context)
                    var completed = 0
                    var successCount = 0
                    val nodeNames = mutableListOf<String>()

                    for (node in nodes) {
                        nodeNames.add(node.displayName)
                        msgClient.sendMessage(node.id, path, bytes)
                            .addOnSuccessListener {
                                successCount++
                                completed++
                                if (completed == nodes.size) {
                                    callback?.invoke(
                                        mapOf(
                                            "sent" to (successCount > 0),
                                            "nodeCount" to nodes.size,
                                            "successCount" to successCount,
                                            "nodes" to nodeNames,
                                            "latencyMs" to (System.currentTimeMillis() - startedAt)
                                        )
                                    )
                                }
                            }
                            .addOnFailureListener { e ->
                                Log.w(TAG, "sendMessage failed to ${node.displayName}: ${e.message}")
                                completed++
                                if (completed == nodes.size) {
                                    callback?.invoke(
                                        mapOf(
                                            "sent" to (successCount > 0),
                                            "nodeCount" to nodes.size,
                                            "successCount" to successCount,
                                            "nodes" to nodeNames,
                                            "latencyMs" to (System.currentTimeMillis() - startedAt)
                                        )
                                    )
                                }
                            }
                    }
                }
                .addOnFailureListener { e ->
                    Log.d(TAG, "Wearable MessageClient unavailable: ${e.message}")
                    callback?.invoke(
                        mapOf(
                            "sent" to false,
                            "nodeCount" to 0,
                            "reason" to (e.message ?: "WEARABLE_API_UNAVAILABLE")
                        )
                    )
                }
        } catch (e: Exception) {
            callback?.invoke(
                mapOf(
                    "sent" to false,
                    "nodeCount" to 0,
                    "reason" to (e.message ?: "WEARABLE_EXCEPTION")
                )
            )
        }
    }

    fun syncVitalsDataItem(
        context: Context,
        deviceId: String,
        heartRate: Int,
        spO2: Int,
        battery: Int,
        steps: Int,
        isOffWrist: Boolean,
        svmG: Double,
        fusionPhase: String
    ) {
        try {
            val req = PutDataMapRequest.create(PATH_VITALS_DATA).apply {
                dataMap.putString("deviceId", deviceId)
                dataMap.putInt("heartRate", heartRate)
                dataMap.putInt("spO2", spO2)
                dataMap.putInt("battery", battery)
                dataMap.putInt("steps", steps)
                dataMap.putBoolean("isOffWrist", isOffWrist)
                dataMap.putDouble("svmG", svmG)
                dataMap.putString("fusionPhase", fusionPhase)
                dataMap.putLong("updatedAt", System.currentTimeMillis())
            }.asPutDataRequest().setUrgent()

            Wearable.getDataClient(context).putDataItem(req)
                .addOnFailureListener { e ->
                    Log.d(TAG, "putDataItem skipped: ${e.message}")
                }
        } catch (_: Exception) {}
    }
}

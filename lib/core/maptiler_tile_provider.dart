import 'dart:typed_data';

import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;

import 'constants.dart';

class MapTilerTileProvider implements TileProvider {
  const MapTilerTileProvider();

  static const int tileSize = 256;

  @override
  Future<Tile> getTile(int x, int y, int? zoom) async {
    final safeZoom = zoom ?? 0;
    final url = AppConstants.mapTilerRasterTileUrl(x, y, safeZoom);
    if (url == null) {
      return TileProvider.noTile;
    }

    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode != 200) {
        return TileProvider.noTile;
      }
      final bytes = Uint8List.fromList(response.bodyBytes);
      return Tile(tileSize, tileSize, bytes);
    } catch (_) {
      return TileProvider.noTile;
    }
  }
}

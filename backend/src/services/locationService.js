const prisma = require('../config/database');

class LocationService {
  // Update user location and refresh the PostGIS geometry index
  async updateUserLocation(userId, lat, lng) {
    const now = new Date();

    // Update both scalar location fields and the PostGIS geometry column
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        lastLat: lat,
        lastLng: lng,
        lastLocationTime: now
      }
    });

    // Use raw SQL to update the PostGIS geometry point for fast spatial queries.
    // This writes into the 'location' geometry column declared in the schema.
    await prisma.$executeRaw`
      UPDATE users
      SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geometry
      WHERE id = ${userId}
    `;

    return {
      ...updatedUser,
      lastLocationTime: now
    };
  }

  // Get user current location
  async getUserLocation(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        lastLat: true,
        lastLng: true,
        lastLocationTime: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

module.exports = new LocationService();
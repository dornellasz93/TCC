/**
 * Módulo de Validação Geográfica e Cerco Virtual (Geofencing)
 * Implementação da Fórmula de Haversine para cálculo de distância geodésica.
 * 
 * Projeto de TCC - Engenharia de Software - Centro Universitário Geraldo Di Biase (UGB)
 * Autores: Pedro Henrique Teixeira Dornellas Soares de Souza & Pedro Gabriel da Costa Ribeiro
 */

const EARTH_RADIUS_METERS = 6371000; // Raio médio da Terra em metros (WGS 84)

/**
 * Converte graus decimais para radianos
 * @param {number} degrees 
 * @returns {number} radians
 */
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Calcula a distância em metros entre duas coordenadas geográficas (Latitude/Longitude)
 * utilizando a Fórmula de Haversine:
 * 
 * a = sin²(Δlat / 2) + cos(lat1) * cos(lat2) * sin²(Δlon / 2)
 * c = 2 * atan2(√a, √(1 - a))
 * d = R * c
 * 
 * @param {number} lat1 - Latitude do Aluno (ponto A)
 * @param {number} lon1 - Longitude do Aluno (ponto A)
 * @param {number} lat2 - Latitude da Sala / Campus (ponto B)
 * @param {number} lon2 - Longitude da Sala / Campus (ponto B)
 * @returns {number} Distância em metros com precisão decimal
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    throw new Error('Coordenadas incompletas para o cálculo de Haversine.');
  }

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_METERS * c;

  // Retorna com 2 casas decimais de precisão
  return Math.round(distance * 100) / 100;
}

/**
 * Valida se o aluno está dentro do raio permitido da sala de aula
 * @param {number} studentLat 
 * @param {number} studentLon 
 * @param {number} roomLat 
 * @param {number} roomLon 
 * @param {number} maxRadiusMeters 
 * @returns {object} { isValid: boolean, distanceMeters: number, maxRadiusMeters: number, differenceMeters: number }
 */
function validateGeofence(studentLat, studentLon, roomLat, roomLon, maxRadiusMeters = 35) {
  const distance = calculateHaversineDistance(studentLat, studentLon, roomLat, roomLon);
  const isValid = distance <= maxRadiusMeters;
  const difference = Math.round((distance - maxRadiusMeters) * 100) / 100;

  return {
    isValid,
    distanceMeters: distance,
    maxRadiusMeters,
    differenceMeters: isValid ? 0 : difference,
    toleranceDescription: isValid
      ? `Dentro do cerco virtual (${distance}m <= ${maxRadiusMeters}m)`
      : `Fora do cerco virtual (${distance}m > ${maxRadiusMeters}m por +${difference}m)`
  };
}

module.exports = {
  calculateHaversineDistance,
  validateGeofence,
  EARTH_RADIUS_METERS
};

export const EARTH_RADIUS_METERS = 6371000;

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function calculateHaversine(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0;
  }
  const phi1 = toRadians(Number(lat1));
  const phi2 = toRadians(Number(lat2));
  const deltaPhi = toRadians(Number(lat2) - Number(lat1));
  const deltaLambda = toRadians(Number(lon2) - Number(lon1));

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
}

export const UGB_LOCATIONS = [
  {
    id: 'room_inside',
    name: 'Na Carteira (Sala 204 - Bloco B)',
    description: 'Coordenada exata da sala (~1.5m). Deve aprovar.',
    latitude: -22.518605,
    longitude: -44.098485,
    accuracy: 5,
    isMockLocation: false
  },
  {
    id: 'lab_inside',
    name: 'Laboratório 3 de IA (Bloco C)',
    description: 'Dentro do raio permitido (~18m). Deve aprovar.',
    latitude: -22.518480,
    longitude: -44.098620,
    accuracy: 7,
    isMockLocation: false
  },
  {
    id: 'fake_gps_mock',
    name: 'Fake GPS / Mock Location (Spoof)',
    description: 'Coordenada forjada dentro da sala (0m), mas provedor Mock ativo. Deve BLOQUEAR!',
    latitude: -22.518605,
    longitude: -44.098485,
    accuracy: 0,
    isMockLocation: true
  },
  {
    id: 'patio_ugb',
    name: 'Pátio / Cantina Central UGB',
    description: 'Fora do raio da sala (~80m). Deve BLOQUEAR!',
    latitude: -22.519300,
    longitude: -44.098300,
    accuracy: 8,
    isMockLocation: false
  },
  {
    id: 'casa_remoto',
    name: 'Em Casa / Bairro Retiro (Remoto)',
    description: 'Tentativa remota (~3.8 km). Deve BLOQUEAR e auditar!',
    latitude: -22.495000,
    longitude: -44.115000,
    accuracy: 12,
    isMockLocation: false
  }
];

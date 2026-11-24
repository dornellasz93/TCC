/**
 * Utilitário da Fórmula de Haversine para o Front-End
 * Centro Universitário Geraldo Di Biase (UGB) - TCC Engenharia de Software
 */

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
  const distance = EARTH_RADIUS_METERS * c;

  return Math.round(distance * 100) / 100;
}

/**
 * Locais pré-configurados do Campus UGB para demonstração ágil na banca
 */
export const UGB_LOCATIONS = [
  {
    id: 'room_inside',
    name: '📍 Na Carteira (Dentro da Sala 204 - Bloco B)',
    description: 'Coordenada exata da sala de aula (Distância ~ 1.5m). Status: Aprovado.',
    latitude: -22.518605,
    longitude: -44.098485,
    accuracy: 5,
    isMockLocation: false,
    statusExpected: 'APPROVED'
  },
  {
    id: 'lab_inside',
    name: '📍 Laboratório 3 de IA (Bloco C)',
    description: 'Dentro do raio do bloco (Distância ~ 18m). Status: Aprovado.',
    latitude: -22.518480,
    longitude: -44.098620,
    accuracy: 7,
    isMockLocation: false,
    statusExpected: 'APPROVED'
  },
  {
    id: 'fake_gps_mock',
    name: '🚨 Simular Fake GPS (Mock Location na Sala)',
    description: 'Coordenada forjada dentro da sala (0m), mas com provedor Mock Location ativo. Deve ser BLOQUEADO!',
    latitude: -22.518605,
    longitude: -44.098485,
    accuracy: 0,
    isMockLocation: true,
    statusExpected: 'MOCK_BLOCKED'
  },
  {
    id: 'patio_ugb',
    name: '☕ Pátio / Cantina Central do UGB',
    description: 'Área de convivência do campus (~80m da sala). Status: Fora do Raio.',
    latitude: -22.519300,
    longitude: -44.098300,
    accuracy: 8,
    isMockLocation: false,
    statusExpected: 'REJECTED'
  },
  {
    id: 'estacionamento_ugb',
    name: '🚗 Portaria / Estacionamento UGB Aterrado',
    description: 'Entrada externa do campus (~140m). Status: Bloqueado.',
    latitude: -22.517850,
    longitude: -44.099100,
    accuracy: 10,
    isMockLocation: false,
    statusExpected: 'REJECTED'
  },
  {
    id: 'casa_remoto',
    name: '🏠 Em Casa / Bairro Retiro (Remoto)',
    description: 'Tentativa de fraude fora da faculdade (~3.8 km). Status: Bloqueado e Logado.',
    latitude: -22.495000,
    longitude: -44.115000,
    accuracy: 12,
    isMockLocation: false,
    statusExpected: 'FRAUD_BLOCKED'
  }
];

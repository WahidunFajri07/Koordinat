export interface NetworkNode {
  id: string;
  idpel: string;
  lat: number;
  lng: number;
  clusterId: string;
  clusterColor: string;
  tariff: string;
  power: string;
  status: 'valid' | 'unresolved' | 'invalid';
  regional: string;
  feeder: string;
  address: string;
}

export interface NetworkCluster {
  id: string;
  name: string;
  color: string;
  points: [number, number][]; // [lat, lng]
}

// Center around Cirebon - Palimanan matching the user's screenshot
export const MAP_CENTER_CIREBON: [number, number] = [-6.7445, 108.5365];

export const NETWORK_CLUSTERS: NetworkCluster[] = [
  {
    id: 'CL-01',
    name: 'Cluster Merah (Kedung Pane)',
    color: '#ef4444',
    points: [
      [-6.7365, 108.5312],
      [-6.7372, 108.5325],
      [-6.7380, 108.5330],
      [-6.7388, 108.5322],
      [-6.7395, 108.5315],
      [-6.7390, 108.5335],
      [-6.7402, 108.5342],
      [-6.7410, 108.5330],
      [-6.7415, 108.5320],
      [-6.7405, 108.5310],
    ],
  },
  {
    id: 'CL-02',
    name: 'Cluster Oranye (Tirtayasa Barat)',
    color: '#f97316',
    points: [
      [-6.7475, 108.5305],
      [-6.7485, 108.5312],
      [-6.7495, 108.5320],
      [-6.7510, 108.5310],
      [-6.7520, 108.5325],
      [-6.7512, 108.5340],
      [-6.7500, 108.5345],
      [-6.7488, 108.5335],
    ],
  },
  {
    id: 'CL-03',
    name: 'Cluster Hijau (Jalan Utama Timur)',
    color: '#10b981',
    points: [
      [-6.7480, 108.5440],
      [-6.7492, 108.5448],
      [-6.7505, 108.5460],
      [-6.7515, 108.5475],
      [-6.7500, 108.5465],
      [-6.7485, 108.5452],
    ],
  },
  {
    id: 'CL-04',
    name: 'Cluster Ungu (Permata Regency)',
    color: '#a855f7',
    points: [
      [-6.7455, 108.5395],
      [-6.7458, 108.5408],
      [-6.7460, 108.5420],
      [-6.7465, 108.5432],
      [-6.7470, 108.5425],
      [-6.7468, 108.5412],
      [-6.7464, 108.5398],
    ],
  },
  {
    id: 'CL-05',
    name: 'Cluster Pink (Feeder Tol Palimanan)',
    color: '#ec4899',
    points: [
      [-6.7350, 108.5330],
      [-6.7390, 108.5345],
      [-6.7420, 108.5352],
      [-6.7450, 108.5360],
      [-6.7490, 108.5375],
      [-6.7530, 108.5385],
      [-6.7480, 108.5348],
      [-6.7440, 108.5338],
    ],
  },
];

// Main Low-Voltage JTR lines (Garis JTR)
export const JTR_LINES: [number, number][][] = [
  // JTR Feeder 1
  [
    [-6.7355, 108.5320],
    [-6.7375, 108.5335],
    [-6.7410, 108.5345],
    [-6.7450, 108.5365],
    [-6.7485, 108.5378],
    [-6.7525, 108.5390],
  ],
  // JTR Feeder 2 (Cross street)
  [
    [-6.7455, 108.5365],
    [-6.7460, 108.5400],
    [-6.7465, 108.5435],
  ],
  // JTR Feeder 3 (West residential)
  [
    [-6.7485, 108.5378],
    [-6.7480, 108.5340],
    [-6.7490, 108.5315],
  ],
];

// Generate individual customer/node points from the clusters
export const ALL_NETWORK_NODES: NetworkNode[] = NETWORK_CLUSTERS.flatMap((cluster, cIdx) => {
  return cluster.points.map((pt, pIdx) => {
    const idpelNum = 531000000000 + (cIdx * 100) + pIdx + 1;
    const tariffs = ['R1', 'R1', 'R2', 'B1', 'I1'];
    const powers = ['900 VA', '1300 VA', '2200 VA', '3500 VA', '4500 VA'];
    const statuses: ('valid' | 'unresolved' | 'invalid')[] = ['valid', 'unresolved', 'unresolved', 'valid', 'invalid'];

    return {
      id: `node-${cluster.id}-${pIdx + 1}`,
      idpel: idpelNum.toString(),
      lat: pt[0],
      lng: pt[1],
      clusterId: cluster.id,
      clusterColor: cluster.color,
      tariff: tariffs[pIdx % tariffs.length],
      power: powers[pIdx % powers.length],
      status: statuses[(cIdx + pIdx) % statuses.length],
      regional: 'UP3 Cirebon',
      feeder: `FDR-${cluster.id}`,
      address: `Jl. Sultan Ageng Tirtayasa No. ${pIdx * 4 + 12}, Kedawung, Cirebon`,
    };
  });
});

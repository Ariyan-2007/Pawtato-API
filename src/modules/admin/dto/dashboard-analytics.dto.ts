export class DashboardAnalyticsDto {
  monthlyUsers!: number[];

  monthlyPets!: number[];

  monthlyQrScans!: number[];

  speciesDistribution!: {
    species: string;
    count: number;
  }[];

  lostVsRecovered!: {
    lost: number;
    recovered: number;
  };

  topScannedPets!: {
    id: string;
    name: string;
    scanCount: number;
  }[];
}
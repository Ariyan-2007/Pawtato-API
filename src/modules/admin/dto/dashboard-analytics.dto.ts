import { ApiProperty } from '@nestjs/swagger';

class SpeciesDistributionItem {
  @ApiProperty()
  species!: string;

  @ApiProperty()
  count!: number;
}

class LostVsRecovered {
  @ApiProperty()
  lost!: number;

  @ApiProperty()
  recovered!: number;
}

class TopScannedPet {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  scanCount!: number;
}

class TagStatusBreakdownItem {
  @ApiProperty()
  status!: string;

  @ApiProperty()
  count!: number;
}

class DatingFunnelDto {
  @ApiProperty()
  totalSwipes!: number;

  @ApiProperty()
  totalLikes!: number;

  @ApiProperty()
  totalMatches!: number;

  @ApiProperty({ description: 'totalMatches / totalLikes, 0 if no likes yet.' })
  matchRate!: number;
}

class IdentityVerificationAnalyticsDto {
  @ApiProperty()
  pending!: number;

  @ApiProperty()
  approved!: number;

  @ApiProperty()
  rejected!: number;

  @ApiProperty({
    description: 'approved / (approved + rejected), 0 if nothing decided yet.',
  })
  approvalRate!: number;

  @ApiProperty()
  totalSubmissions!: number;
}

export class DashboardAnalyticsDto {
  @ApiProperty({ type: [Number] })
  monthlyUsers!: number[];

  @ApiProperty({ type: [Number] })
  monthlyPets!: number[];

  @ApiProperty({ type: [Number] })
  monthlyQrScans!: number[];

  @ApiProperty({ type: [SpeciesDistributionItem] })
  speciesDistribution!: SpeciesDistributionItem[];

  @ApiProperty({ type: LostVsRecovered })
  lostVsRecovered!: LostVsRecovered;

  @ApiProperty({ type: [TopScannedPet] })
  topScannedPets!: TopScannedPet[];

  @ApiProperty({ type: [TagStatusBreakdownItem] })
  tagStatusBreakdown!: TagStatusBreakdownItem[];

  @ApiProperty({ type: DatingFunnelDto })
  datingFunnel!: DatingFunnelDto;

  @ApiProperty({ type: IdentityVerificationAnalyticsDto })
  identityVerification!: IdentityVerificationAnalyticsDto;

  @ApiProperty({
    type: [Number],
    description:
      'Revenue in cents from PAID+FULFILLED tag orders, by calendar month, this year.',
  })
  monthlyRevenue!: number[];
}

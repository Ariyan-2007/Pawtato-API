import { ApiProperty } from '@nestjs/swagger';

class TagStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  manufactured!: number;

  @ApiProperty()
  available!: number;

  @ApiProperty()
  assigned!: number;

  @ApiProperty()
  suspended!: number;

  @ApiProperty()
  retired!: number;
}

class DatingStatsDto {
  @ApiProperty()
  activeProfiles!: number;

  @ApiProperty()
  totalMatches!: number;

  @ApiProperty()
  activeMatches!: number;
}

class CaretakerStatsDto {
  @ApiProperty()
  totalGrants!: number;
}

class CommerceStatsDto {
  @ApiProperty()
  pendingPayment!: number;

  @ApiProperty()
  paid!: number;

  @ApiProperty()
  fulfilled!: number;

  @ApiProperty({
    description: 'Sum of totalAmountCents for PAID+FULFILLED orders.',
  })
  totalRevenueCents!: number;

  @ApiProperty()
  currency!: string;
}

class PendingModerationDto {
  @ApiProperty({ description: 'FoundReports with status PENDING.' })
  foundReports!: number;

  @ApiProperty({ description: 'Dating reports with status PENDING.' })
  datingReports!: number;

  @ApiProperty({
    description: 'Identity verification submissions with status PENDING.',
  })
  identityVerifications!: number;
}

export class DashboardStatsDto {
  @ApiProperty()
  totalUsers!: number;

  @ApiProperty()
  totalPets!: number;

  @ApiProperty()
  lostPets!: number;

  @ApiProperty()
  recoveredPets!: number;

  @ApiProperty()
  totalVaccinations!: number;

  @ApiProperty()
  totalMedicalRecords!: number;

  @ApiProperty({ type: TagStatsDto })
  tags!: TagStatsDto;

  @ApiProperty({ type: DatingStatsDto })
  dating!: DatingStatsDto;

  @ApiProperty({ type: CaretakerStatsDto })
  caretakers!: CaretakerStatsDto;

  @ApiProperty({ type: CommerceStatsDto })
  commerce!: CommerceStatsDto;

  @ApiProperty({
    type: PendingModerationDto,
    description: "What needs an admin's attention right now.",
  })
  pendingModeration!: PendingModerationDto;
}

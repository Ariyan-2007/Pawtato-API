import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from '../users/users.service';
import { PetsService } from '../pets/pets.service';
import { TagsService } from '../tags/tags.service';
import { ScansService } from '../scans/scans.service';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import { MedicalService } from '../medical/medical.service';
import { FoundReportsService } from '../found-reports/found-reports.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { DatingService } from '../dating/dating.service';
import { IdentityVerificationService } from '../dating/identity-verification.service';
import { CaretakersService } from '../caretakers/caretakers.service';
import { TagOrdersService } from '../tag-orders/tag-orders.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { AdminPetQueryDto } from './dto/admin-pet-query.dto';
import { AdminFoundReportQueryDto } from './dto/admin-found-report-query.dto';
import { FoundReportStatus } from '../../common/enums/found-report-status.enum';
import type { AdminDatingReportQueryDto } from './dto/admin-dating-report-query.dto';
import { DatingReportStatus } from '../../common/enums/dating-report-status.enum';
import type { AdminIdentityVerificationQueryDto } from './dto/admin-identity-verification-query.dto';
import type { AdminTagOrderQueryDto } from '../tag-orders/dto/admin-tag-order-query.dto';
import type { ShipTagOrderDto } from '../tag-orders/dto/ship-tag-order.dto';
import type { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { DOMAIN_EVENTS } from '../../common/events/domain-events';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly petsService: PetsService,
    private readonly tagsService: TagsService,
    private readonly scansService: ScansService,
    private readonly vaccinationsService: VaccinationsService,
    private readonly medicalService: MedicalService,
    private readonly foundReportsService: FoundReportsService,
    private readonly notificationsService: NotificationsService,
    private readonly datingService: DatingService,
    private readonly identityVerificationService: IdentityVerificationService,
    private readonly caretakersService: CaretakersService,
    private readonly tagOrdersService: TagOrdersService,
    private readonly activityService: ActivityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async dashboard(): Promise<DashboardStatsDto> {
    const [
      totalUsers,
      totalPets,
      lostPets,
      recoveredPets,
      totalVaccinations,
      totalMedicalRecords,
      tagBreakdown,
      datingStats,
      verificationBreakdown,
      pendingFoundReports,
      totalCaretakerGrants,
      commerce,
    ] = await Promise.all([
      this.usersService.count(),
      this.petsService.count(),
      this.petsService.countLost(),
      this.petsService.countRecovered(),
      this.vaccinationsService.count(),
      this.medicalService.count(),
      this.tagsService.statusBreakdown(),
      this.datingService.adminStats(),
      this.identityVerificationService.countByStatus(),
      this.foundReportsService.countPending(),
      this.caretakersService.countAll(),
      this.tagOrdersService.adminRevenueSummary(),
    ]);

    return {
      totalUsers,
      totalPets,
      lostPets,
      recoveredPets,
      totalVaccinations,
      totalMedicalRecords,

      // Everything below is additive (Phase 20) — a "needs attention right
      // now" and "how healthy is the platform" view for the dashboard's
      // landing screen, not just raw resource counts.
      tags: {
        total: Object.values(tagBreakdown).reduce((sum, n) => sum + n, 0),
        manufactured: tagBreakdown.MANUFACTURED,
        available: tagBreakdown.AVAILABLE,
        assigned: tagBreakdown.ASSIGNED,
        suspended: tagBreakdown.SUSPENDED,
        retired: tagBreakdown.RETIRED,
      },

      dating: {
        activeProfiles: datingStats.activeProfiles,
        totalMatches: datingStats.totalMatches,
        activeMatches: datingStats.activeMatches,
      },

      caretakers: {
        totalGrants: totalCaretakerGrants,
      },

      commerce: {
        pendingPayment: commerce.countByStatus.PENDING_PAYMENT,
        paid: commerce.countByStatus.PAID,
        fulfilled: commerce.countByStatus.FULFILLED,
        totalRevenueCents: commerce.totalRevenueCents,
        currency: commerce.currency,
      },

      // What an admin actually needs to act on today — the single most
      // useful number on a moderation-heavy dashboard like this one.
      pendingModeration: {
        foundReports: pendingFoundReports,
        datingReports: datingStats.pendingReports,
        identityVerifications: verificationBreakdown.PENDING,
      },
    };
  }

  async users(query: AdminUserQueryDto) {
    return this.usersService.findAll(query);
  }

  async user(id: string) {
    return this.usersService.findById(id);
  }

  async block(actorId: string, id: string) {
    if (actorId === id) {
      throw new BadRequestException('You cannot block your own account.');
    }

    const result = await this.usersService.blockUser(id);

    await this.activityService.log(actorId, 'admin.user.blocked', id);

    return result;
  }

  async unblock(actorId: string, id: string) {
    const result = await this.usersService.unblockUser(id);

    await this.activityService.log(actorId, 'admin.user.unblocked', id);

    return result;
  }

  async changeRole(actorId: string, id: string, role: UserRole) {
    const result = await this.usersService.changeRole(id, role);

    await this.activityService.log(actorId, 'admin.user.role-changed', id, {
      role,
    });

    return result;
  }

  // Manually activates an account for a user who can't complete OTP
  // verification themselves (e.g. never received the email). Reuses
  // UsersService.activateAccount(), the same method the OTP flow itself
  // calls on success, so this takes the identical path to ACTIVE — set
  // status, clear any pending OTP state — rather than duplicating that
  // logic here.
  async verifyUser(actorId: string, id: string) {
    const result = await this.usersService.activateAccount(id);

    await this.activityService.log(actorId, 'admin.user.verified', id);

    return result;
  }

  // Deletes a user and everything connected to them: every pet they own,
  // every tag they own (assigned to one of those pets or not), and
  // everything that in turn references those pets/tags (medical records,
  // vaccinations, scan history, found reports, in-app notifications, dating
  // profiles/swipes/matches/messages, caretaker grants on their own pets),
  // plus every dating report this user filed against someone else's pet,
  // plus their identity-verification record and its private NID files
  // (Phase 11 — user-scoped, not pet-scoped, so this doesn't fall out of
  // the petIds-based cascade above), plus their own caretaker access on
  // *other* people's pets (Phase 15 — also user-scoped, same reasoning),
  // plus every stored file along the way (avatar, pet photos, tag QR
  // images, found-report photos). Deliberately
  // not wrapped in a Mongo transaction —
  // this project's MongoDB isn't running as a replica set (see
  // PAWTATO_ROADMAP.md's Phase 8 notes), which transactions require.
  //
  // Runs children-first (scans/found-reports/medical/vaccinations, then
  // tags/pets, then notifications, then the user) specifically so a crash
  // partway through leaves the least damage: if it dies before reaching the
  // tags/pets step, every id needed to retry is still derivable by querying
  // Pet.owner/Tag.ownerId again, since those documents are still there.
  //
  // What this intentionally does NOT delete: Activity audit-log entries
  // where this user is the actor (or target) — the audit trail is meant to
  // outlive the account it describes, the same way it isn't purged when a
  // pet or tag is deleted either — and FoundReport.reviewedBy stamps left by
  // this user reviewing *other* people's reports, which are a historical
  // record of moderation, not this user's own data.
  async delete(actorId: string, id: string) {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [petIds, tagIds] = await Promise.all([
      this.petsService.findIdsForOwner(id),
      this.tagsService.findIdsForOwner(id),
    ]);

    await this.scansService.deleteAllForPetsAndTags(petIds, tagIds);
    await this.foundReportsService.deleteAllForPetsAndTags(petIds, tagIds);
    await this.medicalService.deleteAllForPets(petIds);
    await this.vaccinationsService.deleteAllForPets(petIds);

    await this.datingService.deleteAllForPets(petIds);
    await this.datingService.deleteReportsByReporter(id);
    await this.identityVerificationService.deleteForUser(id);

    // Both directions: caretaker rows on this user's own pets (petIds-based,
    // same as every other pet-keyed collection above) and rows where this
    // user was themselves a caretaker on someone else's pet (userId-based —
    // their access there must end when their account does).
    await this.caretakersService.deleteAllForPets(petIds);
    await this.caretakersService.deleteAllForCaretakerUser(id);

    await this.tagsService.deleteAllForOwner(id);
    await this.petsService.deleteAllForOwner(id);

    await this.notificationsService.deleteAllForUser(id);

    const result = await this.usersService.deleteUser(id);

    await this.activityService.log(actorId, 'admin.user.deleted', id, {
      deletedPetCount: petIds.length,
      deletedTagCount: tagIds.length,
    });

    return result;
  }

  async pets(query: AdminPetQueryDto) {
    return this.petsService.findAllAdmin(query);
  }

  async pet(id: string) {
    return this.petsService.findByIdAdmin(id);
  }

  async recoverPet(actorId: string, id: string) {
    const result = await this.petsService.recoverPet(id);

    await this.activityService.log(actorId, 'admin.pet.recovered', id);

    return result;
  }

  // Deletes a single pet and everything connected to it (its assigned tag +
  // QR image, medical records, vaccinations, scan history, found reports,
  // dating profile/swipes/matches/messages/reports-against-it, caretaker
  // grants), without
  // touching the owner's other pets/tags. See delete() above for the
  // equivalent whole-user cascade.
  async deletePet(actorId: string, id: string) {
    const tagIds = await this.tagsService.findIdsForPet(id);

    await this.scansService.deleteAllForPetsAndTags([id], tagIds);
    await this.foundReportsService.deleteAllForPetsAndTags([id], tagIds);
    await this.medicalService.deleteAllForPets([id]);
    await this.vaccinationsService.deleteAllForPets([id]);
    await this.datingService.deleteAllForPets([id]);
    await this.caretakersService.deleteAllForPets([id]);
    await this.tagsService.deleteAllForPet(id);

    const result = await this.petsService.deletePet(id);

    await this.activityService.log(actorId, 'admin.pet.deleted', id, {
      deletedTagCount: tagIds.length,
    });

    return result;
  }

  async analytics() {
    const [
      monthlyUsers,
      monthlyPets,
      monthlyQrScans,
      speciesDistribution,
      lost,
      recovered,
      topScannedPets,
      tagBreakdown,
      datingStats,
      verificationBreakdown,
      monthlyRevenue,
    ] = await Promise.all([
      this.usersService.monthlyRegistrations(),
      this.petsService.monthlyRegistrations(),
      this.scansService.monthlyScanCounts(),
      this.petsService.speciesDistribution(),
      this.petsService.countLost(),
      this.petsService.countRecovered(),
      this.petsService.topScannedPets(),
      this.tagsService.statusBreakdown(),
      this.datingService.adminStats(),
      this.identityVerificationService.countByStatus(),
      this.tagOrdersService.monthlyRevenue(),
    ]);

    const totalVerifications =
      verificationBreakdown.PENDING +
      verificationBreakdown.APPROVED +
      verificationBreakdown.REJECTED;
    const decidedVerifications =
      verificationBreakdown.APPROVED + verificationBreakdown.REJECTED;

    return {
      monthlyUsers,
      monthlyPets,
      monthlyQrScans,
      speciesDistribution,
      lostVsRecovered: { lost, recovered },
      topScannedPets,

      // Additive (Phase 20) — see PAWTATO_ROADMAP.md Phase 20 for why these
      // were added: the dashboard's raw resource counts didn't cover
      // engagement (dating), trust (verification approval rate), or revenue
      // at all, despite all three being live, business-relevant subsystems.
      tagStatusBreakdown: Object.entries(tagBreakdown).map(
        ([status, count]) => ({ status, count }),
      ),

      datingFunnel: {
        totalSwipes: datingStats.totalSwipes,
        totalLikes: datingStats.totalLikes,
        totalMatches: datingStats.totalMatches,
        // 0 rather than a misleading 0%-looks-like-"working fine" figure
        // when nobody has liked anything yet — same reasoning as
        // DatingService.adminStats()'s own matchRate.
        matchRate: datingStats.matchRate,
      },

      identityVerification: {
        pending: verificationBreakdown.PENDING,
        approved: verificationBreakdown.APPROVED,
        rejected: verificationBreakdown.REJECTED,
        // Of submissions actually decided (excludes the still-pending
        // queue), what fraction were approved — a rejected-heavy rate is a
        // signal worth an admin's attention (bad instructions? bad-faith
        // submissions?) that a bare pending count can't show.
        approvalRate:
          decidedVerifications === 0
            ? 0
            : verificationBreakdown.APPROVED / decidedVerifications,
        totalSubmissions: totalVerifications,
      },

      monthlyRevenue,
    };
  }

  async foundReports(query: AdminFoundReportQueryDto) {
    return this.foundReportsService.findAllAdmin(query);
  }

  async updateFoundReportStatus(
    actorId: string,
    id: string,
    status: FoundReportStatus,
  ) {
    return this.foundReportsService.updateStatus(id, actorId, status);
  }

  async datingReports(query: AdminDatingReportQueryDto) {
    return this.datingService.adminListReports(query);
  }

  async updateDatingReportStatus(
    actorId: string,
    id: string,
    status: DatingReportStatus,
  ) {
    return this.datingService.adminUpdateReportStatus(actorId, id, status);
  }

  async deactivateDatingProfile(actorId: string, petId: string) {
    return this.datingService.adminDeactivateProfile(actorId, petId);
  }

  async tagOrders(query: AdminTagOrderQueryDto) {
    return this.tagOrdersService.adminList(query);
  }

  async markTagOrderShipped(actorId: string, id: string, dto: ShipTagOrderDto) {
    return this.tagOrdersService.adminMarkShipped(actorId, id, dto);
  }

  async datingReportMessages(actorId: string, reportId: string) {
    return this.datingService.adminGetReportMessages(actorId, reportId);
  }

  async identityVerifications(query: AdminIdentityVerificationQueryDto) {
    return this.identityVerificationService.adminList(query);
  }

  async identityVerificationImages(actorId: string, id: string) {
    return this.identityVerificationService.adminGetSignedImages(actorId, id);
  }

  async approveIdentityVerification(actorId: string, id: string) {
    return this.identityVerificationService.adminApprove(actorId, id);
  }

  async rejectIdentityVerification(
    actorId: string,
    id: string,
    reason: string,
  ) {
    return this.identityVerificationService.adminReject(actorId, id, reason);
  }

  async cancelTagOrder(actorId: string, id: string) {
    return this.tagOrdersService.adminCancel(actorId, id);
  }

  // Fans out one ADMIN_BROADCAST domain event per targeted recipient,
  // reusing the exact same notification-creation + email/push channel path
  // every other event type already goes through (DomainEventsListener) —
  // no separate broadcast-delivery code exists anywhere else. Emitted
  // fire-and-forget per recipient (in-process EventEmitter2, not a queue):
  // fine at this platform's current scale, but a genuinely large user base
  // would want this moved to a background job so one admin action doesn't
  // block on thousands of synchronous listener invocations.
  async broadcast(actorId: string, dto: BroadcastNotificationDto) {
    const recipients = await this.usersService.findActiveRecipients(dto.role);

    for (const recipient of recipients) {
      this.eventEmitter.emit(DOMAIN_EVENTS.ADMIN_BROADCAST, {
        ownerId: recipient.id,
        ownerEmail: recipient.email,
        ownerPhone: recipient.phone,
        title: dto.title,
        message: dto.message,
      });
    }

    await this.activityService.log(
      actorId,
      'admin.notification.broadcast',
      actorId,
      {
        role: dto.role ?? 'ALL',
        recipientCount: recipients.length,
        title: dto.title,
      },
    );

    return { recipientCount: recipients.length };
  }
}

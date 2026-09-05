import type { RequestHistoryEntry, SupportRequest } from '../../domain/entities/Request';
import { OPEN_STATUSES, REQUEST_STATUSES, RequestStatus } from '../../domain/enums/RequestStatus';
import { UserRole, isHandlerRole } from '../../domain/enums/UserRole';
import type {
  IRequestRepository,
  PaginatedRequests,
  RequestQuery,
} from '../../domain/interfaces/IRequestRepository';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { ActorRelation, findTransition, nextStatuses } from '../../domain/workflow/transitions';
import { AppError } from '../../shared/AppError';
import type { CreateRequestInput } from '../dtos/CreateRequestSchema';
import type { ListRequestsQuery, RequestStatsQuery } from '../dtos/ListRequestsSchema';
import type { UpdateStatusInput } from '../dtos/UpdateStatusSchema';

/** Who is acting, as far as the service is concerned. */
export interface Actor {
  id: string;
  role: UserRole;
}

export interface ListMyRequestsOptions {
  page?: number;
  limit?: number;
}

/** The manager dashboard payload: aggregate counts alongside the raw list. */
export interface RequestStats {
  total: number;
  open: number;
  unassigned: number;
  byStatus: Record<RequestStatus, number>;
  byAssignee: { assigneeId: string | null; count: number }[];
}

export class RequestService {
  constructor(
    private readonly requests: IRequestRepository,
    private readonly users: IUserRepository,
  ) {}

  async createRequest(input: CreateRequestInput, actor: Actor): Promise<SupportRequest> {
    const now = new Date();

    // Every request opens with a CREATED entry, so the history is never empty
    // and "when was this submitted, and by whom" reads the same as every later
    // change rather than being a special case.
    const opening: RequestHistoryEntry = {
      type: 'CREATED',
      fromStatus: null,
      toStatus: RequestStatus.NEW,
      actorId: actor.id,
      at: now,
    };

    return this.requests.create({
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      requesterId: actor.id,
      status: RequestStatus.NEW,
      history: [opening],
    });
  }

  async getRequestById(id: string, actor: Actor): Promise<SupportRequest> {
    const found = await this.requests.findById(id);
    if (!found) throw AppError.notFound('Request not found');

    if (!canView(found, actor)) {
      // Same error as a genuine miss — otherwise a 403 confirms the request exists.
      throw AppError.notFound('Request not found');
    }

    return found;
  }

  /**
   * Assignment mechanism, resolved from the PRD: a request starts unassigned and
   * a handler claims it off the queue. Claiming is not reassignment — taking work
   * from whoever already owns it is a manager action, so this only succeeds on an
   * unclaimed request.
   */
  async claimRequest(id: string, actor: Actor): Promise<SupportRequest> {
    if (!isHandlerRole(actor.role)) {
      throw AppError.forbidden('Only support staff or a manager can claim a request');
    }

    const request = await this.requireRequest(id);

    if (request.assigneeId === actor.id) return request;
    if (request.assigneeId !== null) {
      throw AppError.conflict('That request has already been claimed. Ask a manager to reassign it.');
    }
    if (isTerminal(request.status)) {
      throw AppError.unprocessable('A closed request cannot be claimed');
    }

    return this.applyAssignment(request, actor.id, actor, 'ASSIGNED');
  }

  /** Manager-only: assign, reassign, or hand a request back to the queue with null. */
  async assignRequest(id: string, assigneeId: string | null, actor: Actor): Promise<SupportRequest> {
    if (actor.role !== UserRole.MANAGER) {
      throw AppError.forbidden('Only a manager can assign or reassign a request');
    }

    const request = await this.requireRequest(id);
    if (isTerminal(request.status)) {
      throw AppError.unprocessable('A closed request cannot be reassigned');
    }

    if (assigneeId !== null) {
      await this.requireActiveHandler(assigneeId);
    }

    if (request.assigneeId === assigneeId) return request;

    return this.applyAssignment(
      request,
      assigneeId,
      actor,
      assigneeId === null ? 'UNASSIGNED' : 'ASSIGNED',
    );
  }

  /**
   * The handler queue. Agents get their own work; managers get the same view of
   * what they personally own, since the all-requests view is a separate endpoint.
   */
  async listMyRequests(actor: Actor, options: ListMyRequestsOptions = {}): Promise<PaginatedRequests> {
    if (!isHandlerRole(actor.role)) {
      throw AppError.forbidden('Only support staff or a manager have an assigned queue');
    }

    return this.requests.search({
      assigneeId: actor.id,
      page: options.page ?? 1,
      limit: options.limit ?? 25,
      sortBy: 'priority',
      sortDir: 'desc',
    });
  }

  /**
   * The manager view, and the only place requests are listed in bulk.
   *
   * Filters and visibility are deliberately separate: the caller controls the
   * filters, the viewer's role controls the scope, and scope is applied on top
   * so no combination of query parameters can widen what someone may see.
   */
  async listRequests(query: ListRequestsQuery, actor: Actor): Promise<PaginatedRequests> {
    return this.requests.search({
      ...this.toRepositoryQuery(query, actor),
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
  }

  /**
   * What managers need to see, resolved from the PRD: both the raw list and the
   * counts, since "how much is open" and "what exactly is stuck" are different
   * questions and v1 has no separate reporting module to answer either.
   */
  async getStats(query: RequestStatsQuery, actor: Actor): Promise<RequestStats> {
    const scoped = this.toRepositoryQuery(query, actor);

    const [byStatusRows, byAssignee] = await Promise.all([
      this.requests.countByStatus(scoped),
      this.requests.countByAssignee(scoped),
    ]);

    // Every status is present, including the zeroes — a dashboard with columns
    // appearing and disappearing as work moves is worse than useless.
    const byStatus = REQUEST_STATUSES.reduce<Record<RequestStatus, number>>(
      (acc, status) => {
        acc[status] = byStatusRows.find((row) => row.status === status)?.count ?? 0;
        return acc;
      },
      {} as Record<RequestStatus, number>,
    );

    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    const open = OPEN_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
    const unassigned = byAssignee.find((row) => row.assigneeId === null)?.count ?? 0;

    return { total, open, unassigned, byStatus, byAssignee };
  }

  /**
   * Translates the HTTP-shaped filters into a repository query, then narrows it
   * to what this viewer is allowed to see. Both list and stats go through here,
   * so the two can never disagree about scope.
   */
  private toRepositoryQuery(
    query: ListRequestsQuery | RequestStatsQuery,
    actor: Actor,
  ): RequestQuery {
    const repoQuery: RequestQuery = {};

    if (query.status) repoQuery.status = query.status;
    if (query.category) repoQuery.category = query.category;
    if (query.priority) repoQuery.priority = query.priority;
    if (query.requester) repoQuery.requesterId = query.requester;
    if (query.assignee !== undefined) {
      repoQuery.assigneeId = query.assignee === 'unassigned' ? null : query.assignee;
    }

    switch (actor.role) {
      case UserRole.MANAGER:
        break;
      case UserRole.AGENT:
        repoQuery.visibleTo = { assigneeIdOrUnassigned: actor.id };
        break;
      default:
        repoQuery.visibleTo = { requesterId: actor.id };
    }

    return repoQuery;
  }

  /**
   * The single gate every status change goes through. The legality of a move and
   * who may make it both come from the transition table, so the rules live in one
   * readable place rather than spread across controllers.
   */
  async updateStatus(id: string, input: UpdateStatusInput, actor: Actor): Promise<SupportRequest> {
    const request = await this.requireRequest(id);

    if (!canView(request, actor)) throw AppError.notFound('Request not found');

    const { status: to, note } = input;
    if (request.status === to) {
      throw AppError.unprocessable(`This request is already ${to}`);
    }

    const { rule, fromIsTerminal } = findTransition(request.status, to);

    if (fromIsTerminal) {
      throw AppError.unprocessable(`${request.status} is final — nothing moves out of it`);
    }
    if (!rule) {
      throw AppError.unprocessable(
        `Cannot move a request from ${request.status} to ${to}. Allowed from here: ${nextStatuses(
          request.status,
        ).join(', ')}`,
      );
    }

    const relations = relationsOf(request, actor);
    if (!rule.allowed.some((allowed) => relations.has(allowed))) {
      throw AppError.forbidden(rule.deniedMessage);
    }

    const now = new Date();
    const entry: RequestHistoryEntry = {
      type: rule.isReopen ? 'REOPENED' : 'STATUS_CHANGED',
      fromStatus: request.status,
      toStatus: to,
      actorId: actor.id,
      ...(note ? { note } : {}),
      at: now,
    };

    // resolvedAt is cleared on reopen so it always means "resolved this time
    // round" rather than "was resolved once".
    const updated = await this.requests.update(
      request.id,
      {
        status: to,
        resolvedAt: to === RequestStatus.RESOLVED ? now : rule.isReopen ? null : undefined,
        closedAt: to === RequestStatus.CLOSED ? now : undefined,
      },
      entry,
    );
    if (!updated) throw AppError.notFound('Request not found');

    return updated;
  }

  /** The audit trail for one request, oldest first. */
  async getHistory(id: string, actor: Actor): Promise<RequestHistoryEntry[]> {
    const request = await this.getRequestById(id, actor);
    return [...request.history].sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  private async requireRequest(id: string): Promise<SupportRequest> {
    const found = await this.requests.findById(id);
    if (!found) throw AppError.notFound('Request not found');
    return found;
  }

  private async requireActiveHandler(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw AppError.unprocessable('That user does not exist');
    if (!user.isActive) throw AppError.unprocessable('That user has been deactivated');
    if (!isHandlerRole(user.role)) {
      throw AppError.unprocessable('Requests can only be owned by support staff or a manager');
    }
  }

  /**
   * Picking up a NEW request also starts it. Leaving it NEW while somebody owns it
   * is precisely the ambiguous state the PRD calls out as the thing to avoid.
   */
  private async applyAssignment(
    request: SupportRequest,
    assigneeId: string | null,
    actor: Actor,
    type: 'ASSIGNED' | 'UNASSIGNED',
  ): Promise<SupportRequest> {
    const startsWork = assigneeId !== null && request.status === RequestStatus.NEW;
    const nextStatus = startsWork ? RequestStatus.IN_PROGRESS : request.status;

    const entry: RequestHistoryEntry = {
      type,
      fromStatus: request.status,
      toStatus: nextStatus,
      actorId: actor.id,
      note: assigneeId === null ? 'Returned to the unclaimed queue' : `Assigned to ${assigneeId}`,
      at: new Date(),
    };

    const updated = await this.requests.update(
      request.id,
      { assigneeId, ...(startsWork ? { status: nextStatus } : {}) },
      entry,
    );
    if (!updated) throw AppError.notFound('Request not found');

    return updated;
  }
}

/**
 * v1 visibility, resolved from the PRD:
 * - employees see only what they submitted
 * - agents see their own work plus the unclaimed queue (and anything they raised)
 * - managers see everything
 */
export function canView(request: SupportRequest, actor: Actor): boolean {
  if (actor.role === UserRole.MANAGER) return true;
  if (request.requesterId === actor.id) return true;
  if (actor.role === UserRole.AGENT) {
    return request.assigneeId === actor.id || request.assigneeId === null;
  }
  return false;
}

function isTerminal(status: RequestStatus): boolean {
  return status === RequestStatus.CLOSED;
}

/**
 * Turns an actor into the relations they hold for this particular request. The
 * transition table is written in terms of these rather than roles, because
 * "the assignee" and "whoever raised it" are what the rules actually depend on.
 */
function relationsOf(request: SupportRequest, actor: Actor): Set<ActorRelation> {
  const relations = new Set<ActorRelation>();
  if (request.requesterId === actor.id) relations.add(ActorRelation.REQUESTER);
  if (request.assigneeId === actor.id) relations.add(ActorRelation.ASSIGNEE);
  if (actor.role === UserRole.MANAGER) relations.add(ActorRelation.MANAGER);
  return relations;
}

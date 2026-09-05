import type { RequestHistoryEntry, SupportRequest } from '../../domain/entities/Request';
import { RequestStatus } from '../../domain/enums/RequestStatus';
import { UserRole, isHandlerRole } from '../../domain/enums/UserRole';
import type { IRequestRepository, PaginatedRequests } from '../../domain/interfaces/IRequestRepository';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { AppError } from '../../shared/AppError';
import type { CreateRequestInput } from '../dtos/CreateRequestSchema';

/** Who is acting, as far as the service is concerned. */
export interface Actor {
  id: string;
  role: UserRole;
}

export interface ListMyRequestsOptions {
  page?: number;
  limit?: number;
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

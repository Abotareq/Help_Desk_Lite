import type { RequestHistoryEntry, SupportRequest } from '../../domain/entities/Request';
import { RequestStatus } from '../../domain/enums/RequestStatus';
import { UserRole } from '../../domain/enums/UserRole';
import type { IRequestRepository } from '../../domain/interfaces/IRequestRepository';
import { AppError } from '../../shared/AppError';
import type { CreateRequestInput } from '../dtos/CreateRequestSchema';

/** Who is acting, as far as the service is concerned. */
export interface Actor {
  id: string;
  role: UserRole;
}

export class RequestService {
  constructor(private readonly requests: IRequestRepository) {}

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

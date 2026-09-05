import type { RequestHistoryEntry, SupportRequest } from '../../src/domain/entities/Request';
import { PRIORITY_WEIGHT } from '../../src/domain/enums/RequestPriority';
import type { RequestStatus } from '../../src/domain/enums/RequestStatus';
import type {
  AssigneeCount,
  CreateRequestData,
  IRequestRepository,
  PaginatedRequests,
  RequestQuery,
  StatusCount,
  UpdateRequestData,
} from '../../src/domain/interfaces/IRequestRepository';

/**
 * In-memory stand-in for IRequestRepository. Mirrors the Mongo implementation's
 * observable behaviour — reference generation, visibility scoping, sorting —
 * without a database, so service tests stay fast.
 */
export class FakeRequestRepository implements IRequestRepository {
  private readonly requests = new Map<string, SupportRequest>();
  private sequence = 0;

  async create(data: CreateRequestData): Promise<SupportRequest> {
    const now = new Date();
    const seq = ++this.sequence;
    const id = seq.toString().padStart(24, '0');

    const request: SupportRequest = {
      id,
      reference: `HD-${String(seq).padStart(6, '0')}`,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      status: data.status,
      requesterId: data.requesterId,
      assigneeId: null,
      history: [...data.history],
      resolvedAt: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.requests.set(id, request);
    return clone(request);
  }

  async findById(id: string): Promise<SupportRequest | null> {
    const found = this.requests.get(id);
    return found ? clone(found) : null;
  }

  async findByReference(reference: string): Promise<SupportRequest | null> {
    const found = [...this.requests.values()].find((r) => r.reference === reference.toUpperCase());
    return found ? clone(found) : null;
  }

  async search(query: RequestQuery): Promise<PaginatedRequests> {
    const matched = [...this.requests.values()].filter((r) => matches(r, query));
    const sorted = sort(matched, query);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const start = (page - 1) * limit;

    return {
      items: sorted.slice(start, start + limit).map(clone),
      total: matched.length,
      page,
      limit,
    };
  }

  async update(
    id: string,
    data: UpdateRequestData,
    historyEntry?: RequestHistoryEntry,
  ): Promise<SupportRequest | null> {
    const existing = this.requests.get(id);
    if (!existing) return null;

    if (data.status !== undefined) existing.status = data.status;
    if (data.assigneeId !== undefined) existing.assigneeId = data.assigneeId;
    if (data.resolvedAt !== undefined) existing.resolvedAt = data.resolvedAt;
    if (data.closedAt !== undefined) existing.closedAt = data.closedAt;
    if (historyEntry) existing.history.push(historyEntry);
    existing.updatedAt = new Date();

    return clone(existing);
  }

  async countByStatus(query: RequestQuery = {}): Promise<StatusCount[]> {
    const tally = new Map<RequestStatus, number>();
    for (const r of this.requests.values()) {
      if (!matches(r, query)) continue;
      tally.set(r.status, (tally.get(r.status) ?? 0) + 1);
    }
    return [...tally.entries()].map(([status, count]) => ({ status, count }));
  }

  async countByAssignee(query: RequestQuery = {}): Promise<AssigneeCount[]> {
    const tally = new Map<string | null, number>();
    for (const r of this.requests.values()) {
      if (!matches(r, query)) continue;
      tally.set(r.assigneeId, (tally.get(r.assigneeId) ?? 0) + 1);
    }
    return [...tally.entries()]
      .map(([assigneeId, count]) => ({ assigneeId, count }))
      .sort((a, b) => b.count - a.count);
  }
}

function matches(request: SupportRequest, query: RequestQuery): boolean {
  if (query.status?.length && !query.status.includes(request.status)) return false;
  if (query.category?.length && !query.category.includes(request.category)) return false;
  if (query.priority?.length && !query.priority.includes(request.priority)) return false;
  if (query.requesterId && request.requesterId !== query.requesterId) return false;
  if (query.assigneeId !== undefined && request.assigneeId !== query.assigneeId) return false;

  // Visibility narrows on top of the filters and can never widen them.
  const scope = query.visibleTo;
  if (scope?.requesterId && request.requesterId !== scope.requesterId) return false;
  if (scope?.assigneeIdOrUnassigned) {
    const id = scope.assigneeIdOrUnassigned;
    if (request.assigneeId !== id && request.assigneeId !== null && request.requesterId !== id) {
      return false;
    }
  }

  return true;
}

function sort(items: SupportRequest[], query: RequestQuery): SupportRequest[] {
  const dir = query.sortDir === 'asc' ? 1 : -1;
  const by = query.sortBy ?? 'createdAt';

  return [...items].sort((a, b) => {
    if (by === 'priority') {
      const diff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      return diff !== 0 ? diff * dir : b.createdAt.getTime() - a.createdAt.getTime();
    }
    if (by === 'status') return a.status.localeCompare(b.status) * dir;
    return (a[by].getTime() - b[by].getTime()) * dir;
  });
}

function clone(request: SupportRequest): SupportRequest {
  return { ...request, history: request.history.map((h) => ({ ...h })) };
}

import type { NewComment, RequestComment } from '../entities/Comment';
import type { RequestHistoryEntry, SupportRequest } from '../entities/Request';
import type { RequestCategory } from '../enums/RequestCategory';
import type { RequestPriority } from '../enums/RequestPriority';
import type { RequestStatus } from '../enums/RequestStatus';

export interface CreateRequestData {
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  requesterId: string;
  status: RequestStatus;
  history: RequestHistoryEntry[];
}

/** Fields a service may change on an existing request. */
export interface UpdateRequestData {
  status?: RequestStatus;
  category?: RequestCategory;
  assigneeId?: string | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
}

export interface RequestQuery {
  status?: RequestStatus[];
  category?: RequestCategory[];
  priority?: RequestPriority[];
  assigneeId?: string | null;
  requesterId?: string;
  /** Restricts results to a set the viewer is allowed to see. */
  visibleTo?: { requesterId?: string; assigneeIdOrUnassigned?: string };
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedRequests {
  items: SupportRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface StatusCount {
  status: RequestStatus;
  count: number;
}

export interface AssigneeCount {
  assigneeId: string | null;
  count: number;
}

/** The seam between the application layer and storage for requests. */
export interface IRequestRepository {
  create(data: CreateRequestData): Promise<SupportRequest>;
  findById(id: string): Promise<SupportRequest | null>;
  findByReference(reference: string): Promise<SupportRequest | null>;
  search(query: RequestQuery): Promise<PaginatedRequests>;
  update(id: string, data: UpdateRequestData, historyEntry?: RequestHistoryEntry): Promise<SupportRequest | null>;
  countByStatus(query?: RequestQuery): Promise<StatusCount[]>;
  countByAssignee(query?: RequestQuery): Promise<AssigneeCount[]>;

  /**
   * Comments are read and written through their own methods rather than riding
   * along on SupportRequest. A request is returned by half a dozen endpoints,
   * including bulk lists; hanging an internal note off it would mean every one
   * of those had to remember to redact. This way there is exactly one road in.
   */
  addComment(requestId: string, comment: NewComment): Promise<RequestComment | null>;
  /** Oldest first — a conversation reads forwards. */
  listComments(requestId: string): Promise<RequestComment[]>;
}

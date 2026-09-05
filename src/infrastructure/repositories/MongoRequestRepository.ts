import { Types, type FilterQuery } from 'mongoose';
import type { RequestHistoryEntry, SupportRequest } from '../../domain/entities/Request';
import type { RequestStatus } from '../../domain/enums/RequestStatus';
import type {
  AssigneeCount,
  CreateRequestData,
  IRequestRepository,
  PaginatedRequests,
  RequestQuery,
  StatusCount,
  UpdateRequestData,
} from '../../domain/interfaces/IRequestRepository';
import { nextSequence } from '../database/models/CounterModel';
import { RequestModel, type RequestHydrated } from '../database/models/RequestModel';

const REFERENCE_PREFIX = 'HD';
const REFERENCE_PAD = 6;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** The only place that knows requests live in Mongo. */
export class MongoRequestRepository implements IRequestRepository {
  async create(data: CreateRequestData): Promise<SupportRequest> {
    const seq = await nextSequence('request');
    const reference = `${REFERENCE_PREFIX}-${String(seq).padStart(REFERENCE_PAD, '0')}`;

    const created = await RequestModel.create({
      ...data,
      reference,
      requesterId: new Types.ObjectId(data.requesterId),
      assigneeId: null,
      history: data.history.map(toHistorySubdocument),
    });

    return toDomain(created);
  }

  async findById(id: string): Promise<SupportRequest | null> {
    if (!isObjectIdLike(id)) return null;
    const doc = await RequestModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByReference(reference: string): Promise<SupportRequest | null> {
    const doc = await RequestModel.findOne({ reference: reference.toUpperCase() });
    return doc ? toDomain(doc) : null;
  }

  async search(query: RequestQuery): Promise<PaginatedRequests> {
    const filter = buildFilter(query);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));

    const [docs, total] = await Promise.all([
      RequestModel.find(filter)
        .sort(buildSort(query))
        .skip((page - 1) * limit)
        .limit(limit),
      RequestModel.countDocuments(filter),
    ]);

    return { items: docs.map(toDomain), total, page, limit };
  }

  async update(
    id: string,
    data: UpdateRequestData,
    historyEntry?: RequestHistoryEntry,
  ): Promise<SupportRequest | null> {
    if (!isObjectIdLike(id)) return null;

    const $set: Record<string, unknown> = {};
    if (data.status !== undefined) $set.status = data.status;
    if (data.assigneeId !== undefined) {
      $set.assigneeId = data.assigneeId === null ? null : new Types.ObjectId(data.assigneeId);
    }
    if (data.resolvedAt !== undefined) $set.resolvedAt = data.resolvedAt;
    if (data.closedAt !== undefined) $set.closedAt = data.closedAt;

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length > 0) update.$set = $set;
    if (historyEntry) update.$push = { history: toHistorySubdocument(historyEntry) };

    const doc = await RequestModel.findByIdAndUpdate(id, update, { new: true });
    return doc ? toDomain(doc) : null;
  }

  async countByStatus(query: RequestQuery = {}): Promise<StatusCount[]> {
    const rows = await RequestModel.aggregate<{ _id: RequestStatus; count: number }>([
      { $match: buildFilter(query) },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return rows.map((row) => ({ status: row._id, count: row.count }));
  }

  async countByAssignee(query: RequestQuery = {}): Promise<AssigneeCount[]> {
    const rows = await RequestModel.aggregate<{ _id: Types.ObjectId | null; count: number }>([
      { $match: buildFilter(query) },
      { $group: { _id: '$assigneeId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return rows.map((row) => ({ assigneeId: row._id ? row._id.toString() : null, count: row.count }));
  }
}

function buildFilter(query: RequestQuery): FilterQuery<Record<string, unknown>> {
  const filter: FilterQuery<Record<string, unknown>> = {};

  if (query.status?.length) filter.status = { $in: query.status };
  if (query.category?.length) filter.category = { $in: query.category };
  if (query.priority?.length) filter.priority = { $in: query.priority };
  if (query.requesterId && isObjectIdLike(query.requesterId)) {
    filter.requesterId = new Types.ObjectId(query.requesterId);
  }
  if (query.assigneeId !== undefined) {
    filter.assigneeId =
      query.assigneeId === null || !isObjectIdLike(query.assigneeId)
        ? null
        : new Types.ObjectId(query.assigneeId);
  }

  // Visibility is applied as an $and clause so it can never be widened by a
  // caller-supplied filter — an employee narrowing by assignee still only sees
  // their own requests.
  const scope = buildVisibilityClause(query);
  if (scope) filter.$and = [scope];

  return filter;
}

function buildVisibilityClause(query: RequestQuery): FilterQuery<Record<string, unknown>> | null {
  const visibleTo = query.visibleTo;
  if (!visibleTo) return null;

  if (visibleTo.requesterId) {
    return { requesterId: new Types.ObjectId(visibleTo.requesterId) };
  }
  if (visibleTo.assigneeIdOrUnassigned) {
    const id = new Types.ObjectId(visibleTo.assigneeIdOrUnassigned);
    return { $or: [{ assigneeId: id }, { assigneeId: null }, { requesterId: id }] };
  }
  return null;
}

function buildSort(query: RequestQuery): Record<string, 1 | -1> {
  const dir: 1 | -1 = query.sortDir === 'asc' ? 1 : -1;

  // priorityWeight is the numeric mirror of priority — sorting the string
  // itself would give HIGH < LOW < MEDIUM.
  if (query.sortBy === 'priority') return { priorityWeight: dir, createdAt: -1 };

  return { [query.sortBy ?? 'createdAt']: dir };
}

function toHistorySubdocument(entry: RequestHistoryEntry) {
  return {
    type: entry.type,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    actorId: new Types.ObjectId(entry.actorId),
    ...(entry.note ? { note: entry.note } : {}),
    at: entry.at,
  };
}

function toDomain(doc: RequestHydrated): SupportRequest {
  return {
    id: doc._id.toString(),
    reference: doc.reference,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    priority: doc.priority,
    status: doc.status,
    requesterId: doc.requesterId.toString(),
    assigneeId: doc.assigneeId ? doc.assigneeId.toString() : null,
    history: doc.history.map((h) => ({
      type: h.type,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actorId: h.actorId.toString(),
      ...(h.note ? { note: h.note } : {}),
      at: h.at,
    })),
    resolvedAt: doc.resolvedAt,
    closedAt: doc.closedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function isObjectIdLike(value: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(value);
}

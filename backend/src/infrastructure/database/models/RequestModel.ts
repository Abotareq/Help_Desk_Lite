import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import type { HistoryEventType } from '../../../domain/entities/Request';
import { REQUEST_CATEGORIES, RequestCategory } from '../../../domain/enums/RequestCategory';
import { PRIORITY_WEIGHT, REQUEST_PRIORITIES, RequestPriority } from '../../../domain/enums/RequestPriority';
import { REQUEST_STATUSES, RequestStatus } from '../../../domain/enums/RequestStatus';

const HISTORY_EVENT_TYPES: HistoryEventType[] = [
  'CREATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'UNASSIGNED',
  'REOPENED',
];

interface CommentSubdocument {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  isInternal: boolean;
  at: Date;
}

interface HistorySubdocument {
  type: HistoryEventType;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorId: Types.ObjectId;
  note?: string;
  at: Date;
}

export interface RequestDocument {
  reference: string;
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  /** Denormalised numeric form of `priority`, so Mongo can sort it meaningfully. */
  priorityWeight: number;
  status: RequestStatus;
  requesterId: Types.ObjectId;
  assigneeId: Types.ObjectId | null;
  history: HistorySubdocument[];
  comments: CommentSubdocument[];
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const historySchema = new Schema<HistorySubdocument>(
  {
    type: { type: String, required: true, enum: HISTORY_EVENT_TYPES },
    fromStatus: { type: String, enum: [...REQUEST_STATUSES, null], default: null },
    toStatus: { type: String, required: true, enum: REQUEST_STATUSES },
    actorId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    note: { type: String, trim: true, maxlength: 1000 },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

// Comments carry their own _id — unlike history entries, a single one gets
// referred to (a React key today, a notification's target tomorrow).
const commentSchema = new Schema<CommentSubdocument>(
  {
    authorId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    isInternal: { type: Boolean, required: true, default: false },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: true },
);

const requestSchema = new Schema<RequestDocument>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, required: true, enum: REQUEST_CATEGORIES },
    priority: { type: String, required: true, enum: REQUEST_PRIORITIES, default: RequestPriority.MEDIUM },
    priorityWeight: { type: Number, required: true, default: PRIORITY_WEIGHT[RequestPriority.MEDIUM] },
    status: { type: String, required: true, enum: REQUEST_STATUSES, default: RequestStatus.NEW, index: true },
    requesterId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    history: { type: [historySchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// Sorting alphabetically on the priority string gives HIGH < LOW < MEDIUM, which
// is nonsense, so priorityWeight is kept in step with it on every write.
requestSchema.pre('validate', function syncPriorityWeight(next) {
  this.priorityWeight = PRIORITY_WEIGHT[this.priority];
  next();
});

// The manager dashboard's default cut: open work grouped by owner, newest first.
requestSchema.index({ status: 1, assigneeId: 1, createdAt: -1 });

export type RequestHydrated = HydratedDocument<RequestDocument>;

export const RequestModel: Model<RequestDocument> = model<RequestDocument>('Request', requestSchema);

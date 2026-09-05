import { Schema, model, type Model } from 'mongoose';

interface CounterDocument {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDocument>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

const CounterModel: Model<CounterDocument> = model<CounterDocument>('Counter', counterSchema);

/**
 * Atomically bumps a named sequence. A single findOneAndUpdate with $inc means
 * two concurrent submissions can never be handed the same reference.
 */
export async function nextSequence(name: string): Promise<number> {
  const counter = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();

  return counter?.seq ?? 1;
}

export { CounterModel };

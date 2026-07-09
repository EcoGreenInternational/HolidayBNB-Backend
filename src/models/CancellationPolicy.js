import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const PeriodSchema = new Schema(
  {
    fromDays:      { type: Number, required: true },
    guestRefundPct: { type: Number, required: true, min: 0, max: 100 },
    platformFeePct: { type: Number, required: true, min: 0, max: 100 },
    ownerFeePct:    { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const CancellationPolicySchema = new Schema(
  {
    ownerHoldingDays: { type: Number, default: 14, min: 0 },
    periods: [PeriodSchema],
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

CancellationPolicySchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({
      ownerHoldingDays: 14,
      periods: [
        { fromDays: 14, guestRefundPct: 100, platformFeePct: 0, ownerFeePct: 0 },
        { fromDays: 7,  guestRefundPct: 50,  platformFeePct: 10, ownerFeePct: 40 },
        { fromDays: 0,  guestRefundPct: 0,   platformFeePct: 20, ownerFeePct: 80 },
      ],
    });
  }
  return doc;
};

CancellationPolicySchema.methods.getApplicablePeriod = function (daysBeforeCheckIn) {
  const sorted = [...this.periods].sort((a, b) => b.fromDays - a.fromDays);
  for (const p of sorted) {
    if (daysBeforeCheckIn >= p.fromDays) return p;
  }
  return this.periods[this.periods.length - 1];
};

export default model('CancellationPolicy', CancellationPolicySchema);

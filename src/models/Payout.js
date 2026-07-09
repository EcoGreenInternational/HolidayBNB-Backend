import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const PayoutSchema = new Schema(
  {
    booking:    { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    owner:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    property:   { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    totalAmount:     { type: Number, required: true },
    commissionAmount:{ type: Number, default: 0 },
    ownerAmount:     { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'processing', 'paid', 'failed'],
      default: 'pending',
    },
    scheduledDate: { type: Date },
    processedDate: { type: Date },
    method:    { type: String, enum: ['stripe_connect', 'stripe_transfer', 'manual_bank', 'cheque'], default: 'manual_bank' },
    transactionId: { type: String, default: '' },
    notes:     { type: String, default: '' },
    retryCount:   { type: Number, default: 0 },
    lastError:    { type: String, default: '' },
    processedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

PayoutSchema.index({ owner: 1, status: 1 });
PayoutSchema.index({ status: 1, scheduledDate: 1 });

export default model('Payout', PayoutSchema);

import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const BookingSchema = new Schema(
  {
    property:  { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    checkIn:   { type: Date, required: true },
    checkOut:  { type: Date, required: true },
    guests: {
      adults:   { type: Number, default: 1 },
      children: { type: Number, default: 0 },
    },
    totalAmount:     { type: Number, required: true },
    serviceFee:      { type: Number, default: 0 },
    status:          { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
    stripeSessionId: { type: String, default: '' },
    invoiceNumber:   { type: String, default: '' },
    paidAt:          { type: Date },
    source:          { type: String, enum: ['direct', 'wishlist'], default: 'direct' },
    commissionRate:  { type: Number, default: 0 },
    commissionAmount:{ type: Number, default: 0 },

    refundAmount:    { type: Number, default: 0 },
    refundStatus:    { type: String, enum: ['none', 'pending', 'processed', 'failed'], default: 'none' },
    platformRefundFee: { type: Number, default: 0 },
    ownerRefundFee:    { type: Number, default: 0 },
    refundedAt:      { type: Date },
    refundRetryCount:{ type: Number, default: 0 },
    refundLastError: { type: String, default: '' },

    payoutGenerated:{ type: Boolean, default: false },
  },
  { timestamps: true }
);

BookingSchema.index({ property: 1, checkIn: 1, checkOut: 1 });
BookingSchema.index({ user: 1, createdAt: -1 });
BookingSchema.index({ stripeSessionId: 1 });

export default model('Booking', BookingSchema);

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
  },
  { timestamps: true }
);

BookingSchema.index({ property: 1, checkIn: 1, checkOut: 1 });
BookingSchema.index({ user: 1, createdAt: -1 });
BookingSchema.index({ stripeSessionId: 1 });

export default model('Booking', BookingSchema);

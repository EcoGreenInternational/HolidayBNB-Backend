import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const ReviewSchema = new Schema(
  {
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    user:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating:   { type: Number, required: true, min: 1, max: 5 },
    emotion:  { type: String, required: true, enum: ['angry','worried','neutral','happy','delighted'] },
    text:     { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

ReviewSchema.index({ property: 1, createdAt: -1 });
ReviewSchema.index({ property: 1, user: 1, createdAt: -1 });

export default model('Review', ReviewSchema);

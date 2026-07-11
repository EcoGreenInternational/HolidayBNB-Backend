import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const HostApplicationSchema = new Schema({
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, trim: true, lowercase: true },
  phone:         { type: String, trim: true, default: '' },
  propertyName:  { type: String, required: true, trim: true },
  propertyType:  { type: String, default: 'Villa' },
  city:          { type: String, trim: true, default: '' },
  country:       { type: String, trim: true, default: '' },
  bedrooms:      { type: Number, default: 0 },
  bathrooms:     { type: Number, default: 0 },
  description:   { type: String, default: '' },
  imageUrls:     { type: [String], default: [] },
  status:        { type: String, enum: ['pending', 'reviewed', 'approved', 'rejected'], default: 'pending' },
  notes:         { type: String, default: '' },
}, { timestamps: true });

export default model('HostApplication', HostApplicationSchema);

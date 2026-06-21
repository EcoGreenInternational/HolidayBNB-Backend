import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const PropertySchema = new Schema(
  {
    name:            { type: String, required: true, trim: true },
    propertyType:    { type: String, enum: ['Villa','Bungalow','Apartment','Resort','Guest House','Boutique Villa','Beach House','Tree House','Heritage Bungalow','Penthouse','Studio','House','Condo'], default: 'Villa' },
    roomType:        { type: String, enum: ['Private Room','Shared Room','Entire Place','Studio','Suite'], default: 'Entire Place' },
    status:          { type: String, enum: ['Active','Inactive','Pending'], default: 'Active' },
    description:     { type: String, trim: true, default: '' },
    maxAdults:       { type: Number, default: 1 },
    maxChildren:     { type: Number, default: 0 },
    maxInfants:      { type: Number, default: 0 },

    country:         { type: String, trim: true, default: '' },
    city:            { type: String, trim: true, default: '' },
    address:         { type: String, trim: true, default: '' },
    mapLink:         { type: String, trim: true, default: '' },
    landmarks:       { type: [String], default: [] },

    bedrooms:        { type: Number, default: 0 },
    beds:            { type: Number, default: 0 },
    bathrooms:       { type: Number, default: 0 },
    floorArea:       { type: Number, default: 0 },
    minNights:       { type: Number, default: 1 },
    maxNights:       { type: Number, default: 30 },

    amenities:       { type: Map, of: Boolean, default: {} },
    accessibility:   { type: Map, of: Boolean, default: {} },
    nearby:          { type: Map, of: Boolean, default: {} },
    rules:           { type: Map, of: Boolean, default: {} },
    experience:      { type: Map, of: Boolean, default: {} },
    uniqueExperiences: { type: Map, of: Boolean, default: {} },
    safety:          { type: Map, of: Boolean, default: {} },

    price:           { type: Number, default: 0 },
    cleaningFee:     { type: Number, default: 0 },
    weeklyDiscount:  { type: Number, default: 0 },
    monthlyDiscount: { type: Number, default: 0 },
    availability:    { type: String, trim: true, default: '' },
    instantBooking:  { type: Boolean, default: false },

    images:          { type: [String], default: [] },

    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

PropertySchema.virtual('location').get(function () {
  return [this.city, this.country].filter(Boolean).join(', ');
});

export default model('Property', PropertySchema);

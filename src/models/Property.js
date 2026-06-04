import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const AmenitySchema = new Schema({
  icon: { type: String },
  label: { type: String, required: true },
});

const ReviewSchema = new Schema({
  name: { type: String, required: true },
  avatar: { type: String },
  date: { type: String },
  text: { type: String, required: true },
});

const PropertySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    type: { type: String, trim: true }, // e.g. "For Sale", "ECO-CERTIFIED"
    category: { type: String, trim: true }, // e.g. "Villa", "Studio"
    price: { type: Number, required: true },
    unit: { type: String, trim: true }, // e.g. "/SqFT", "/month"
    images: { type: [String], default: [] },
    beds: { type: Number, default: 0 },
    baths: { type: Number, default: 0 },
    guests: { type: Number, default: 0 },
    sqft: { type: String, trim: true },
    area: { type: String, trim: true }, // e.g. 'Private Pool'
    description: { type: String, trim: true },
    amenities: { type: [AmenitySchema], default: [] },
    location_detail: { type: String, trim: true },
    reviews_list: { type: [ReviewSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export default model('Property', PropertySchema);

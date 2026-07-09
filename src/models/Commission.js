import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const CommissionSchema = new Schema(
  {
    globalRate: {
      type: Number,
      default: 12,
      min: 0,
      max: 100,
    },
    categoryRates: [
      {
        propertyType: { type: String, required: true },
        rate: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    offers: [
      {
        name: { type: String, required: true },
        rate: { type: Number, required: true, min: 0, max: 100 },
        propertyType: { type: String, default: 'all' },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        active: { type: Boolean, default: true },
      },
    ],
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

CommissionSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({ globalRate: 12 });
  }
  return doc;
};

export default model('Commission', CommissionSchema);

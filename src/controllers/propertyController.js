import Property from '../models/Property.js';
import { sendSuccess, sendCreated, sendError, sendBadRequest } from '../utils/apiResponse.js';

export const getProperties = async (req, res) => {
  try {
    const properties = await Property.find();
    return res.status(200).json(properties);
  } catch (error) {
    return sendError(res, 'Failed to fetch properties');
  }
};


export const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return sendError(res, 'Property not found', 404);
    }
    return res.status(200).json(property);
  } catch (error) {
    return sendError(res, 'Failed to fetch property');
  }
};

export const seedProperties = async (req, res) => {
  try {
    await Property.deleteMany();
    const sampleProperties = req.body.properties;
    if (!sampleProperties || !Array.isArray(sampleProperties)) {
      return sendBadRequest(res, 'Please provide an array of properties to seed');
    }
    const createdProperties = await Property.insertMany(sampleProperties);
    return sendCreated(res, { count: createdProperties.length }, 'Properties seeded successfully');
  } catch (error) {
    return sendError(res, 'Failed to seed properties');
  }
};

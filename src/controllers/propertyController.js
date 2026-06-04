import Property from '../models/Property.js';

export const getProperties = async (req, res) => {
  try {
    const properties = await Property.find();
    res.status(200).json(properties);
  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching properties', error: error.message });
  }
};


export const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching property', error: error.message });
  }
};

export const seedProperties = async (req, res) => {
  try {
    await Property.deleteMany();
    const sampleProperties = req.body.properties;
    if (!sampleProperties || !Array.isArray(sampleProperties)) {
      return res.status(400).json({ message: 'Please provide an array of properties to seed' });
    }
    const createdProperties = await Property.insertMany(sampleProperties);
    res.status(201).json({ message: 'Properties seeded successfully', count: createdProperties.length });
  } catch (error) {
    res.status(500).json({ message: 'Server Error seeding properties', error: error.message });
  }
};

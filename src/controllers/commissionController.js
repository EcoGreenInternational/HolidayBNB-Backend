import Commission from '../models/Commission.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const getCommissionSettings = async (req, res) => {
  try {
    const commission = await Commission.getSingleton();
    return sendSuccess(res, commission);
  } catch (err) {
    logger.error(`getCommissionSettings: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const updateCommissionSettings = async (req, res) => {
  try {
    const { globalRate, categoryRates, offers } = req.body;
    const commission = await Commission.getSingleton();

    if (globalRate !== undefined) commission.globalRate = globalRate;
    if (categoryRates !== undefined) commission.categoryRates = categoryRates;
    if (offers !== undefined) commission.offers = offers;
    commission.updatedBy = req.user._id;

    await commission.save();
    return sendSuccess(res, commission, 'Commission settings updated');
  } catch (err) {
    logger.error(`updateCommissionSettings: ${err.message}`);
    return sendError(res, err.message);
  }
};

export const getApplicableRate = async (propertyType) => {
  try {
    const commission = await Commission.getSingleton();
    const now = new Date();

    const activeOffer = commission.offers.find(o => {
      if (!o.active) return false;
      if (now < o.startDate || now > o.endDate) return false;
      if (o.propertyType === 'all') return true;
      return o.propertyType === propertyType;
    });

    if (activeOffer) return activeOffer.rate;

    const categoryRate = commission.categoryRates.find(c => c.propertyType === propertyType);
    if (categoryRate) return categoryRate.rate;

    return commission.globalRate;
  } catch (err) {
    logger.error(`getApplicableRate: ${err.message}`);
    return 0;
  }
};

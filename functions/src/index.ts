import { setGlobalOptions } from 'firebase-functions/v2';
import { REGION } from './config';

setGlobalOptions({ region: REGION, maxInstances: 5 });

export { generatePlan } from './plan';
export {
  stravaAuthUrl, stravaCallback, stravaDisconnect, stravaSync, stravaWebhook, processStravaEvent,
} from './strava';

import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getBase44ServerUrl } from '@/lib/base44-server-url';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: getBase44ServerUrl(),
  requiresAuth: false,
  appBaseUrl
});

import type { Signature } from '../types.js';
import { ecommerce } from './ecommerce.js';
import { booking } from './booking.js';
import { social } from './social.js';
import { saas } from './saas.js';
import { content } from './content.js';
import { crm } from './crm.js';
import { authOnly } from './auth-only.js';
import { marketing } from './marketing.js';
import { admin } from './admin.js';
import { blank } from './blank.js';

export const SIGNATURES: Signature[] = [
  ecommerce,
  booking,
  social,
  saas,
  content,
  crm,
  authOnly,
  marketing,
  admin,
  blank,
];

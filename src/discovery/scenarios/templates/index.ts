import type { JourneyTemplate } from '../types.js';
import { browseToPurchase } from './ecommerce/browse-to-purchase.js';
import { cartEdit } from './ecommerce/cart-edit.js';
import { searchFilter } from './ecommerce/search-filter.js';
import { searchToConfirmation } from './booking/search-to-confirmation.js';
import { signIn } from './auth-only/sign-in.js';
import { resetPassword } from './auth-only/reset-password.js';
import { signUpToDashboard } from './saas/sign-up-to-dashboard.js';
import { settingsUpdate } from './saas/settings-update.js';
import { browseArticle } from './content/browse-article.js';
import { subscribe } from './content/subscribe.js';
import { signUpToFirstPost } from './social/sign-up-to-first-post.js';
import { createDeal } from './crm/create-deal.js';
import { contactForm } from './marketing/contact-form.js';
import { crudRow } from './admin/crud-row.js';

export const TEMPLATES: JourneyTemplate[] = [
  browseToPurchase,
  cartEdit,
  searchFilter,
  searchToConfirmation,
  signIn,
  resetPassword,
  signUpToDashboard,
  settingsUpdate,
  browseArticle,
  subscribe,
  signUpToFirstPost,
  createDeal,
  contactForm,
  crudRow,
];

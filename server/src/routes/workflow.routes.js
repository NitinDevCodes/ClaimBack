import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { workflow } from '../controllers/workflow.controller.js';
import { admin } from '../controllers/admin.controller.js';
export function workflowRoutes(env) {
  const router = Router();
  router.use(['/dashboard', '/claims', '/notifications', '/admin'], authenticate(env));
  router.get('/dashboard', workflow.dashboard);
  router.get('/claims', workflow.claims);
  router.post('/claims', workflow.submit);
  router.get('/claims/:id', workflow.claim);
  router.patch('/claims/:id', workflow.transition);
  router.get('/notifications', workflow.notifications);
  router.patch('/notifications/:id/read', workflow.readNotification);
  router.use('/admin', authorize('admin'));
  router.get('/admin/stats', admin.stats);
  router.get('/admin/users', admin.users);
  router.patch('/admin/users/:id', admin.userStatus);
  router.get('/admin/reports', admin.reports);
  router.patch('/admin/reports/:id', admin.moderate);
  return router;
}

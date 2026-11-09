import { Router } from 'express';
import * as categoryController from '../../controllers/categoryController';
import { validate } from '../../middleware/validate';
import { authenticate, requireBusinessAccess } from '../../middleware/auth';
import { createCategorySchema, updateCategorySchema } from '../../validation/productValidation';

const router = Router();

router.use(authenticate);
router.use(requireBusinessAccess());

router.get('/', categoryController.getCategories);
router.post('/', validate(createCategorySchema), categoryController.createCategory);
router.patch('/:id', validate(updateCategorySchema), categoryController.updateCategory);

export default router;

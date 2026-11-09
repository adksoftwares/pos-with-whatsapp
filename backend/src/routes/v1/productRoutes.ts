import { Router } from 'express';
import * as productController from '../../controllers/productController';
import { validate } from '../../middleware/validate';
import { authenticate, requireBusinessAccess } from '../../middleware/auth';
import { createProductSchema, updateProductSchema, updateStatusSchema, listQuerySchema } from '../../validation/productValidation';

const router = Router();

router.use(authenticate);
router.use(requireBusinessAccess());

router.get('/stock-value', productController.getStockValue);
router.get('/', validate(listQuerySchema), productController.getProducts);
router.post('/', validate(createProductSchema), productController.createProduct);
router.get('/barcode/:barcode', productController.getProductByBarcode);
router.post('/:id/adjust-stock', productController.adjustStock);
router.get('/:id', productController.getProductById);
router.patch('/:id', validate(updateProductSchema), productController.updateProduct);
router.patch('/:id/status', validate(updateStatusSchema), productController.updateProductStatus);

export default router;

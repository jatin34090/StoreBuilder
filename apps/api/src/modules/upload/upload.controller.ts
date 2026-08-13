import {
  Controller,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Query,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Express } from 'express';
import { CloudinaryService } from './cloudinary.service';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { CategoriesService } from '../categories/categories.service';
import { TenantService } from '../tenant/tenant.service';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentStoreId } from '../../common/decorators/current-store.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@jewellery/types';

const multerOptions = {
  storage: undefined,
  limits: { fileSize: 5 * 1024 * 1024 },
};

@ApiTags('Upload')
@ApiBearerAuth()
@Controller()
export class UploadController {
  constructor(
    private readonly cloudinary: CloudinaryService,
    private readonly products: ProductsService,
    private readonly users: UsersService,
    private readonly categories: CategoriesService,
    private readonly tenant: TenantService,
  ) {}

  // ─── Product Images ────────────────────────────────────────────────────────

  @Post('admin/products/:productId/images')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiOperation({ summary: 'Upload a product image (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'primary', type: Boolean, required: false })
  @ApiQuery({ name: 'variantId', type: String, required: false })
  @ApiBody({
    schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
  })
  async uploadProductImage(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentStoreId() storeId: string,
    @Query('primary', new DefaultValuePipe(false), ParseBoolPipe) primary: boolean,
    @Query('variantId') variantId?: string,
  ) {
    // Resolve store slug for tenant-isolated Cloudinary folder
    const store = storeId ? await this.tenant.resolveById(storeId) : null;
    const storeSlug = store?.slug ?? 'shared';

    // Enforce storage quota before uploading
    if (storeId) await this.tenant.checkStorageQuota(storeId, file.size);

    const result = await this.cloudinary.uploadProductImage(file, productId, storeSlug);

    // Track storage usage per tenant
    if (storeId) await this.tenant.incrementStorageBytes(storeId, result.bytes);

    const image = await this.products.addImage(productId, result.publicId, result.secureUrl, primary, variantId);
    return { image, upload: result };
  }

  @Delete('admin/products/:productId/images/:imageId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a product image and remove from Cloudinary (admin only)' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiParam({ name: 'imageId', type: String, format: 'uuid' })
  async deleteProductImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    const image = await this.products.getImageOrThrow(productId, imageId);
    await Promise.all([
      this.cloudinary.deleteImage(image.publicId),
      this.products.removeImage(productId, imageId),
    ]);
    return { message: 'Image deleted' };
  }

  // ─── Avatar ───────────────────────────────────────────────────────────────

  @Post('users/me/avatar')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiOperation({ summary: 'Upload authenticated user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
  })
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @CurrentStoreId() storeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (storeId) await this.tenant.checkStorageQuota(storeId, file.size);
    const result = await this.cloudinary.uploadAvatar(file, user.id);
    if (storeId) await this.tenant.incrementStorageBytes(storeId, result.bytes);
    await this.users.updateAvatar(user.id, result.secureUrl);
    return { avatarUrl: result.secureUrl };
  }

  // ─── Category Image ───────────────────────────────────────────────────────

  @Post('admin/categories/:categoryId/image')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiOperation({ summary: 'Upload a category banner image (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'categoryId', type: String, format: 'uuid' })
  @ApiBody({
    schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
  })
  async uploadCategoryImage(
    @Param('categoryId') categoryId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentStoreId() storeId: string,
  ) {
    const store = storeId ? await this.tenant.resolveById(storeId) : null;
    const storeSlug = store?.slug ?? 'shared';

    // Enforce storage quota before uploading
    if (storeId) await this.tenant.checkStorageQuota(storeId, file.size);

    const category = await this.categories.findById(categoryId);
    const result = await this.cloudinary.uploadCategoryImage(file, category.slug, storeSlug);

    if (storeId) await this.tenant.incrementStorageBytes(storeId, result.bytes);

    await this.categories.updateImage(categoryId, result.secureUrl);
    return { imageUrl: result.secureUrl };
  }
}

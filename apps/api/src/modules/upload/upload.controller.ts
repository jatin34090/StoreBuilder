import {
  Controller,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { JwtPayload } from '@jewellery/types';

const multerOptions = {
  storage: undefined, // Use memory storage (buffer) — no temp files
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — also enforced in CloudinaryService
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
  ) {}

  // ─── Product Images ────────────────────────────────────────────────────────

  @Post('admin/products/:productId/images')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiOperation({ summary: 'Upload a product image (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'primary', type: Boolean, required: false, description: 'Set as primary image' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadProductImage(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('primary', new DefaultValuePipe(false), ParseBoolPipe) primary: boolean,
  ) {
    const result = await this.cloudinary.uploadProductImage(file, productId);
    const image = await this.products.addImage(productId, result.publicId, result.secureUrl, primary);
    return { image, upload: result };
  }

  @Delete('admin/products/:productId/images/:imageId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a product image and remove from Cloudinary (admin only)' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiParam({ name: 'imageId', type: String, format: 'uuid' })
  async deleteProductImage(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    // Fetch image record first to get publicId for Cloudinary deletion
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
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.cloudinary.uploadAvatar(file, user.id);
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
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadCategoryImage(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const category = await this.categories.findById(categoryId);
    const result = await this.cloudinary.uploadCategoryImage(file, category.slug);
    await this.categories.updateImage(categoryId, result.secureUrl);
    return { imageUrl: result.secureUrl };
  }
}
